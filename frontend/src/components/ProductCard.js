import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Heart, ShoppingBag } from 'lucide-react';
import { motion } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { useCart } from '@/contexts/CartContext';
import API from '@/lib/api';

export const ProductCard = ({ product, index = 0 }) => {
  const { user } = useAuth();
  const { addToCart } = useCart();
  const [wishlisted, setWishlisted] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);

  const handleWishlist = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!user) return;
    try {
      const res = await API.post(`/wishlist/${product.product_id}`);
      setWishlisted(res.data.wishlisted);
    } catch { /* ignore */ }
  };

  const handleAddToCart = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!user) return;
    await addToCart(product.product_id);
  };

  const discount = product.original_price
    ? Math.round((1 - product.price / product.original_price) * 100)
    : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: index * 0.08, ease: [0.22, 1, 0.36, 1] }}
    >
      <Link
        to={`/product/${product.product_id}`}
        className="group block"
        data-testid={`product-card-${product.product_id}`}
      >
        {/* Image */}
        <div className="relative aspect-[3/4] overflow-hidden rounded-2xl bg-stone-100 mb-4">
          {!imgLoaded && (
            <div className="absolute inset-0 bg-stone-100 animate-pulse" />
          )}
          <img
            src={product.images?.[0]}
            alt={product.name}
            className={`w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-105 ${
              imgLoaded ? 'opacity-100' : 'opacity-0'
            }`}
            loading="lazy"
            onLoad={() => setImgLoaded(true)}
          />

          {/* Overlay actions */}
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-500" />

          {/* Discount badge */}
          {discount > 0 && (
            <span className="absolute top-4 left-4 bg-[#D4A373] text-white text-xs font-medium px-3 py-1 rounded-full">
              -{discount}%
            </span>
          )}

          {/* Action buttons */}
          <div className="absolute top-4 right-4 flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
            <button
              data-testid={`wishlist-btn-${product.product_id}`}
              onClick={handleWishlist}
              className={`p-2.5 rounded-full backdrop-blur-md transition-colors duration-300 ${
                wishlisted ? 'bg-[#D4A373] text-white' : 'bg-white/80 text-stone-700 hover:bg-[#D4A373] hover:text-white'
              }`}
            >
              <Heart size={16} fill={wishlisted ? 'currentColor' : 'none'} />
            </button>
            <button
              data-testid={`add-to-cart-btn-${product.product_id}`}
              onClick={handleAddToCart}
              className="p-2.5 bg-white/80 rounded-full text-stone-700 hover:bg-stone-900 hover:text-white backdrop-blur-md transition-colors duration-300"
            >
              <ShoppingBag size={16} />
            </button>
          </div>

          {/* Stock status */}
          {product.stock <= 5 && product.stock > 0 && (
            <span className="absolute bottom-4 left-4 text-xs font-medium text-stone-800 bg-white/90 backdrop-blur-sm px-3 py-1 rounded-full">
              Only {product.stock} left
            </span>
          )}
          {product.stock === 0 && (
            <div className="absolute inset-0 bg-white/60 flex items-center justify-center">
              <span className="text-sm uppercase tracking-widest text-stone-800 font-medium">Sold Out</span>
            </div>
          )}
        </div>

        {/* Info */}
        <div className="space-y-1.5">
          <p className="text-xs uppercase tracking-[0.15em] text-stone-400 font-medium">{product.category}</p>
          <h3 className="font-heading text-xl font-normal text-stone-800 group-hover:text-[#D4A373] transition-colors duration-300">
            {product.name}
          </h3>
          <div className="flex items-center gap-2">
            <span className="text-base font-medium text-stone-900">₹{product.price.toFixed(2)}</span>
            {product.original_price && (
              <span className="text-sm text-stone-400 line-through">₹{product.original_price.toFixed(2)}</span>
            )}
          </div>
          {product.rating_count > 0 && (
            <div className="flex items-center gap-1.5">
              <div className="flex">
                {[1, 2, 3, 4, 5].map(star => (
                  <span key={star} className={`text-xs ${star <= Math.round(product.rating_avg) ? 'text-[#D4A373]' : 'text-stone-300'}`}>
                    &#9733;
                  </span>
                ))}
              </div>
              <span className="text-xs text-stone-400">({product.rating_count})</span>
            </div>
          )}
        </div>
      </Link>
    </motion.div>
  );
};
