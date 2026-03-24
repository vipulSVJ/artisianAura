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

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

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


# ─── Auth Endpoints ───
@api_router.post("/auth/session")
async def exchange_session(request: Request, response: Response):
    body = await request.json()
    session_id = body.get("session_id")
    if not session_id:
        raise HTTPException(status_code=400, detail="session_id required")

    # REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
    async with httpx.AsyncClient() as http_client:
        resp = await http_client.get(
            "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
            headers={"X-Session-ID": session_id}
        )
        if resp.status_code != 200:
            raise HTTPException(status_code=401, detail="Invalid session")
        data = resp.json()

    email = data["email"]
    existing = await db.users.find_one({"email": email}, {"_id": 0})
    if existing:
        user_id = existing["user_id"]
        await db.users.update_one(
            {"email": email},
            {"$set": {"name": data["name"], "picture": data.get("picture", "")}}
        )
    else:
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        await db.users.insert_one({
            "user_id": user_id,
            "email": email,
            "name": data["name"],
            "picture": data.get("picture", ""),
            "phone": "",
            "address": {},
            "created_at": datetime.now(timezone.utc).isoformat()
        })

    session_token = data.get("session_token", f"st_{uuid.uuid4().hex}")
    await db.user_sessions.insert_one({
        "user_id": user_id,
        "session_token": session_token,
        "expires_at": (datetime.now(timezone.utc) + timedelta(days=7)).isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat()
    })

    response.set_cookie(
        key="session_token", value=session_token,
        httponly=True, secure=True, samesite="none", path="/", max_age=7 * 24 * 60 * 60
    )
    user = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    return user


@api_router.get("/auth/me")
async def get_me(user: dict = Depends(get_current_user)):
    return user


@api_router.post("/auth/logout")
async def logout(request: Request, response: Response):
    session_token = request.cookies.get("session_token")
    if session_token:
        await db.user_sessions.delete_one({"session_token": session_token})
    response.delete_cookie("session_token", path="/", secure=True, samesite="none")
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

    order_doc = {
        "order_id": f"ord_{uuid.uuid4().hex[:12]}",
        "user_id": user["user_id"],
        "items": order_items,
        "total": round(total, 2),
        "status": "confirmed",
        "shipping_address": body.get("shipping_address", {}),
        "payment_method": body.get("payment_method", "cod"),
        "created_at": datetime.now(timezone.utc).isoformat()
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
