import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Package, CheckCircle2, Truck, Clock, XCircle, MapPin, CreditCard } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import API from '@/lib/api';

const statusSteps = [
  { key: 'confirmed', label: 'Confirmed', icon: CheckCircle2 },
  { key: 'processing', label: 'Processing', icon: Clock },
  { key: 'shipped', label: 'Shipped', icon: Truck },
  { key: 'delivered', label: 'Delivered', icon: Package },
];

const statusColor = (status) => {
  const map = {
    confirmed: 'text-emerald-600',
    processing: 'text-blue-600',
    shipped: 'text-amber-600',
    delivered: 'text-green-600',
    cancelled: 'text-red-600',
  };
  return map[status] || 'text-stone-600';
};

export default function OrderDetailPage() {
  const { orderId } = useParams();
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    const load = async () => {
      try {
        const res = await API.get(`/orders/${orderId}`);
        setOrder(res.data);
      } catch {
        toast.error('Order not found');
        navigate('/orders');
      }
      setLoading(false);
    };
    load();
  }, [user, orderId, navigate]);

  const handleCancel = async () => {
    if (!window.confirm('Are you sure you want to cancel this order?')) return;
    setCancelling(true);
    try {
      const res = await API.post(`/orders/${orderId}/cancel`);
      setOrder(res.data);
      toast.success('Order cancelled');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to cancel order');
    }
    setCancelling(false);
  };

  if (!user) {
    return (
      <div className="pt-24 pb-20 min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Package size={48} className="mx-auto text-stone-300 mb-6" />
          <h2 className="font-heading text-3xl text-stone-900 mb-4">Sign in to view order</h2>
          <Button onClick={login} className="bg-stone-900 text-white hover:bg-stone-800 rounded-full px-8 py-6 text-xs uppercase tracking-widest">
            Sign In
          </Button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="pt-24 pb-20 min-h-screen">
        <div className="max-w-4xl mx-auto px-6 md:px-12 space-y-6">
          <div className="animate-pulse bg-stone-100 rounded-2xl h-8 w-48" />
          <div className="animate-pulse bg-stone-100 rounded-2xl h-48" />
          <div className="animate-pulse bg-stone-100 rounded-2xl h-64" />
        </div>
      </div>
    );
  }

  if (!order) return null;

  // Determine which steps are reached
  const statusIndex = statusSteps.findIndex(s => s.key === order.status);
  const isCancelled = order.status === 'cancelled';

  return (
    <div className="pt-24 pb-20 min-h-screen" data-testid="order-detail-page">
      <div className="max-w-4xl mx-auto px-6 md:px-12">
        {/* Back button */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <Link to="/orders" className="inline-flex items-center gap-2 text-sm text-stone-500 hover:text-stone-800 transition-colors mb-6">
            <ArrowLeft size={16} /> Back to Orders
          </Link>
        </motion.div>

        {/* Header */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} className="mb-10">
          <p className="text-xs uppercase tracking-[0.3em] text-[#D4A373] mb-2 font-medium">Order Details</p>
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div>
              <h1 className="font-heading text-3xl md:text-4xl font-light text-stone-900">
                {order.order_id}
              </h1>
              <p className="text-sm text-stone-400 mt-1">
                Placed on {new Date(order.created_at).toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' })}
              </p>
            </div>
            <span className={`text-xs uppercase tracking-wider font-medium px-4 py-2 rounded-full ${
              isCancelled ? 'bg-red-100 text-red-700' :
              order.status === 'delivered' ? 'bg-green-100 text-green-700' :
              'bg-emerald-100 text-emerald-700'
            }`}>
              {order.status}
            </span>
          </div>
        </motion.div>

        {/* Tracking Timeline */}
        {!isCancelled && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="bg-white rounded-2xl border border-stone-100 p-8 mb-8 shadow-sm"
          >
            <h3 className="text-sm uppercase tracking-widest text-stone-500 font-medium mb-6">Order Tracking</h3>
            <div className="flex items-center justify-between relative">
              {/* Connecting line */}
              <div className="absolute top-5 left-[10%] right-[10%] h-0.5 bg-stone-200" />
              <div
                className="absolute top-5 left-[10%] h-0.5 bg-[#D4A373] transition-all duration-700"
                style={{ width: `${statusIndex >= 0 ? (statusIndex / (statusSteps.length - 1)) * 80 : 0}%` }}
              />

              {statusSteps.map((step, i) => {
                const reached = i <= statusIndex;
                const historyEntry = order.status_history?.find(h => h.status === step.key);
                return (
                  <div key={step.key} className="relative flex flex-col items-center z-10" style={{ width: '25%' }}>
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors duration-500 ${
                      reached ? 'bg-[#D4A373] text-white' : 'bg-stone-100 text-stone-400'
                    }`}>
                      <step.icon size={18} />
                    </div>
                    <p className={`text-xs font-medium mt-2 ${reached ? 'text-stone-800' : 'text-stone-400'}`}>
                      {step.label}
                    </p>
                    {historyEntry && (
                      <p className="text-[10px] text-stone-400 mt-0.5">
                        {new Date(historyEntry.timestamp).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}

        {/* Cancelled Banner */}
        {isCancelled && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="bg-red-50 border border-red-100 rounded-2xl p-6 mb-8 flex items-center gap-4"
          >
            <XCircle size={24} className="text-red-500 shrink-0" />
            <div>
              <p className="text-sm font-medium text-red-800">This order was cancelled</p>
              {order.status_history?.find(h => h.status === 'cancelled')?.timestamp && (
                <p className="text-xs text-red-500 mt-0.5">
                  on {new Date(order.status_history.find(h => h.status === 'cancelled').timestamp).toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' })}
                </p>
              )}
            </div>
          </motion.div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Order Items */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.15 }}
            className="md:col-span-2 bg-white rounded-2xl border border-stone-100 shadow-sm overflow-hidden"
          >
            <div className="p-6 border-b border-stone-100">
              <h3 className="text-sm uppercase tracking-widest text-stone-500 font-medium">
                Items ({order.items?.length || 0})
              </h3>
            </div>
            <div className="divide-y divide-stone-50">
              {order.items?.map((item, idx) => (
                <Link
                  key={idx}
                  to={`/product/${item.product_id}`}
                  className="flex items-center gap-4 px-6 py-4 hover:bg-stone-50/50 transition-colors"
                >
                  <div className="w-16 h-16 rounded-xl overflow-hidden bg-stone-100 shrink-0">
                    <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-stone-800">{item.name}</p>
                    <p className="text-xs text-stone-400 mt-0.5">Qty: {item.quantity} × ₹{item.price?.toFixed(2)}</p>
                  </div>
                  <span className="text-sm font-medium text-stone-900">₹{item.subtotal?.toFixed(2)}</span>
                </Link>
              ))}
            </div>
            <div className="px-6 py-4 border-t border-stone-100 flex justify-between items-center">
              <span className="text-sm text-stone-500">Total</span>
              <span className="text-lg font-medium text-stone-900">₹{order.total?.toFixed(2)}</span>
            </div>
          </motion.div>

          {/* Sidebar: Shipping + Payment + Actions */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="space-y-6"
          >
            {/* Shipping */}
            {order.shipping_address && (
              <div className="bg-white rounded-2xl border border-stone-100 p-6 shadow-sm">
                <div className="flex items-center gap-2 mb-3">
                  <MapPin size={16} className="text-stone-400" />
                  <h3 className="text-sm uppercase tracking-widest text-stone-500 font-medium">Shipping</h3>
                </div>
                <div className="text-sm text-stone-600 space-y-0.5">
                  <p className="font-medium text-stone-800">{order.shipping_address.name}</p>
                  <p>{order.shipping_address.street}</p>
                  <p>{order.shipping_address.city}, {order.shipping_address.state} {order.shipping_address.zip}</p>
                  <p>{order.shipping_address.phone}</p>
                </div>
              </div>
            )}

            {/* Payment */}
            <div className="bg-white rounded-2xl border border-stone-100 p-6 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <CreditCard size={16} className="text-stone-400" />
                <h3 className="text-sm uppercase tracking-widest text-stone-500 font-medium">Payment</h3>
              </div>
              <p className="text-sm text-stone-600">
                {order.payment_method === 'razorpay' ? 'Paid via Razorpay' : 'Cash on Delivery'}
              </p>
              {order.razorpay_payment_id && (
                <p className="text-xs text-stone-400 mt-1">ID: {order.razorpay_payment_id}</p>
              )}
            </div>

            {/* Cancel Button */}
            {order.status === 'confirmed' && (
              <Button
                onClick={handleCancel}
                disabled={cancelling}
                variant="outline"
                className="w-full rounded-full border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 py-5 text-xs uppercase tracking-widest"
              >
                {cancelling ? 'Cancelling...' : 'Cancel Order'}
              </Button>
            )}
          </motion.div>
        </div>
      </div>
    </div>
  );
}
