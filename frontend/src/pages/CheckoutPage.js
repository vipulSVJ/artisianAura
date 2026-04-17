import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Check, ChevronRight, MapPin, CreditCard, Package, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { useAuth } from '@/contexts/AuthContext';
import { useCart } from '@/contexts/CartContext';
import { toast } from 'sonner';
import API from '@/lib/api';

const steps = [
  { id: 1, label: 'Shipping', icon: MapPin },
  { id: 2, label: 'Review & Pay', icon: CreditCard },
  { id: 3, label: 'Confirmation', icon: Check },
];

const loadRazorpayScript = () => {
  return new Promise((resolve) => {
    if (document.querySelector('script[src="https://checkout.razorpay.com/v1/checkout.js"]')) {
      resolve(true);
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
};

export default function CheckoutPage() {
  const { user, login } = useAuth();
  const { cartItems, cartTotal, fetchCart, clearCart } = useCart();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [address, setAddress] = useState({ name: '', street: '', city: '', state: '', zip: '', phone: '' });
  const [placing, setPlacing] = useState(false);
  const [orderId, setOrderId] = useState(null);

  useEffect(() => {
    if (user) fetchCart();
  }, [user, fetchCart]);

  const handleRazorpayPayment = useCallback(async () => {
    setPlacing(true);
    try {
      const loaded = await loadRazorpayScript();
      if (!loaded) {
        toast.error('Payment gateway failed to load. Please try again.');
        setPlacing(false);
        return;
      }

      const { data: orderData } = await API.post('/payment/create-order', { amount: cartTotal });

      const options = {
        key: process.env.REACT_APP_RAZORPAY_KEY_ID,
        amount: orderData.amount,
        currency: orderData.currency,
        order_id: orderData.order_id,
        name: 'Artisan & Aura',
        description: 'Handcrafted with care',
        handler: async (response) => {
          try {
            const verifyRes = await API.post('/payment/verify', {
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              shipping_address: address
            });
            setOrderId(verifyRes.data.order_id);
            setStep(3);
            toast.success('Payment successful! Order placed.');
          } catch {
            toast.error('Payment verification failed. Contact support.');
          }
          setPlacing(false);
        },
        modal: {
          ondismiss: () => {
            setPlacing(false);
            toast.info('Payment cancelled');
          }
        },
        prefill: {
          name: user?.name || '',
          email: user?.email || '',
        },
        theme: { color: '#292524' }
      };

      const rzp = new window.Razorpay(options);
      rzp.open();
    } catch (err) {
      toast.error('Failed to initiate payment');
      setPlacing(false);
    }
  }, [cartTotal, address, user]);

  const handlePlaceOrder = async () => {
    setPlacing(true);
    try {
      const res = await API.post('/orders', {
        shipping_address: address,
        payment_method: 'cod'
      });
      setOrderId(res.data.order_id);
      setStep(3);
      toast.success('Order placed successfully!');
    } catch (err) {
      toast.error('Failed to place order');
    }
    setPlacing(false);
  };

  const isAddressValid = address.name && address.street && address.city && address.state && address.zip && address.phone;

  if (!user) {
    return (
      <div className="pt-24 pb-20 min-h-screen flex items-center justify-center" data-testid="checkout-page">
        <div className="text-center">
          <h2 className="font-heading text-3xl text-stone-900 mb-4">Sign in to checkout</h2>
          <Button onClick={login} className="bg-stone-900 text-white hover:bg-stone-800 rounded-full px-8 py-6 text-xs uppercase tracking-widest" data-testid="checkout-sign-in-btn">
            Sign In
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="pt-24 pb-20 min-h-screen" data-testid="checkout-page">
      <div className="max-w-4xl mx-auto px-6 md:px-12">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
          <p className="text-xs uppercase tracking-[0.3em] text-[#D4A373] mb-3 font-medium">Checkout</p>
          <h1 className="font-heading text-4xl md:text-5xl font-light text-stone-900 mb-10">Complete Your Order</h1>
        </motion.div>

        {/* Steps indicator */}
        <div className="flex items-center gap-4 mb-12">
          {steps.map((s, i) => (
            <div key={s.id} className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                step >= s.id ? 'bg-stone-900 text-white' : 'bg-stone-100 text-stone-400'
              }`}>
                {step > s.id ? <Check size={16} /> : s.id}
              </div>
              <span className={`text-xs uppercase tracking-widest hidden sm:block ${step >= s.id ? 'text-stone-900' : 'text-stone-400'}`}>
                {s.label}
              </span>
              {i < steps.length - 1 && <ChevronRight size={16} className="text-stone-300 mx-2" />}
            </div>
          ))}
        </div>

        {/* Step 1: Shipping */}
        {step === 1 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8" data-testid="shipping-step">
            <div className="bg-stone-50 rounded-2xl p-8">
              <h2 className="text-sm uppercase tracking-widest text-stone-500 font-medium mb-6">Shipping Address</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="text-xs uppercase tracking-wider text-stone-500 mb-2 block">Full Name</label>
                  <input
                    value={address.name}
                    onChange={e => setAddress({ ...address, name: e.target.value })}
                    className="w-full bg-white border border-stone-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-stone-400"
                    data-testid="shipping-name"
                  />
                </div>
                <div>
                  <label className="text-xs uppercase tracking-wider text-stone-500 mb-2 block">Phone</label>
                  <input
                    value={address.phone}
                    onChange={e => setAddress({ ...address, phone: e.target.value })}
                    className="w-full bg-white border border-stone-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-stone-400"
                    data-testid="shipping-phone"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="text-xs uppercase tracking-wider text-stone-500 mb-2 block">Street Address</label>
                  <input
                    value={address.street}
                    onChange={e => setAddress({ ...address, street: e.target.value })}
                    className="w-full bg-white border border-stone-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-stone-400"
                    data-testid="shipping-street"
                  />
                </div>
                <div>
                  <label className="text-xs uppercase tracking-wider text-stone-500 mb-2 block">City</label>
                  <input
                    value={address.city}
                    onChange={e => setAddress({ ...address, city: e.target.value })}
                    className="w-full bg-white border border-stone-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-stone-400"
                    data-testid="shipping-city"
                  />
                </div>
                <div>
                  <label className="text-xs uppercase tracking-wider text-stone-500 mb-2 block">State</label>
                  <input
                    value={address.state}
                    onChange={e => setAddress({ ...address, state: e.target.value })}
                    className="w-full bg-white border border-stone-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-stone-400"
                    data-testid="shipping-state"
                  />
                </div>
                <div>
                  <label className="text-xs uppercase tracking-wider text-stone-500 mb-2 block">ZIP Code</label>
                  <input
                    value={address.zip}
                    onChange={e => setAddress({ ...address, zip: e.target.value })}
                    className="w-full bg-white border border-stone-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-stone-400"
                    data-testid="shipping-zip"
                  />
                </div>
              </div>
            </div>
            <div className="flex justify-end">
              <Button
                onClick={() => setStep(2)}
                disabled={!isAddressValid}
                className="bg-stone-900 text-white hover:bg-stone-800 rounded-full px-10 py-6 text-xs uppercase tracking-[0.2em]"
                data-testid="continue-to-review-btn"
              >
                Continue to Review <ChevronRight size={16} className="ml-2" />
              </Button>
            </div>
          </motion.div>
        )}

        {/* Step 2: Review */}
        {step === 2 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8" data-testid="review-step">
            {/* Order items */}
            <div className="bg-stone-50 rounded-2xl p-8">
              <h2 className="text-sm uppercase tracking-widest text-stone-500 font-medium mb-6">Order Items</h2>
              <div className="space-y-4">
                {cartItems.map(item => (
                  <div key={item.product_id} className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-xl overflow-hidden bg-stone-100 shrink-0">
                      <img src={item.product?.images?.[0]} alt={item.product?.name} className="w-full h-full object-cover" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-stone-800">{item.product?.name}</p>
                      <p className="text-xs text-stone-400">Qty: {item.quantity}</p>
                    </div>
                    <span className="text-sm font-medium text-stone-900">
                      ₹{((item.product?.price || 0) * item.quantity).toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
              <Separator className="my-6" />
              <div className="flex justify-between text-lg font-medium text-stone-900">
                <span>Total</span>
                <span>₹{cartTotal.toFixed(2)}</span>
              </div>
            </div>

            {/* Shipping address summary */}
            <div className="bg-stone-50 rounded-2xl p-8">
              <h2 className="text-sm uppercase tracking-widest text-stone-500 font-medium mb-4">Shipping To</h2>
              <p className="text-sm text-stone-700">{address.name}</p>
              <p className="text-sm text-stone-500">{address.street}</p>
              <p className="text-sm text-stone-500">{address.city}, {address.state} {address.zip}</p>
              <p className="text-sm text-stone-500">{address.phone}</p>
              <button
                onClick={() => setStep(1)}
                className="text-xs uppercase tracking-widest text-[#D4A373] hover:text-[#c49366] mt-3 transition-colors"
              >
                Edit Address
              </button>
            </div>

            <div className="flex justify-between">
              <Button
                variant="outline"
                onClick={() => setStep(1)}
                className="rounded-full px-8 py-6 text-xs uppercase tracking-wider border-stone-300"
              >
                Back
              </Button>
              <div className="flex gap-3">
                <Button
                  onClick={handleRazorpayPayment}
                  disabled={placing}
                  className="bg-[#D4A373] text-white hover:bg-[#c49366] rounded-full px-10 py-6 text-xs uppercase tracking-[0.2em]"
                  data-testid="pay-razorpay-btn"
                >
                  <CreditCard size={16} className="mr-2" />
                  {placing ? 'Processing...' : `Pay ₹${cartTotal.toFixed(2)}`}
                </Button>
                <Button
                  onClick={handlePlaceOrder}
                  disabled={placing}
                  variant="outline"
                  className="rounded-full px-8 py-6 text-xs uppercase tracking-wider border-stone-300"
                  data-testid="place-order-btn"
                >
                  {placing ? 'Placing...' : 'Cash on Delivery'}
                </Button>
              </div>
            </div>
          </motion.div>
        )}

        {/* Step 3: Confirmation */}
        {step === 3 && (
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="text-center py-16" data-testid="confirmation-step">
            <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-8">
              <Check size={32} className="text-emerald-600" />
            </div>
            <h2 className="font-heading text-4xl text-stone-900 mb-4">Order Confirmed</h2>
            <p className="text-stone-500 mb-2">Thank you for your purchase!</p>
            {orderId && <p className="text-sm text-stone-400 mb-8">Order ID: {orderId}</p>}
            <div className="flex justify-center gap-4">
              <Button
                onClick={() => navigate('/orders')}
                className="bg-stone-900 text-white hover:bg-stone-800 rounded-full px-8 py-6 text-xs uppercase tracking-widest"
                data-testid="view-orders-btn"
              >
                View Orders
              </Button>
              <Button
                variant="outline"
                onClick={() => navigate('/shop')}
                className="rounded-full px-8 py-6 text-xs uppercase tracking-wider border-stone-300"
              >
                Continue Shopping
              </Button>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
