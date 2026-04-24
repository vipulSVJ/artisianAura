from fastapi import FastAPI, APIRouter, HTTPException, Request, Response, Depends
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional
import uuid
from datetime import datetime, timezone, timedelta
import httpx
import razorpay
import certifi

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url, tlsCAFile=certifi.where())
db = client[os.environ['DB_NAME']]

# Razorpay client
razorpay_client = razorpay.Client(auth=(
    os.environ.get('RAZORPAY_KEY_ID', ''),
    os.environ.get('RAZORPAY_KEY_SECRET', '')
))

# Admin emails — loaded from .env, comma-separated
ADMIN_EMAILS = [e.strip().lower() for e in os.environ.get('ADMIN_EMAILS', '').split(',') if e.strip()]

app = FastAPI()
api_router = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


# ─── Auth Helper ───
async def get_current_user(request: Request) -> dict:
    session_token = request.cookies.get("session_token")
    if not session_token:
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            session_token = auth_header.split(" ")[1]
    if not session_token:
        raise HTTPException(status_code=401, detail="Not authenticated")

    session = await db.user_sessions.find_one({"session_token": session_token}, {"_id": 0})
    if not session:
        raise HTTPException(status_code=401, detail="Invalid session")

    expires_at = session.get("expires_at")
    if isinstance(expires_at, str):
        expires_at = datetime.fromisoformat(expires_at)
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=401, detail="Session expired")

    user = await db.users.find_one({"user_id": session["user_id"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


async def get_optional_user(request: Request):
    try:
        return await get_current_user(request)
    except HTTPException:
        return None


async def get_admin_user(request: Request) -> dict:
    """Dependency: requires authenticated user with is_admin=True."""
    user = await get_current_user(request)
    if not user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Admin access required")
    return user



# ─── Google OAuth Endpoints ───
GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo"

@api_router.get("/auth/google")
async def google_login():
    """Redirect the browser to Google's OAuth consent screen."""
    client_id = os.environ.get("GOOGLE_CLIENT_ID", "")
    backend_url = os.environ.get("BACKEND_URL", "http://localhost:8000").rstrip("/")
    backend_callback = f"{backend_url}/api/auth/google/callback"
    
    params = {
        "client_id": client_id,
        "redirect_uri": backend_callback,
        "response_type": "code",
        "scope": "openid email profile",
        "access_type": "offline",
        "prompt": "select_account",
    }
    from urllib.parse import urlencode
    from starlette.responses import RedirectResponse
    return RedirectResponse(f"{GOOGLE_AUTH_URL}?{urlencode(params)}")


@api_router.get("/auth/google/callback")
async def google_callback(code: str = None, error: str = None):
    """Handle Google's redirect, exchange code for user info, create session."""
    from starlette.responses import RedirectResponse
    frontend_url = os.environ.get("FRONTEND_URL", "http://localhost:3000").rstrip("/")
    backend_url = os.environ.get("BACKEND_URL", "http://localhost:8000").rstrip("/")
    backend_callback = f"{backend_url}/api/auth/google/callback"

    if error or not code:
        return RedirectResponse(f"{frontend_url}/?auth=error")

    # 1. Exchange authorization code for tokens
    async with httpx.AsyncClient() as http_client:
        token_resp = await http_client.post(
            GOOGLE_TOKEN_URL,
            data={
                "code": code,
                "client_id": os.environ.get("GOOGLE_CLIENT_ID", ""),
                "client_secret": os.environ.get("GOOGLE_CLIENT_SECRET", ""),
                "redirect_uri": backend_callback,
                "grant_type": "authorization_code",
            },
        )
        if token_resp.status_code != 200:
            logger.error(f"Token exchange failed: {token_resp.text}")
            return RedirectResponse(f"{frontend_url}/?auth=error")
        tokens = token_resp.json()

        # 2. Fetch user info from Google
        userinfo_resp = await http_client.get(
            GOOGLE_USERINFO_URL,
            headers={"Authorization": f"Bearer {tokens['access_token']}"},
        )
        if userinfo_resp.status_code != 200:
            logger.error(f"Userinfo fetch failed: {userinfo_resp.text}")
            return RedirectResponse(f"{frontend_url}/?auth=error")
        google_user = userinfo_resp.json()

    email = google_user.get("email", "")
    name = google_user.get("name", email.split("@")[0])
    picture = google_user.get("picture", "")

    # 3. Create or update user in MongoDB
    # Check if this email should be an admin
    is_admin = email.lower() in ADMIN_EMAILS

    existing = await db.users.find_one({"email": email}, {"_id": 0})
    if existing:
        user_id = existing["user_id"]
        await db.users.update_one(
            {"email": email},
            {"$set": {"name": name, "picture": picture, "is_admin": is_admin}}
        )
    else:
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        ref_name = name[:3].upper().replace(" ", "X")
        referral_code = f"{ref_name}{uuid.uuid4().hex[:5].upper()}"
        await db.users.insert_one({
            "user_id": user_id,
            "email": email,
            "name": name,
            "picture": picture,
            "phone": "",
            "address": {},
            "is_admin": is_admin,
            "referral_code": referral_code,
            "referral_count": 0,
            "referred_by": None,
            "created_at": datetime.now(timezone.utc).isoformat()
        })

    # 4. Create session
    session_token = f"st_{uuid.uuid4().hex}"
    await db.user_sessions.insert_one({
        "user_id": user_id,
        "session_token": session_token,
        "expires_at": (datetime.now(timezone.utc) + timedelta(days=7)).isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat()
    })

    # 5. Redirect to frontend, passing token in URL so frontend stores it in localStorage.
    # Using a URL param avoids cross-port cookie issues in local development.
    from urllib.parse import urlencode
    redirect_url = f"{frontend_url}/auth/callback?{urlencode({'token': session_token})}"
    return RedirectResponse(redirect_url)


@api_router.get("/auth/me")
async def get_me(user: dict = Depends(get_current_user)):
    return user


@api_router.post("/auth/logout")
async def logout(request: Request, response: Response):
    # Support both cookie and Bearer token
    session_token = request.cookies.get("session_token")
    if not session_token:
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            session_token = auth_header.split(" ")[1]
    if session_token:
        await db.user_sessions.delete_one({"session_token": session_token})
    response.delete_cookie("session_token", path="/")
    return {"message": "Logged out"}




# ─── Products ───
@api_router.get("/products")
async def list_products(
    category: Optional[str] = None,
    material: Optional[str] = None,
    color: Optional[str] = None,
    min_price: Optional[float] = None,
    max_price: Optional[float] = None,
    sort: Optional[str] = "newest",
    search: Optional[str] = None,
    featured: Optional[bool] = None,
    page: int = 1,
    limit: int = 12
):
    query = {}
    if category:
        query["category"] = category
    if material:
        query["material"] = material
    if color:
        query["color"] = color
    if min_price is not None or max_price is not None:
        price_q = {}
        if min_price is not None:
            price_q["$gte"] = min_price
        if max_price is not None:
            price_q["$lte"] = max_price
        query["price"] = price_q
    if search:
        query["$or"] = [
            {"name": {"$regex": search, "$options": "i"}},
            {"description": {"$regex": search, "$options": "i"}}
        ]
    if featured is not None:
        query["featured"] = featured

    sort_map = {
        "newest": ("created_at", -1),
        "price_asc": ("price", 1),
        "price_desc": ("price", -1),
        "popular": ("rating_avg", -1)
    }
    sort_key, sort_dir = sort_map.get(sort, ("created_at", -1))
    skip = (page - 1) * limit
    total = await db.products.count_documents(query)
    products = await db.products.find(query, {"_id": 0}).sort(sort_key, sort_dir).skip(skip).limit(limit).to_list(limit)
    return {"products": products, "total": total, "page": page, "pages": max(1, (total + limit - 1) // limit)}


@api_router.get("/products/{product_id}")
async def get_product(product_id: str):
    product = await db.products.find_one({"product_id": product_id}, {"_id": 0})
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    return product


@api_router.get("/categories")
async def list_categories():
    categories = await db.products.distinct("category")
    return {"categories": categories}


@api_router.get("/filters")
async def get_filters():
    categories = await db.products.distinct("category")
    materials = await db.products.distinct("material")
    colors = await db.products.distinct("color")
    return {"categories": categories, "materials": materials, "colors": colors}


# ─── Cart ───
@api_router.get("/cart")
async def get_cart(user: dict = Depends(get_current_user)):
    cart_items = await db.cart.find({"user_id": user["user_id"]}, {"_id": 0}).to_list(100)
    enriched = []
    for item in cart_items:
        product = await db.products.find_one({"product_id": item["product_id"]}, {"_id": 0})
        if product:
            item["product"] = product
            enriched.append(item)
    return {"items": enriched}


@api_router.post("/cart")
async def add_to_cart(request: Request, user: dict = Depends(get_current_user)):
    body = await request.json()
    product_id = body.get("product_id")
    quantity = body.get("quantity", 1)
    if not product_id:
        raise HTTPException(status_code=400, detail="product_id required")

    product = await db.products.find_one({"product_id": product_id}, {"_id": 0})
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    existing = await db.cart.find_one({"user_id": user["user_id"], "product_id": product_id}, {"_id": 0})
    if existing:
        new_qty = existing["quantity"] + quantity
        await db.cart.update_one(
            {"user_id": user["user_id"], "product_id": product_id},
            {"$set": {"quantity": new_qty}}
        )
    else:
        await db.cart.insert_one({
            "user_id": user["user_id"],
            "product_id": product_id,
            "quantity": quantity
        })
    return {"message": "Added to cart"}


@api_router.put("/cart/{product_id}")
async def update_cart_item(product_id: str, request: Request, user: dict = Depends(get_current_user)):
    body = await request.json()
    quantity = body.get("quantity", 1)
    if quantity <= 0:
        await db.cart.delete_one({"user_id": user["user_id"], "product_id": product_id})
    else:
        await db.cart.update_one(
            {"user_id": user["user_id"], "product_id": product_id},
            {"$set": {"quantity": quantity}}
        )
    return {"message": "Cart updated"}


@api_router.delete("/cart/{product_id}")
async def remove_from_cart(product_id: str, user: dict = Depends(get_current_user)):
    await db.cart.delete_one({"user_id": user["user_id"], "product_id": product_id})
    return {"message": "Removed from cart"}


@api_router.delete("/cart")
async def clear_cart(user: dict = Depends(get_current_user)):
    await db.cart.delete_many({"user_id": user["user_id"]})
    return {"message": "Cart cleared"}


# ─── Wishlist ───
@api_router.get("/wishlist")
async def get_wishlist(user: dict = Depends(get_current_user)):
    items = await db.wishlist.find({"user_id": user["user_id"]}, {"_id": 0}).to_list(100)
    enriched = []
    for item in items:
        product = await db.products.find_one({"product_id": item["product_id"]}, {"_id": 0})
        if product:
            item["product"] = product
            enriched.append(item)
    return {"items": enriched}


@api_router.post("/wishlist/{product_id}")
async def toggle_wishlist(product_id: str, user: dict = Depends(get_current_user)):
    existing = await db.wishlist.find_one({"user_id": user["user_id"], "product_id": product_id}, {"_id": 0})
    if existing:
        await db.wishlist.delete_one({"user_id": user["user_id"], "product_id": product_id})
        return {"message": "Removed from wishlist", "wishlisted": False}
    else:
        await db.wishlist.insert_one({
            "user_id": user["user_id"],
            "product_id": product_id,
            "added_at": datetime.now(timezone.utc).isoformat()
        })
        return {"message": "Added to wishlist", "wishlisted": True}


@api_router.get("/wishlist/check/{product_id}")
async def check_wishlist(product_id: str, user: dict = Depends(get_current_user)):
    existing = await db.wishlist.find_one({"user_id": user["user_id"], "product_id": product_id}, {"_id": 0})
    return {"wishlisted": existing is not None}


# ─── Reviews ───
@api_router.get("/products/{product_id}/reviews")
async def get_reviews(product_id: str):
    reviews = await db.reviews.find({"product_id": product_id}, {"_id": 0}).sort("created_at", -1).to_list(50)
    return {"reviews": reviews}


@api_router.post("/products/{product_id}/reviews")
async def add_review(product_id: str, request: Request, user: dict = Depends(get_current_user)):
    body = await request.json()
    review_doc = {
        "review_id": f"rev_{uuid.uuid4().hex[:12]}",
        "product_id": product_id,
        "user_id": user["user_id"],
        "user_name": user.get("name", "Anonymous"),
        "user_picture": user.get("picture", ""),
        "rating": body.get("rating", 5),
        "comment": body.get("comment", ""),
        "reaction": body.get("reaction"),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.reviews.insert_one(review_doc)

    all_reviews = await db.reviews.find({"product_id": product_id}, {"_id": 0}).to_list(1000)
    avg = sum(r["rating"] for r in all_reviews) / len(all_reviews) if all_reviews else 0
    likes = sum(1 for r in all_reviews if r.get("reaction") == "like")
    dislikes = sum(1 for r in all_reviews if r.get("reaction") == "dislike")
    await db.products.update_one(
        {"product_id": product_id},
        {"$set": {"rating_avg": round(avg, 1), "rating_count": len(all_reviews), "likes": likes, "dislikes": dislikes}}
    )
    review_doc.pop("_id", None)
    return review_doc


# ─── Orders ───
@api_router.post("/orders")
async def create_order(request: Request, user: dict = Depends(get_current_user)):
    body = await request.json()
    cart_items = await db.cart.find({"user_id": user["user_id"]}, {"_id": 0}).to_list(100)
    if not cart_items:
        raise HTTPException(status_code=400, detail="Cart is empty")

    order_items = []
    total = 0
    for item in cart_items:
        product = await db.products.find_one({"product_id": item["product_id"]}, {"_id": 0})
        if product:
            subtotal = product["price"] * item["quantity"]
            total += subtotal
            order_items.append({
                "product_id": product["product_id"],
                "name": product["name"],
                "price": product["price"],
                "quantity": item["quantity"],
                "image": product["images"][0] if product.get("images") else "",
                "subtotal": round(subtotal, 2)
            })
            await db.products.update_one(
                {"product_id": product["product_id"]},
                {"$inc": {"stock": -item["quantity"]}}
            )

    now = datetime.now(timezone.utc).isoformat()
    order_doc = {
        "order_id": f"ord_{uuid.uuid4().hex[:12]}",
        "user_id": user["user_id"],
        "items": order_items,
        "total": round(total, 2),
        "status": "confirmed",
        "status_history": [{"status": "confirmed", "timestamp": now, "note": "Order placed"}],
        "shipping_address": body.get("shipping_address", {}),
        "payment_method": body.get("payment_method", "cod"),
        "created_at": now
    }
    await db.orders.insert_one(order_doc)
    await db.cart.delete_many({"user_id": user["user_id"]})
    order_doc.pop("_id", None)
    return order_doc


@api_router.get("/orders")
async def list_orders(user: dict = Depends(get_current_user)):
    orders = await db.orders.find({"user_id": user["user_id"]}, {"_id": 0}).sort("created_at", -1).to_list(100)
    return {"orders": orders}


@api_router.get("/orders/{order_id}")
async def get_order(order_id: str, user: dict = Depends(get_current_user)):
    order = await db.orders.find_one({"order_id": order_id, "user_id": user["user_id"]}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    return order


@api_router.post("/orders/{order_id}/cancel")
async def cancel_order(order_id: str, user: dict = Depends(get_current_user)):
    """Customer can cancel their own order, but only if status is 'confirmed'."""
    order = await db.orders.find_one({"order_id": order_id, "user_id": user["user_id"]})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if order["status"] != "confirmed":
        raise HTTPException(status_code=400, detail="Order can only be cancelled while in 'confirmed' status")

    now = datetime.now(timezone.utc).isoformat()
    await db.orders.update_one(
        {"order_id": order_id},
        {
            "$set": {"status": "cancelled"},
            "$push": {"status_history": {"status": "cancelled", "timestamp": now, "note": "Cancelled by customer"}},
        }
    )
    # Restore stock
    for item in order.get("items", []):
        await db.products.update_one(
            {"product_id": item["product_id"]},
            {"$inc": {"stock": item["quantity"]}}
        )
    updated = await db.orders.find_one({"order_id": order_id}, {"_id": 0})
    return updated

# ─── Profile ───
@api_router.put("/profile")
async def update_profile(request: Request, user: dict = Depends(get_current_user)):
    body = await request.json()
    allowed = {"name", "phone", "address"}
    update = {k: v for k, v in body.items() if k in allowed}
    if update:
        await db.users.update_one({"user_id": user["user_id"]}, {"$set": update})
    updated = await db.users.find_one({"user_id": user["user_id"]}, {"_id": 0})
    return updated


# ─── Seed Data ───
@api_router.post("/seed")
async def seed_data():
    count = await db.products.count_documents({})
    if count > 0:
        return {"message": f"Already seeded with {count} products"}

    products = [
        {
            "product_id": "prod_001",
            "name": "Terracotta Bloom Vase",
            "slug": "terracotta-bloom-vase",
            "description": "A sculptural vase with organic curves, perfect for dried botanicals or as a standalone statement piece.",
            "story": "Each vase is hand-thrown on a potter's wheel in our Jaipur studio, then burnished to a warm terracotta finish. No two are exactly alike — slight variations in shape and color are a hallmark of true handcraft.",
            "price": 68.00,
            "original_price": 85.00,
            "category": "Ceramics",
            "material": "Clay",
            "color": "Terracotta",
            "images": [
                "https://images.unsplash.com/photo-1565193566173-7a0ee3dbe261?w=800&q=80",
                "https://images.unsplash.com/photo-1578749556568-bc2c40e68b61?w=800&q=80"
            ],
            "stock": 24,
            "featured": True,
            "rating_avg": 4.8,
            "rating_count": 42,
            "likes": 38,
            "dislikes": 2,
            "created_at": "2025-01-15T10:00:00Z"
        },
        {
            "product_id": "prod_002",
            "name": "Moonlit Stoneware Bowl Set",
            "slug": "moonlit-stoneware-bowl-set",
            "description": "A set of three nesting bowls in a creamy speckled glaze, ideal for everyday dining or display.",
            "story": "Inspired by the soft glow of moonlight on fresh snow, these bowls are glazed using a centuries-old technique passed down through three generations of potters.",
            "price": 45.00,
            "original_price": None,
            "category": "Ceramics",
            "material": "Stoneware",
            "color": "White",
            "images": [
                "https://images.unsplash.com/photo-1610701596007-11502861dcfa?w=800&q=80",
                "https://images.unsplash.com/photo-1565193566173-7a0ee3dbe261?w=800&q=80"
            ],
            "stock": 18,
            "featured": False,
            "rating_avg": 4.6,
            "rating_count": 28,
            "likes": 25,
            "dislikes": 1,
            "created_at": "2025-02-01T10:00:00Z"
        },
        {
            "product_id": "prod_003",
            "name": "Hand-thrown Ceramic Planter",
            "slug": "hand-thrown-ceramic-planter",
            "description": "A minimalist planter with a drainage hole, finished in a sage-green reactive glaze.",
            "story": "Crafted to celebrate the beauty of imperfection, each planter features unique glaze runs that tell the story of fire and earth coming together.",
            "price": 52.00,
            "original_price": 65.00,
            "category": "Ceramics",
            "material": "Clay",
            "color": "Sage",
            "images": [
                "https://images.unsplash.com/photo-1578749556568-bc2c40e68b61?w=800&q=80",
                "https://images.unsplash.com/photo-1610701596007-11502861dcfa?w=800&q=80"
            ],
            "stock": 15,
            "featured": True,
            "rating_avg": 4.7,
            "rating_count": 19,
            "likes": 17,
            "dislikes": 0,
            "created_at": "2025-02-10T10:00:00Z"
        },
        {
            "product_id": "prod_004",
            "name": "Amber Glow Soy Candle",
            "slug": "amber-glow-soy-candle",
            "description": "Hand-poured soy wax candle with notes of amber, sandalwood, and warm vanilla.",
            "story": "Poured in small batches in our Pondicherry workshop, this candle uses 100% natural soy wax and essential oils. The amber glass vessel can be repurposed as a planter.",
            "price": 28.00,
            "original_price": None,
            "category": "Candles & Aromas",
            "material": "Soy Wax",
            "color": "Amber",
            "images": [
                "https://images.unsplash.com/photo-1602607536880-e3e578ff35f4?w=800&q=80",
                "https://images.unsplash.com/photo-1603006905003-be475563bc59?w=800&q=80"
            ],
            "stock": 50,
            "featured": True,
            "rating_avg": 4.9,
            "rating_count": 67,
            "likes": 64,
            "dislikes": 1,
            "created_at": "2025-01-20T10:00:00Z"
        },
        {
            "product_id": "prod_005",
            "name": "Lavender Fields Pillar Candle",
            "slug": "lavender-fields-pillar-candle",
            "description": "A tall beeswax pillar infused with dried lavender buds and French lavender essential oil.",
            "story": "Our artisans hand-roll each pillar candle, embedding real lavender buds into the warm beeswax. Burns for over 60 hours with a calming, floral fragrance.",
            "price": 34.00,
            "original_price": 42.00,
            "category": "Candles & Aromas",
            "material": "Beeswax",
            "color": "Ivory",
            "images": [
                "https://images.unsplash.com/photo-1572726729207-a78d6feb18d7?w=800&q=80",
                "https://images.unsplash.com/photo-1602607536880-e3e578ff35f4?w=800&q=80"
            ],
            "stock": 35,
            "featured": False,
            "rating_avg": 4.5,
            "rating_count": 31,
            "likes": 28,
            "dislikes": 2,
            "created_at": "2025-03-01T10:00:00Z"
        },
        {
            "product_id": "prod_006",
            "name": "Midnight Rose Candle Trio",
            "slug": "midnight-rose-candle-trio",
            "description": "Three votives in blush, rose, and deep mauve — scented with Bulgarian rose and oud.",
            "story": "A celebration of the rose in all its moods. From the softness of dawn to the mystery of midnight, each candle captures a different facet of this timeless flower.",
            "price": 42.00,
            "original_price": None,
            "category": "Candles & Aromas",
            "material": "Soy Wax",
            "color": "Blush",
            "images": [
                "https://images.unsplash.com/photo-1603006905003-be475563bc59?w=800&q=80",
                "https://images.unsplash.com/photo-1572726729207-a78d6feb18d7?w=800&q=80"
            ],
            "stock": 28,
            "featured": True,
            "rating_avg": 4.7,
            "rating_count": 23,
            "likes": 21,
            "dislikes": 0,
            "created_at": "2025-03-05T10:00:00Z"
        },
        {
            "product_id": "prod_007",
            "name": "Desert Wind Macrame",
            "slug": "desert-wind-macrame",
            "description": "A large-scale wall hanging in natural cotton cord with geometric knotwork patterns.",
            "story": "Knotted by hand over three days, this macrame piece draws inspiration from the wind-sculpted dunes of the Thar desert. Each knot holds intention and care.",
            "price": 78.00,
            "original_price": 95.00,
            "category": "Wall Decor",
            "material": "Cotton",
            "color": "Natural",
            "images": [
                "https://images.unsplash.com/photo-1513519245088-0e12902e35ca?w=800&q=80",
                "https://images.unsplash.com/photo-1520038410233-7141be7e6f97?w=800&q=80"
            ],
            "stock": 10,
            "featured": True,
            "rating_avg": 4.9,
            "rating_count": 15,
            "likes": 14,
            "dislikes": 0,
            "created_at": "2025-01-25T10:00:00Z"
        },
        {
            "product_id": "prod_008",
            "name": "Woven Sunburst Tapestry",
            "slug": "woven-sunburst-tapestry",
            "description": "A handwoven wool tapestry with a radial sunburst design in earthy tones.",
            "story": "Woven on a traditional frame loom by artisans in Kutch, Gujarat, using naturally dyed wool. The sunburst pattern symbolizes new beginnings and warmth.",
            "price": 95.00,
            "original_price": None,
            "category": "Wall Decor",
            "material": "Wool",
            "color": "Earth Tones",
            "images": [
                "https://images.unsplash.com/photo-1520038410233-7141be7e6f97?w=800&q=80",
                "https://images.unsplash.com/photo-1513519245088-0e12902e35ca?w=800&q=80"
            ],
            "stock": 8,
            "featured": False,
            "rating_avg": 4.8,
            "rating_count": 11,
            "likes": 10,
            "dislikes": 0,
            "created_at": "2025-02-15T10:00:00Z"
        },
        {
            "product_id": "prod_009",
            "name": "Botanical Press Wall Art",
            "slug": "botanical-press-wall-art",
            "description": "Pressed wildflowers arranged and framed between two sheets of handmade paper.",
            "story": "Each piece features real wildflowers foraged from the Western Ghats, carefully pressed and arranged by hand. Framed in sustainably sourced teak wood.",
            "price": 56.00,
            "original_price": None,
            "category": "Wall Decor",
            "material": "Paper & Wood",
            "color": "Natural",
            "images": [
                "https://images.unsplash.com/photo-1511877448058-cbf344a6a85a?w=800&q=80",
                "https://images.unsplash.com/photo-1520038410233-7141be7e6f97?w=800&q=80"
            ],
            "stock": 20,
            "featured": False,
            "rating_avg": 4.4,
            "rating_count": 16,
            "likes": 14,
            "dislikes": 1,
            "created_at": "2025-03-10T10:00:00Z"
        },
        {
            "product_id": "prod_010",
            "name": "Cloud Linen Throw",
            "slug": "cloud-linen-throw",
            "description": "A lightweight, stone-washed linen throw in a soft oatmeal hue with hand-knotted fringe.",
            "story": "Woven from European flax and stone-washed for ultimate softness. The oatmeal color comes from the natural flax fiber — no dyes, no chemicals, just pure linen.",
            "price": 89.00,
            "original_price": 110.00,
            "category": "Textiles",
            "material": "Linen",
            "color": "Oatmeal",
            "images": [
                "https://images.unsplash.com/photo-1540730930241-c9c3a32395f7?w=800&q=80",
                "https://images.unsplash.com/photo-1558618666-fcd25c85f82e?w=800&q=80"
            ],
            "stock": 12,
            "featured": True,
            "rating_avg": 4.9,
            "rating_count": 38,
            "likes": 36,
            "dislikes": 0,
            "created_at": "2025-01-10T10:00:00Z"
        },
        {
            "product_id": "prod_011",
            "name": "Hand-dyed Indigo Cushion",
            "slug": "hand-dyed-indigo-cushion",
            "description": "A square cushion cover hand-dyed using traditional Shibori techniques in deep indigo.",
            "story": "Dipped and folded by hand using the ancient Japanese art of Shibori, each cushion carries a unique pattern born from the interplay of cloth and indigo dye.",
            "price": 38.00,
            "original_price": None,
            "category": "Textiles",
            "material": "Cotton",
            "color": "Indigo",
            "images": [
                "https://images.unsplash.com/photo-1558618666-fcd25c85f82e?w=800&q=80",
                "https://images.unsplash.com/photo-1540730930241-c9c3a32395f7?w=800&q=80"
            ],
            "stock": 30,
            "featured": False,
            "rating_avg": 4.3,
            "rating_count": 22,
            "likes": 19,
            "dislikes": 2,
            "created_at": "2025-02-20T10:00:00Z"
        },
        {
            "product_id": "prod_012",
            "name": "Moroccan Weave Pillow",
            "slug": "moroccan-weave-pillow",
            "description": "A textured pillow with handwoven geometric patterns in warm terracotta and cream.",
            "story": "Inspired by traditional Moroccan kilim patterns, this pillow is woven on handlooms by women artisans in Rajasthan, blending two rich textile traditions.",
            "price": 44.00,
            "original_price": 55.00,
            "category": "Textiles",
            "material": "Cotton & Wool",
            "color": "Terracotta",
            "images": [
                "https://images.unsplash.com/photo-1540730930241-c9c3a32395f7?w=800&q=80",
                "https://images.unsplash.com/photo-1558618666-fcd25c85f82e?w=800&q=80"
            ],
            "stock": 22,
            "featured": False,
            "rating_avg": 4.6,
            "rating_count": 14,
            "likes": 12,
            "dislikes": 1,
            "created_at": "2025-03-15T10:00:00Z"
        },
        {
            "product_id": "prod_013",
            "name": "Harvest Crochet Basket",
            "slug": "harvest-crochet-basket",
            "description": "A sturdy yet soft crochet basket in natural cotton, perfect for storage or as a planter cover.",
            "story": "Crocheted by hand using thick organic cotton rope. Each basket takes an entire day to complete, resulting in a dense, durable weave that softens beautifully with use.",
            "price": 36.00,
            "original_price": None,
            "category": "Crochet",
            "material": "Cotton",
            "color": "Natural",
            "images": [
                "https://images.unsplash.com/photo-1594040226829-7f251ab46d80?w=800&q=80",
                "https://images.unsplash.com/photo-1513519245088-0e12902e35ca?w=800&q=80"
            ],
            "stock": 25,
            "featured": False,
            "rating_avg": 4.5,
            "rating_count": 20,
            "likes": 18,
            "dislikes": 1,
            "created_at": "2025-02-25T10:00:00Z"
        },
        {
            "product_id": "prod_014",
            "name": "Boho Crochet Coasters",
            "slug": "boho-crochet-coasters",
            "description": "A set of six handmade crochet coasters in a mix of earthy tones — perfect for gifting.",
            "story": "Each coaster features a different mandala pattern, crocheted with fine cotton yarn in our signature earth-tone palette. A small, meaningful gift for any home.",
            "price": 22.00,
            "original_price": None,
            "category": "Crochet",
            "material": "Cotton",
            "color": "Multicolor",
            "images": [
                "https://images.unsplash.com/photo-1631125915902-d8abe9225ff2?w=800&q=80",
                "https://images.unsplash.com/photo-1594040226829-7f251ab46d80?w=800&q=80"
            ],
            "stock": 40,
            "featured": False,
            "rating_avg": 4.7,
            "rating_count": 35,
            "likes": 33,
            "dislikes": 0,
            "created_at": "2025-03-20T10:00:00Z"
        },
        {
            "product_id": "prod_015",
            "name": "Crochet Table Runner",
            "slug": "crochet-table-runner",
            "description": "An elegant cream crochet table runner with intricate lace-like patterns.",
            "story": "A labor of love that takes our most skilled artisan over a week to complete. The intricate patterns are inspired by vintage European lace, reimagined with Indian cotton.",
            "price": 48.00,
            "original_price": 60.00,
            "category": "Crochet",
            "material": "Cotton",
            "color": "Cream",
            "images": [
                "https://images.unsplash.com/photo-1594040226829-7f251ab46d80?w=800&q=80",
                "https://images.unsplash.com/photo-1631125915902-d8abe9225ff2?w=800&q=80"
            ],
            "stock": 14,
            "featured": True,
            "rating_avg": 4.8,
            "rating_count": 9,
            "likes": 8,
            "dislikes": 0,
            "created_at": "2025-01-30T10:00:00Z"
        },
        {
            "product_id": "prod_016",
            "name": "Minimalist Ceramic Mug Set",
            "slug": "minimalist-ceramic-mug-set",
            "description": "A pair of handcrafted ceramic mugs with a speckled white glaze and raw clay base.",
            "story": "These mugs are designed for that quiet morning ritual. The exposed clay base connects you to the earth, while the speckled glaze adds a touch of quiet elegance.",
            "price": 32.00,
            "original_price": None,
            "category": "Ceramics",
            "material": "Stoneware",
            "color": "Speckled White",
            "images": [
                "https://images.unsplash.com/photo-1610701596007-11502861dcfa?w=800&q=80",
                "https://images.unsplash.com/photo-1565193566173-7a0ee3dbe261?w=800&q=80"
            ],
            "stock": 32,
            "featured": False,
            "rating_avg": 4.6,
            "rating_count": 44,
            "likes": 40,
            "dislikes": 2,
            "created_at": "2025-03-25T10:00:00Z"
        }
    ]
    await db.products.insert_many(products)
    return {"message": f"Seeded {len(products)} products"}


# ─── Payment (Razorpay) ───
@api_router.post("/payment/create-order")
async def create_payment_order(request: Request, user: dict = Depends(get_current_user)):
    body = await request.json()
    amount = body.get("amount", 0)
    try:
        razorpay_order = razorpay_client.order.create({
            "amount": int(float(amount) * 100),
            "currency": "INR",
            "payment_capture": 1,
            "receipt": f"rcpt_{uuid.uuid4().hex[:8]}"
        })
        return {
            "order_id": razorpay_order["id"],
            "amount": razorpay_order["amount"],
            "currency": razorpay_order["currency"]
        }
    except Exception as e:
        logger.error(f"Razorpay order creation failed: {e}")
        raise HTTPException(status_code=500, detail="Payment order creation failed")


@api_router.post("/payment/verify")
async def verify_payment(request: Request, user: dict = Depends(get_current_user)):
    body = await request.json()
    try:
        razorpay_client.utility.verify_payment_signature({
            'razorpay_order_id': body['razorpay_order_id'],
            'razorpay_payment_id': body['razorpay_payment_id'],
            'razorpay_signature': body['razorpay_signature']
        })
    except Exception:
        raise HTTPException(status_code=400, detail="Payment verification failed")

    cart_items = await db.cart.find({"user_id": user["user_id"]}, {"_id": 0}).to_list(100)
    if not cart_items:
        raise HTTPException(status_code=400, detail="Cart is empty")

    order_items = []
    total = 0
    for item in cart_items:
        product = await db.products.find_one({"product_id": item["product_id"]}, {"_id": 0})
        if product:
            subtotal = product["price"] * item["quantity"]
            total += subtotal
            order_items.append({
                "product_id": product["product_id"],
                "name": product["name"],
                "price": product["price"],
                "quantity": item["quantity"],
                "image": product["images"][0] if product.get("images") else "",
                "subtotal": round(subtotal, 2)
            })
            await db.products.update_one(
                {"product_id": product["product_id"]},
                {"$inc": {"stock": -item["quantity"]}}
            )

    order_doc = {
        "order_id": f"ord_{uuid.uuid4().hex[:12]}",
        "user_id": user["user_id"],
        "items": order_items,
        "total": round(total, 2),
        "status": "confirmed",
        "payment_method": "razorpay",
        "razorpay_order_id": body.get("razorpay_order_id"),
        "razorpay_payment_id": body.get("razorpay_payment_id"),
        "shipping_address": body.get("shipping_address", {}),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.orders.insert_one(order_doc)
    await db.cart.delete_many({"user_id": user["user_id"]})
    order_doc.pop("_id", None)
    return order_doc


# ─── Referral System ───
@api_router.get("/referral/stats")
async def get_referral_stats(user: dict = Depends(get_current_user)):
    return {
        "referral_code": user.get("referral_code", ""),
        "referral_count": user.get("referral_count", 0),
    }


@api_router.post("/referral/apply")
async def apply_referral(request: Request, user: dict = Depends(get_current_user)):
    body = await request.json()
    code = body.get("code", "").strip()
    if not code:
        raise HTTPException(status_code=400, detail="Referral code required")

    referrer = await db.users.find_one({"referral_code": code}, {"_id": 0})
    if not referrer:
        raise HTTPException(status_code=404, detail="Invalid referral code")
    if referrer["user_id"] == user["user_id"]:
        raise HTTPException(status_code=400, detail="Cannot use your own referral code")
    if user.get("referred_by"):
        raise HTTPException(status_code=400, detail="You have already used a referral code")

    await db.users.update_one(
        {"user_id": user["user_id"]},
        {"$set": {"referred_by": referrer["user_id"]}}
    )
    await db.users.update_one(
        {"user_id": referrer["user_id"]},
        {"$inc": {"referral_count": 1}}
    )
    return {"message": "Referral applied! Both you and your friend earn 10% off your next order."}


# ─── Image Normalization Helper ───
def normalize_images(images):
    """Convert image list to [{url, source}] format. Handles legacy string arrays."""
    if not images:
        return []
    result = []
    for img in images:
        if isinstance(img, str):
            result.append({"url": img, "source": "external"})
        elif isinstance(img, dict) and "url" in img:
            result.append(img)
    return result


# ─── Admin Endpoints ───

@api_router.get("/admin/users")
async def admin_list_users(
    page: int = 1,
    limit: int = 20,
    search: Optional[str] = None,
    admin: dict = Depends(get_admin_user)
):
    query = {}
    if search:
        query["$or"] = [
            {"name": {"$regex": search, "$options": "i"}},
            {"email": {"$regex": search, "$options": "i"}}
        ]
    total = await db.users.count_documents(query)
    skip = (page - 1) * limit
    users = await db.users.find(query, {"_id": 0}).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    return {"users": users, "total": total, "page": page, "pages": max(1, (total + limit - 1) // limit)}


@api_router.put("/admin/users/{user_id}/role")
async def admin_update_user_role(user_id: str, request: Request, admin: dict = Depends(get_admin_user)):
    body = await request.json()
    is_admin = bool(body.get("is_admin", False))
    
    # Prevent admin from removing their own admin status to avoid locking out the system
    if user_id == admin.get("user_id") and not is_admin:
        raise HTTPException(status_code=400, detail="Cannot remove your own admin privileges")

    user = await db.users.find_one({"user_id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    await db.users.update_one(
        {"user_id": user_id},
        {"$set": {"is_admin": is_admin}}
    )
    
    updated_user = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    return updated_user


@api_router.get("/admin/stats")
async def admin_stats(admin: dict = Depends(get_admin_user)):
    total_products = await db.products.count_documents({})
    total_orders = await db.orders.count_documents({})
    total_users = await db.users.count_documents({})

    # Revenue
    pipeline = [{"$group": {"_id": None, "revenue": {"$sum": "$total"}}}]
    rev = await db.orders.aggregate(pipeline).to_list(1)
    revenue = rev[0]["revenue"] if rev else 0

    # Recent orders
    recent = await db.orders.find({}, {"_id": 0}).sort("created_at", -1).limit(5).to_list(5)

    # Orders by status
    status_pipeline = [{"$group": {"_id": "$status", "count": {"$sum": 1}}}]
    status_agg = await db.orders.aggregate(status_pipeline).to_list(20)
    orders_by_status = {item["_id"]: item["count"] for item in status_agg}

    return {
        "total_products": total_products,
        "total_orders": total_orders,
        "total_users": total_users,
        "revenue": round(revenue, 2),
        "recent_orders": recent,
        "orders_by_status": orders_by_status,
    }


@api_router.get("/admin/products")
async def admin_list_products(
    page: int = 1,
    limit: int = 20,
    search: Optional[str] = None,
    admin: dict = Depends(get_admin_user),
):
    query = {}
    if search:
        query["$or"] = [
            {"name": {"$regex": search, "$options": "i"}},
            {"product_id": {"$regex": search, "$options": "i"}},
        ]
    total = await db.products.count_documents(query)
    skip = (page - 1) * limit
    products = await db.products.find(query, {"_id": 0}).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    # Normalize images
    for p in products:
        p["images"] = normalize_images(p.get("images", []))
    return {"products": products, "total": total, "page": page, "pages": max(1, (total + limit - 1) // limit)}


@api_router.post("/admin/products")
async def admin_create_product(request: Request, admin: dict = Depends(get_admin_user)):
    body = await request.json()
    product_id = f"prod_{uuid.uuid4().hex[:6]}"
    slug = body.get("name", "product").lower().replace(" ", "-").replace("'", "")

    product = {
        "product_id": product_id,
        "name": body.get("name", ""),
        "slug": slug,
        "description": body.get("description", ""),
        "story": body.get("story", ""),
        "price": float(body.get("price", 0)),
        "original_price": float(body["original_price"]) if body.get("original_price") else None,
        "category": body.get("category", ""),
        "material": body.get("material", ""),
        "color": body.get("color", ""),
        "images": normalize_images(body.get("images", [])),
        "stock": int(body.get("stock", 0)),
        "featured": bool(body.get("featured", False)),
        "rating_avg": 0,
        "rating_count": 0,
        "likes": 0,
        "dislikes": 0,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.products.insert_one(product)
    product.pop("_id", None)
    return product


@api_router.put("/admin/products/{product_id}")
async def admin_update_product(product_id: str, request: Request, admin: dict = Depends(get_admin_user)):
    body = await request.json()
    existing = await db.products.find_one({"product_id": product_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Product not found")

    allowed = {"name", "description", "story", "price", "original_price", "category",
               "material", "color", "images", "stock", "featured"}
    update = {}
    for k, v in body.items():
        if k in allowed:
            if k == "images":
                update[k] = normalize_images(v)
            elif k == "price":
                update[k] = float(v)
            elif k == "original_price":
                update[k] = float(v) if v else None
            elif k == "stock":
                update[k] = int(v)
            elif k == "featured":
                update[k] = bool(v)
            else:
                update[k] = v

    if "name" in update:
        update["slug"] = update["name"].lower().replace(" ", "-").replace("'", "")

    if update:
        await db.products.update_one({"product_id": product_id}, {"$set": update})

    product = await db.products.find_one({"product_id": product_id}, {"_id": 0})
    product["images"] = normalize_images(product.get("images", []))
    return product


@api_router.delete("/admin/products/{product_id}")
async def admin_delete_product(product_id: str, admin: dict = Depends(get_admin_user)):
    result = await db.products.delete_one({"product_id": product_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Product not found")
    # Also clean up related data
    await db.cart.delete_many({"product_id": product_id})
    await db.wishlist.delete_many({"product_id": product_id})
    return {"message": "Product deleted"}


@api_router.get("/admin/orders")
async def admin_list_orders(
    page: int = 1,
    limit: int = 20,
    status: Optional[str] = None,
    admin: dict = Depends(get_admin_user),
):
    query = {}
    if status:
        query["status"] = status
    total = await db.orders.count_documents(query)
    skip = (page - 1) * limit
    orders = await db.orders.find(query, {"_id": 0}).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)

    # Enrich with user info
    for order in orders:
        user = await db.users.find_one({"user_id": order.get("user_id")}, {"_id": 0, "name": 1, "email": 1})
        order["user_name"] = user.get("name", "Unknown") if user else "Unknown"
        order["user_email"] = user.get("email", "") if user else ""

    return {"orders": orders, "total": total, "page": page, "pages": max(1, (total + limit - 1) // limit)}


@api_router.put("/admin/orders/{order_id}/status")
async def admin_update_order_status(order_id: str, request: Request, admin: dict = Depends(get_admin_user)):
    body = await request.json()
    new_status = body.get("status")
    note = body.get("note", "")
    valid_statuses = ["confirmed", "processing", "shipped", "delivered", "cancelled"]
    if new_status not in valid_statuses:
        raise HTTPException(status_code=400, detail=f"Invalid status. Must be one of: {valid_statuses}")

    order = await db.orders.find_one({"order_id": order_id})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    # Append to status_history
    history_entry = {
        "status": new_status,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "note": note,
        "updated_by": admin.get("email", "admin"),
    }

    await db.orders.update_one(
        {"order_id": order_id},
        {
            "$set": {"status": new_status},
            "$push": {"status_history": history_entry},
        }
    )

    # If cancelling, restore stock
    if new_status == "cancelled":
        for item in order.get("items", []):
            await db.products.update_one(
                {"product_id": item["product_id"]},
                {"$inc": {"stock": item["quantity"]}}
            )

    updated = await db.orders.find_one({"order_id": order_id}, {"_id": 0})
    return updated


# ─── Cloudinary Upload ───
import cloudinary
import cloudinary.uploader
import asyncio

@api_router.post("/admin/upload")
async def admin_upload_image(request: Request, admin: dict = Depends(get_admin_user)):
    """Upload an image to Cloudinary. Returns {url, source: 'cloudinary'}."""
    cloud_name = os.environ.get("CLOUDINARY_CLOUD_NAME", "")
    api_key = os.environ.get("CLOUDINARY_API_KEY", "")
    api_secret = os.environ.get("CLOUDINARY_API_SECRET", "")

    if not all([cloud_name, api_key, api_secret]):
        raise HTTPException(status_code=501, detail="Cloudinary is not configured. Add CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET to .env")

    cloudinary.config(cloud_name=cloud_name, api_key=api_key, api_secret=api_secret, secure=True)

    form = await request.form()
    file = form.get("file")
    if not file:
        raise HTTPException(status_code=400, detail="No file uploaded")

    contents = await file.read()
    
    loop = asyncio.get_event_loop()
    try:
        result = await loop.run_in_executor(None, lambda: cloudinary.uploader.upload(contents, folder="artisianaura/products"))
    except Exception as e:
        logger.error(f"Cloudinary upload failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

    return {"url": result["secure_url"], "source": "cloudinary", "public_id": result.get("public_id")}


# ─── Include router & middleware ───
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
