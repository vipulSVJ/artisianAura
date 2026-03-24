# Artisan & Aura — PRD

## Problem Statement
Build a production-ready e-commerce web application for an interior decor brand selling aesthetic, handmade, artisanal products (candles, wall decor, ceramics, crochet items). Visually stunning, minimal, emotionally engaging UI reflecting craftsmanship, warmth, and premium quality.

## Architecture
- **Frontend**: React.js + Tailwind CSS + Shadcn/UI + Framer Motion
- **Backend**: FastAPI + MongoDB (Motor async driver)
- **Auth**: Emergent Google OAuth Social Login + Session-based auth
- **Payment**: Razorpay (integration-ready, currently mock/COD)
- **Fonts**: Cormorant Garamond (headings) + Manrope (body) + Playfair Display (accent)

## User Personas
1. **Design-conscious consumer**: Appreciates handmade, artisanal home decor. Browses collections, adds to wishlist, makes purchases.
2. **Gift buyer**: Searches by category/material, checks reviews, uses social sharing.
3. **Returning customer**: Checks order history, manages profile, re-orders.

## Core Requirements (Static)
- Product catalog with categories, filters, sorting, pagination
- User authentication (Google Social Login)
- Cart system (persistent, per user)
- Wishlist system (toggle)
- Order management (create from cart, history)
- Review/rating system per product
- Social sharing (WhatsApp, Pinterest, Instagram)
- Multi-step checkout flow
- User profile management
- Mock Instagram feed / social proof section

## What's Been Implemented (March 24, 2025)
### Backend (FastAPI + MongoDB)
- Auth endpoints: session exchange, /me, logout
- Products: list (filters/sort/pagination), detail, categories, filters
- Cart: full CRUD (add, update, remove, clear)
- Wishlist: toggle, check, list
- Reviews: add, list per product with rating aggregation
- Orders: create from cart, list, detail
- Profile: update (name, phone, address)
- Seed data: 16 artisanal products across 5 categories

### Frontend (React)
- Landing Page: hero section, collections bento grid, featured products, brand story, social proof Instagram grid, newsletter CTA
- Product Listing Page: search, sort, category/material/color filters, pagination
- Product Detail Page: image gallery, story section, quantity selector, add to cart, wishlist toggle, social share (WhatsApp/Pinterest/Instagram), reviews
- Cart Page: item management, order summary, checkout CTA
- Wishlist Page: saved items, move to cart
- Checkout Page: 3-step flow (shipping, review, confirmation)
- Order History Page: order list with status badges
- Profile Page: edit info, quick links to orders/wishlist
- Auth Callback: Google OAuth session exchange
- Navbar: sticky blur, responsive, cart badge
- Footer: multi-column, social links

### Design
- Warm stone/beige palette (#FDFBF7 background, #D4A373 accent)
- Framer Motion animations throughout
- Responsive mobile-first design
- Lazy loaded images

## P0 (Done)
- [x] Product catalog + browsing
- [x] Auth (Google Social Login)
- [x] Cart + Wishlist
- [x] Orders + Checkout
- [x] Reviews
- [x] Social sharing
- [x] Landing page with all sections

## P1 (Next)
- [ ] Razorpay payment integration (needs API keys)
- [ ] Real Instagram API feed
- [ ] User-uploaded product photos (UGC "Styled by You")
- [ ] Influencer/creator curated collections
- [ ] Image upload for user profiles

## P2 (Future)
- [ ] Dark mode toggle
- [ ] Product recommendations (AI-powered)
- [ ] Advanced search with autocomplete
- [ ] Order tracking with status updates
- [ ] Email notifications (order confirmation, shipping)
- [ ] Admin dashboard for product management
- [ ] Redis caching for product listings
- [ ] CDN for image delivery
- [ ] SEO optimization

## API Endpoints
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | /api/auth/session | No | Exchange session_id for token |
| GET | /api/auth/me | Yes | Get current user |
| POST | /api/auth/logout | Yes | Logout |
| GET | /api/products | No | List products (filters/sort/page) |
| GET | /api/products/{id} | No | Product detail |
| GET | /api/categories | No | List categories |
| GET | /api/filters | No | Get filter options |
| GET | /api/cart | Yes | Get cart |
| POST | /api/cart | Yes | Add to cart |
| PUT | /api/cart/{product_id} | Yes | Update quantity |
| DELETE | /api/cart/{product_id} | Yes | Remove from cart |
| DELETE | /api/cart | Yes | Clear cart |
| GET | /api/wishlist | Yes | Get wishlist |
| POST | /api/wishlist/{product_id} | Yes | Toggle wishlist |
| GET | /api/wishlist/check/{product_id} | Yes | Check wishlist status |
| GET | /api/products/{id}/reviews | No | Get reviews |
| POST | /api/products/{id}/reviews | Yes | Add review |
| POST | /api/orders | Yes | Create order |
| GET | /api/orders | Yes | List orders |
| GET | /api/orders/{id} | Yes | Order detail |
| PUT | /api/profile | Yes | Update profile |
| POST | /api/seed | No | Seed sample data |
