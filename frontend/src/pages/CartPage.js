import { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Trash2, Minus, Plus, ShoppingBag, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { useAuth } from '@/contexts/AuthContext';
import { useCart } from '@/contexts/CartContext';

export default function CartPage() {
  const { user, login } = useAuth();
  const { cartItems, cartTotal, fetchCart, updateQuantity, removeFromCart } = useCart();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) fetchCart();
  }, [user, fetchCart]);

  if (!user) {
    return (
      <div className="pt-24 pb-20 min-h-screen flex items-center justify-center" data-testid="cart-page">
        <div className="text-center">
          <ShoppingBag size={48} className="mx-auto text-stone-300 mb-6" />
          <h2 className="font-heading text-3xl text-stone-900 mb-4">Your cart awaits</h2>
          <p className="text-stone-500 mb-8">Sign in to view your cart</p>
          <Button onClick={login} className="bg-stone-900 text-white hover:bg-stone-800 rounded-full px-8 py-6 text-xs uppercase tracking-widest" data-testid="cart-sign-in-btn">
            Sign In
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="pt-24 pb-20 min-h-screen" data-testid="cart-page">
      <div className="max-w-7xl mx-auto px-6 md:px-12">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
          <p className="text-xs uppercase tracking-[0.3em] text-[#D4A373] mb-3 font-medium">Your Selection</p>
          <h1 className="font-heading text-4xl md:text-5xl font-light text-stone-900 mb-12">Shopping Cart</h1>
        </motion.div>

        {cartItems.length === 0 ? (
          <div className="text-center py-20">
            <ShoppingBag size={48} className="mx-auto text-stone-300 mb-6" />
            <h3 className="font-heading text-2xl text-stone-900 mb-3">Your cart is empty</h3>
            <p className="text-stone-500 mb-8">Discover our handcrafted collection</p>
            <Link to="/shop">
              <Button className="bg-stone-900 text-white hover:bg-stone-800 rounded-full px-8 py-6 text-xs uppercase tracking-widest" data-testid="cart-shop-btn">
                Continue Shopping
              </Button>
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-12 lg:gap-20">
            {/* Cart items */}
            <div className="lg:col-span-2 space-y-6">
              {cartItems.map((item, i) => (
                <motion.div
                  key={item.product_id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: i * 0.05 }}
                  className="flex gap-6 p-4 border border-stone-100 rounded-2xl"
                  data-testid={`cart-item-${item.product_id}`}
                >
                  <Link to={`/product/${item.product_id}`} className="w-24 h-24 md:w-32 md:h-32 shrink-0 rounded-xl overflow-hidden bg-stone-100">
                    <img src={item.product?.images?.[0]} alt={item.product?.name} className="w-full h-full object-cover" />
                  </Link>
                  <div className="flex-1 flex flex-col justify-between">
                    <div>
                      <Link to={`/product/${item.product_id}`} className="font-heading text-lg text-stone-900 hover:text-[#D4A373] transition-colors">
                        {item.product?.name}
                      </Link>
                      <p className="text-xs text-stone-400 uppercase tracking-wider mt-1">{item.product?.category}</p>
                    </div>
                    <div className="flex items-center justify-between mt-3">
                      <div className="flex items-center border border-stone-200 rounded-full">
                        <button
                          onClick={() => updateQuantity(item.product_id, Math.max(1, item.quantity - 1))}
                          className="p-2 text-stone-500 hover:text-stone-900"
                          data-testid={`cart-decrease-${item.product_id}`}
                        >
                          <Minus size={14} />
                        </button>
                        <span className="w-8 text-center text-sm">{item.quantity}</span>
                        <button
                          onClick={() => updateQuantity(item.product_id, item.quantity + 1)}
                          className="p-2 text-stone-500 hover:text-stone-900"
                          data-testid={`cart-increase-${item.product_id}`}
                        >
                          <Plus size={14} />
                        </button>
                      </div>
                      <span className="text-base font-medium text-stone-900">
                        ${((item.product?.price || 0) * item.quantity).toFixed(2)}
                      </span>
                      <button
                        onClick={() => removeFromCart(item.product_id)}
                        className="p-2 text-stone-400 hover:text-red-500 transition-colors"
                        data-testid={`cart-remove-${item.product_id}`}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Order Summary */}
            <div className="lg:col-span-1">
              <div className="sticky top-28 bg-stone-50 rounded-2xl p-8" data-testid="order-summary">
                <h3 className="text-sm uppercase tracking-widest text-stone-500 font-medium mb-6">Order Summary</h3>
                <div className="space-y-3 mb-6">
                  <div className="flex justify-between text-sm text-stone-600">
                    <span>Subtotal</span>
                    <span>${cartTotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm text-stone-600">
                    <span>Shipping</span>
                    <span className="text-emerald-600">Free</span>
                  </div>
                </div>
                <Separator className="mb-6" />
                <div className="flex justify-between text-lg font-medium text-stone-900 mb-8">
                  <span>Total</span>
                  <span>${cartTotal.toFixed(2)}</span>
                </div>
                <Button
                  onClick={() => navigate('/checkout')}
                  className="w-full bg-stone-900 text-white hover:bg-stone-800 rounded-full py-6 text-xs uppercase tracking-[0.2em]"
                  data-testid="checkout-btn"
                >
                  Proceed to Checkout <ArrowRight size={16} className="ml-2" />
                </Button>
                <Link
                  to="/shop"
                  className="block text-center text-xs uppercase tracking-widest text-stone-500 hover:text-stone-900 mt-4 transition-colors"
                >
                  Continue Shopping
                </Link>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
