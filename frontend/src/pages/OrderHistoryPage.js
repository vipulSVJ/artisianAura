import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Package, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import API from '@/lib/api';

export default function OrderHistoryPage() {
  const { user, login } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    const load = async () => {
      try {
        const res = await API.get('/orders');
        setOrders(res.data.orders || []);
      } catch { /* ignore */ }
      setLoading(false);
    };
    load();
  }, [user]);

  const statusColor = (status) => {
    const map = {
      confirmed: 'bg-emerald-100 text-emerald-700',
      processing: 'bg-blue-100 text-blue-700',
      shipped: 'bg-amber-100 text-amber-700',
      delivered: 'bg-green-100 text-green-700',
      cancelled: 'bg-red-100 text-red-700'
    };
    return map[status] || 'bg-stone-100 text-stone-700';
  };

  if (!user) {
    return (
      <div className="pt-24 pb-20 min-h-screen flex items-center justify-center" data-testid="orders-page">
        <div className="text-center">
          <Package size={48} className="mx-auto text-stone-300 mb-6" />
          <h2 className="font-heading text-3xl text-stone-900 mb-4">Sign in to view orders</h2>
          <Button onClick={login} className="bg-stone-900 text-white hover:bg-stone-800 rounded-full px-8 py-6 text-xs uppercase tracking-widest" data-testid="orders-sign-in-btn">
            Sign In
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="pt-24 pb-20 min-h-screen" data-testid="orders-page">
      <div className="max-w-4xl mx-auto px-6 md:px-12">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
          <p className="text-xs uppercase tracking-[0.3em] text-[#D4A373] mb-3 font-medium">Your Orders</p>
          <h1 className="font-heading text-4xl md:text-5xl font-light text-stone-900 mb-12">Order History</h1>
        </motion.div>

        {loading ? (
          <div className="space-y-6">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="animate-pulse bg-stone-100 rounded-2xl h-32" />
            ))}
          </div>
        ) : orders.length === 0 ? (
          <div className="text-center py-20">
            <Package size={48} className="mx-auto text-stone-300 mb-6" />
            <h3 className="font-heading text-2xl text-stone-900 mb-3">No orders yet</h3>
            <p className="text-stone-500 mb-8">Start exploring our handcrafted collection</p>
            <Link to="/shop">
              <Button className="bg-stone-900 text-white hover:bg-stone-800 rounded-full px-8 py-6 text-xs uppercase tracking-widest">
                Start Shopping
              </Button>
            </Link>
          </div>
        ) : (
          <div className="space-y-6">
            {orders.map((order, i) => (
              <motion.div
                key={order.order_id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: i * 0.05 }}
                className="border border-stone-100 rounded-2xl p-6 hover:shadow-lg transition-shadow duration-300 cursor-pointer"
                onClick={() => navigate(`/orders`)}
                data-testid={`order-${order.order_id}`}
              >
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="text-xs text-stone-400 uppercase tracking-wider">Order #{order.order_id}</p>
                    <p className="text-xs text-stone-400 mt-1">
                      {new Date(order.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                    </p>
                  </div>
                  <span className={`text-xs uppercase tracking-wider font-medium px-3 py-1 rounded-full ${statusColor(order.status)}`}>
                    {order.status}
                  </span>
                </div>
                <div className="flex items-center gap-3 mb-4">
                  {order.items?.slice(0, 3).map((item, idx) => (
                    <div key={idx} className="w-14 h-14 rounded-lg overflow-hidden bg-stone-100 shrink-0">
                      <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                    </div>
                  ))}
                  {order.items?.length > 3 && (
                    <span className="text-xs text-stone-400">+{order.items.length - 3} more</span>
                  )}
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-base font-medium text-stone-900">${order.total?.toFixed(2)}</span>
                  <span className="text-xs text-stone-400">{order.items?.length} item{order.items?.length > 1 ? 's' : ''}</span>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
