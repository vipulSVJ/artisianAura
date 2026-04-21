import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Heart, Trash2, ShoppingBag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useCart } from '@/contexts/CartContext';
import { toast } from 'sonner';
import API from '@/lib/api';

export default function WishlistPage() {
  const { user, login } = useAuth();
  const { addToCart } = useCart();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchWishlist = async () => {
      setLoading(true);
      try {
        const res = await API.get('/wishlist');
        setItems(res.data.items || []);
      } catch { /* ignore */ }
      setLoading(false);
    };

    if (user) fetchWishlist();
    else setLoading(false);
  }, [user]);

  const handleRemove = async (productId) => {
    try {
      await API.post(`/wishlist/${productId}`);
      setItems(prev => prev.filter(i => i.product_id !== productId));
      toast.success('Removed from wishlist');
    } catch { /* ignore */ }
  };

  const handleMoveToCart = async (productId) => {
    const success = await addToCart(productId);
    if (success) {
      await handleRemove(productId);
      toast.success('Moved to cart');
    }
  };

  if (!user) {
    return (
      <div className="pt-24 pb-20 min-h-screen flex items-center justify-center" data-testid="wishlist-page">
        <div className="text-center">
          <Heart size={48} className="mx-auto text-stone-300 mb-6" />
          <h2 className="font-heading text-3xl text-stone-900 mb-4">Your wishlist awaits</h2>
          <p className="text-stone-500 mb-8">Sign in to save your favorites</p>
          <Button onClick={login} className="bg-stone-900 text-white hover:bg-stone-800 rounded-full px-8 py-6 text-xs uppercase tracking-widest" data-testid="wishlist-sign-in-btn">
            Sign In
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="pt-24 pb-20 min-h-screen" data-testid="wishlist-page">
      <div className="max-w-7xl mx-auto px-6 md:px-12">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
          <p className="text-xs uppercase tracking-[0.3em] text-[#D4A373] mb-3 font-medium">Saved Items</p>
          <h1 className="font-heading text-4xl md:text-5xl font-light text-stone-900 mb-12">Wishlist</h1>
        </motion.div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="animate-pulse">
                <div className="aspect-[3/4] bg-stone-100 rounded-2xl mb-4" />
                <div className="h-4 bg-stone-100 rounded w-2/3" />
              </div>
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-20">
            <Heart size={48} className="mx-auto text-stone-300 mb-6" />
            <h3 className="font-heading text-2xl text-stone-900 mb-3">Nothing saved yet</h3>
            <p className="text-stone-500 mb-8">Start adding pieces you love</p>
            <Link to="/shop">
              <Button className="bg-stone-900 text-white hover:bg-stone-800 rounded-full px-8 py-6 text-xs uppercase tracking-widest">
                Explore Collection
              </Button>
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-8 gap-y-12">
            {items.map((item, i) => (
              <motion.div
                key={item.product_id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: i * 0.05 }}
                data-testid={`wishlist-item-${item.product_id}`}
              >
                <Link to={`/product/${item.product_id}`} className="group block">
                  <div className="relative aspect-[3/4] overflow-hidden rounded-2xl bg-stone-100 mb-4">
                    <img
                      src={item.product?.images?.[0]}
                      alt={item.product?.name}
                      className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                      loading="lazy"
                    />
                  </div>
                </Link>
                <div>
                  <p className="text-xs uppercase tracking-wider text-stone-400">{item.product?.category}</p>
                  <h3 className="font-heading text-lg text-stone-900 mt-1">{item.product?.name}</h3>
                  <p className="text-base font-medium text-stone-900 mt-1">₹{item.product?.price?.toFixed(2)}</p>
                  <div className="flex gap-2 mt-3">
                    <Button
                      size="sm"
                      onClick={() => handleMoveToCart(item.product_id)}
                      className="flex-1 bg-stone-900 text-white hover:bg-stone-800 rounded-full text-xs uppercase tracking-wider"
                      data-testid={`move-to-cart-${item.product_id}`}
                    >
                      <ShoppingBag size={14} className="mr-1" /> Add to Cart
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleRemove(item.product_id)}
                      className="rounded-full border-stone-300 text-stone-500 hover:text-red-500 hover:border-red-300"
                      data-testid={`wishlist-remove-${item.product_id}`}
                    >
                      <Trash2 size={14} />
                    </Button>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
