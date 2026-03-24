import { createContext, useContext, useState, useCallback } from 'react';
import API from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';

const CartContext = createContext(null);

export const useCart = () => useContext(CartContext);

export const CartProvider = ({ children }) => {
  const { user } = useAuth();
  const [cartItems, setCartItems] = useState([]);
  const [cartCount, setCartCount] = useState(0);

  const fetchCart = useCallback(async () => {
    if (!user) { setCartItems([]); setCartCount(0); return; }
    try {
      const res = await API.get('/cart');
      const items = res.data.items || [];
      setCartItems(items);
      setCartCount(items.reduce((sum, i) => sum + i.quantity, 0));
    } catch {
      setCartItems([]);
      setCartCount(0);
    }
  }, [user]);

  const addToCart = async (productId, quantity = 1) => {
    if (!user) return false;
    try {
      await API.post('/cart', { product_id: productId, quantity });
      await fetchCart();
      return true;
    } catch {
      return false;
    }
  };

  const updateQuantity = async (productId, quantity) => {
    if (!user) return;
    try {
      await API.put(`/cart/${productId}`, { quantity });
      await fetchCart();
    } catch { /* ignore */ }
  };

  const removeFromCart = async (productId) => {
    if (!user) return;
    try {
      await API.delete(`/cart/${productId}`);
      await fetchCart();
    } catch { /* ignore */ }
  };

  const clearCart = async () => {
    if (!user) return;
    try {
      await API.delete('/cart');
      setCartItems([]);
      setCartCount(0);
    } catch { /* ignore */ }
  };

  const cartTotal = cartItems.reduce((sum, item) => {
    const price = item.product?.price || 0;
    return sum + price * item.quantity;
  }, 0);

  return (
    <CartContext.Provider value={{
      cartItems, cartCount, cartTotal, fetchCart,
      addToCart, updateQuantity, removeFromCart, clearCart
    }}>
      {children}
    </CartContext.Provider>
  );
};
