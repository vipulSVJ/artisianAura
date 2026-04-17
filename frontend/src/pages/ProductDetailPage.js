import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Heart, ShoppingBag, Share2, Star, ThumbsUp, ThumbsDown, ChevronLeft, Minus, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { useAuth } from '@/contexts/AuthContext';
import { useCart } from '@/contexts/CartContext';
import { toast } from 'sonner';
import API from '@/lib/api';

export default function ProductDetailPage() {
  const { productId } = useParams();
  const { user, login } = useAuth();
  const { addToCart } = useCart();
  const [product, setProduct] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [selectedImage, setSelectedImage] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [wishlisted, setWishlisted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [reviewText, setReviewText] = useState('');
  const [reviewRating, setReviewRating] = useState(5);
  const [shareOpen, setShareOpen] = useState(false);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [prodRes, revRes] = await Promise.all([
          API.get(`/products/${productId}`),
          API.get(`/products/${productId}/reviews`)
        ]);
        setProduct(prodRes.data);
        setReviews(revRes.data.reviews || []);
        if (user) {
          try {
            const wishRes = await API.get(`/wishlist/check/${productId}`);
            setWishlisted(wishRes.data.wishlisted);
          } catch { /* ignore */ }
        }
      } catch { /* ignore */ }
      setLoading(false);
    };
    load();
  }, [productId, user]);

  const handleAddToCart = async () => {
    if (!user) { login(); return; }
    const success = await addToCart(product.product_id, quantity);
    if (success) toast.success('Added to cart');
  };

  const handleWishlist = async () => {
    if (!user) { login(); return; }
    try {
      const res = await API.post(`/wishlist/${product.product_id}`);
      setWishlisted(res.data.wishlisted);
      toast.success(res.data.wishlisted ? 'Added to wishlist' : 'Removed from wishlist');
    } catch { /* ignore */ }
  };

  const handleReview = async () => {
    if (!user) { login(); return; }
    if (!reviewText.trim()) return;
    try {
      const res = await API.post(`/products/${product.product_id}/reviews`, {
        rating: reviewRating, comment: reviewText
      });
      setReviews(prev => [res.data, ...prev]);
      setReviewText('');
      toast.success('Review submitted');
    } catch { /* ignore */ }
  };

  const shareUrl = typeof window !== 'undefined' ? window.location.href : '';
  const shareText = product ? `Check out ${product.name} from Artisan & Aura!` : '';

  if (loading) {
    return (
      <div className="pt-24 pb-20 max-w-7xl mx-auto px-6 md:px-12">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 animate-pulse">
          <div className="aspect-[3/4] bg-stone-100 rounded-2xl" />
          <div className="space-y-6 pt-8">
            <div className="h-4 bg-stone-100 rounded w-1/4" />
            <div className="h-10 bg-stone-100 rounded w-3/4" />
            <div className="h-6 bg-stone-100 rounded w-1/3" />
            <div className="h-32 bg-stone-100 rounded" />
          </div>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="pt-24 pb-20 text-center">
        <p className="text-stone-500">Product not found</p>
        <Link to="/shop" className="text-[#D4A373] underline mt-4 inline-block">Back to shop</Link>
      </div>
    );
  }

  return (
    <div className="pt-24 pb-20" data-testid="product-detail-page">
      <div className="max-w-7xl mx-auto px-6 md:px-12">
        {/* Breadcrumb */}
        <Link to="/shop" className="inline-flex items-center gap-2 text-xs uppercase tracking-widest text-stone-500 hover:text-stone-900 mb-8 transition-colors" data-testid="back-to-shop">
          <ChevronLeft size={14} /> Back to Shop
        </Link>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20">
          {/* Image Gallery */}
          <motion.div initial={{ opacity: 0, x: -30 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.6 }}>
            <div className="aspect-[3/4] overflow-hidden rounded-2xl bg-stone-100 mb-4">
              <img
                src={product.images?.[selectedImage]}
                alt={product.name}
                className="w-full h-full object-cover"
                data-testid="product-main-image"
              />
            </div>
            {product.images?.length > 1 && (
              <div className="flex gap-3">
                {product.images.map((img, i) => (
                  <button
                    key={i}
                    onClick={() => setSelectedImage(i)}
                    className={`w-20 h-20 rounded-xl overflow-hidden border-2 transition-colors ${
                      selectedImage === i ? 'border-[#D4A373]' : 'border-transparent'
                    }`}
                    data-testid={`thumbnail-${i}`}
                  >
                    <img src={img} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </motion.div>

          {/* Product Info */}
          <motion.div initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.6 }} className="pt-4">
            <p className="text-xs uppercase tracking-[0.3em] text-[#D4A373] mb-3 font-medium">{product.category}</p>
            <h1 className="font-heading text-4xl md:text-5xl font-light text-stone-900 leading-tight mb-4" data-testid="product-name">
              {product.name}
            </h1>

            {/* Rating */}
            <div className="flex items-center gap-3 mb-6">
              <div className="flex">
                {[1, 2, 3, 4, 5].map(star => (
                  <Star key={star} size={16} className={star <= Math.round(product.rating_avg) ? 'text-[#D4A373] fill-[#D4A373]' : 'text-stone-300'} />
                ))}
              </div>
              <span className="text-sm text-stone-500">{product.rating_avg} ({product.rating_count} reviews)</span>
            </div>

            {/* Price */}
            <div className="flex items-center gap-3 mb-8">
              <span className="text-3xl font-light text-stone-900" data-testid="product-price">₹{product.price.toFixed(2)}</span>
              {product.original_price && (
                <span className="text-lg text-stone-400 line-through">₹{product.original_price.toFixed(2)}</span>
              )}
            </div>

            {/* Description */}
            <p className="text-base text-stone-600 font-light leading-relaxed mb-6">{product.description}</p>

            {/* Story */}
            <div className="bg-stone-50 rounded-2xl p-6 mb-8">
              <p className="text-xs uppercase tracking-[0.2em] text-[#D4A373] mb-2 font-medium">The Story</p>
              <p className="text-sm text-stone-600 font-light leading-relaxed italic font-heading text-base">{product.story}</p>
            </div>

            {/* Details */}
            <div className="flex gap-8 text-sm text-stone-500 mb-8">
              <div><span className="text-stone-900 font-medium">Material:</span> {product.material}</div>
              <div><span className="text-stone-900 font-medium">Color:</span> {product.color}</div>
            </div>

            {/* Stock */}
            <p className={`text-sm mb-8 ${product.stock > 5 ? 'text-emerald-600' : product.stock > 0 ? 'text-amber-600' : 'text-red-500'}`} data-testid="stock-status">
              {product.stock > 5 ? 'In Stock' : product.stock > 0 ? `Only ${product.stock} left` : 'Out of Stock'}
            </p>

            <Separator className="mb-8" />

            {/* Quantity + Add to Cart */}
            <div className="flex items-center gap-4 mb-6">
              <div className="flex items-center border border-stone-200 rounded-full">
                <button
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  className="p-3 text-stone-500 hover:text-stone-900 transition-colors"
                  data-testid="quantity-decrease"
                >
                  <Minus size={16} />
                </button>
                <span className="w-12 text-center text-sm font-medium" data-testid="quantity-display">{quantity}</span>
                <button
                  onClick={() => setQuantity(quantity + 1)}
                  className="p-3 text-stone-500 hover:text-stone-900 transition-colors"
                  data-testid="quantity-increase"
                >
                  <Plus size={16} />
                </button>
              </div>
              <Button
                onClick={handleAddToCart}
                disabled={product.stock === 0}
                className="flex-1 bg-stone-900 text-white hover:bg-stone-800 rounded-full py-6 text-xs uppercase tracking-[0.2em]"
                data-testid="add-to-cart-btn"
              >
                <ShoppingBag size={16} className="mr-2" /> Add to Cart
              </Button>
            </div>

            {/* Wishlist + Share */}
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={handleWishlist}
                className={`rounded-full px-6 py-5 text-xs uppercase tracking-wider border-stone-300 ${wishlisted ? 'bg-[#D4A373]/10 border-[#D4A373] text-[#D4A373]' : ''}`}
                data-testid="wishlist-toggle-btn"
              >
                <Heart size={16} className="mr-2" fill={wishlisted ? 'currentColor' : 'none'} />
                {wishlisted ? 'Wishlisted' : 'Wishlist'}
              </Button>
              <div className="relative">
                <Button
                  variant="outline"
                  onClick={() => setShareOpen(!shareOpen)}
                  className="rounded-full px-6 py-5 text-xs uppercase tracking-wider border-stone-300"
                  data-testid="share-btn"
                >
                  <Share2 size={16} className="mr-2" /> Share
                </Button>
                {shareOpen && (
                  <div className="absolute top-full left-0 mt-2 bg-white rounded-xl shadow-lg border border-stone-100 p-3 z-20 min-w-[180px]" data-testid="share-menu">
                    <a
                      href={`https://wa.me/?text=${encodeURIComponent(shareText + ' ' + shareUrl)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 px-3 py-2 text-sm text-stone-600 hover:text-stone-900 hover:bg-stone-50 rounded-lg transition-colors"
                      data-testid="share-whatsapp"
                    >
                      WhatsApp
                    </a>
                    <a
                      href={`https://pinterest.com/pin/create/button/?url=${encodeURIComponent(shareUrl)}&description=${encodeURIComponent(shareText)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 px-3 py-2 text-sm text-stone-600 hover:text-stone-900 hover:bg-stone-50 rounded-lg transition-colors"
                      data-testid="share-pinterest"
                    >
                      Pinterest
                    </a>
                    <a
                      href={`https://instagram.com`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 px-3 py-2 text-sm text-stone-600 hover:text-stone-900 hover:bg-stone-50 rounded-lg transition-colors"
                      data-testid="share-instagram"
                    >
                      Instagram
                    </a>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </div>

        {/* Reviews Section */}
        <section className="mt-20 md:mt-32" data-testid="reviews-section">
          <h2 className="font-heading text-3xl md:text-4xl font-light text-stone-900 mb-10">Customer Reviews</h2>

          {/* Add Review */}
          {user && (
            <div className="bg-stone-50 rounded-2xl p-6 mb-10" data-testid="review-form">
              <h3 className="text-sm uppercase tracking-widest text-stone-500 mb-4 font-medium">Write a Review</h3>
              <div className="flex gap-1 mb-4">
                {[1, 2, 3, 4, 5].map(star => (
                  <button
                    key={star}
                    onClick={() => setReviewRating(star)}
                    className="p-1"
                    data-testid={`rating-star-${star}`}
                  >
                    <Star size={20} className={star <= reviewRating ? 'text-[#D4A373] fill-[#D4A373]' : 'text-stone-300'} />
                  </button>
                ))}
              </div>
              <textarea
                value={reviewText}
                onChange={(e) => setReviewText(e.target.value)}
                placeholder="Share your thoughts about this product..."
                className="w-full bg-white border border-stone-200 rounded-xl p-4 text-sm text-stone-800 placeholder:text-stone-400 focus:outline-none focus:border-stone-400 resize-none h-24 mb-4"
                data-testid="review-textarea"
              />
              <Button
                onClick={handleReview}
                className="bg-stone-900 text-white hover:bg-stone-800 rounded-full px-6 py-5 text-xs uppercase tracking-wider"
                data-testid="submit-review-btn"
              >
                Submit Review
              </Button>
            </div>
          )}

          {/* Reviews List */}
          {reviews.length === 0 ? (
            <p className="text-stone-400 text-center py-10">No reviews yet. Be the first to share your experience!</p>
          ) : (
            <div className="space-y-6">
              {reviews.map(review => (
                <div key={review.review_id} className="border-b border-stone-100 pb-6" data-testid={`review-${review.review_id}`}>
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-8 h-8 rounded-full bg-[#D4A373]/20 flex items-center justify-center text-sm font-medium text-[#D4A373]">
                      {review.user_name?.charAt(0)?.toUpperCase() || 'A'}
                    </div>
                    <span className="text-sm font-medium text-stone-800">{review.user_name}</span>
                    <div className="flex">
                      {[1, 2, 3, 4, 5].map(star => (
                        <Star key={star} size={12} className={star <= review.rating ? 'text-[#D4A373] fill-[#D4A373]' : 'text-stone-300'} />
                      ))}
                    </div>
                  </div>
                  <p className="text-sm text-stone-600 font-light">{review.comment}</p>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
