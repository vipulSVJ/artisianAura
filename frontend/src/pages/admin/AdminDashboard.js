import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Package, ShoppingCart, Users, TrendingUp, IndianRupee } from 'lucide-react';
import API from '@/lib/api';

const StatCard = ({ icon: Icon, label, value, color, delay }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.5, delay }}
    className="bg-white rounded-2xl p-6 border border-stone-100 shadow-sm hover:shadow-md transition-shadow"
  >
    <div className="flex items-start justify-between">
      <div>
        <p className="text-xs uppercase tracking-widest text-stone-400 font-medium">{label}</p>
        <p className="text-3xl font-light text-stone-900 mt-2">{value}</p>
      </div>
      <div className={`p-3 rounded-xl ${color}`}>
        <Icon size={22} className="text-white" />
      </div>
    </div>
  </motion.div>
);

const statusColor = (status) => {
  const map = {
    confirmed: 'bg-emerald-100 text-emerald-700',
    processing: 'bg-blue-100 text-blue-700',
    shipped: 'bg-amber-100 text-amber-700',
    delivered: 'bg-green-100 text-green-700',
    cancelled: 'bg-red-100 text-red-700',
  };
  return map[status] || 'bg-stone-100 text-stone-700';
};

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await API.get('/admin/stats');
        setStats(res.data);
      } catch (err) {
        console.error('Failed to load admin stats:', err);
      }
      setLoading(false);
    };
    load();
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="animate-pulse bg-stone-100 rounded-2xl h-28" />
          ))}
        </div>
        <div className="animate-pulse bg-stone-100 rounded-2xl h-64" />
      </div>
    );
  }

  return (
    <div>
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
        <p className="text-xs uppercase tracking-[0.3em] text-[#D4A373] mb-2 font-medium">Overview</p>
        <h1 className="font-heading text-4xl font-light text-stone-900 mb-8">Dashboard</h1>
      </motion.div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
        <StatCard icon={Package} label="Products" value={stats?.total_products || 0} color="bg-stone-800" delay={0} />
        <StatCard icon={ShoppingCart} label="Orders" value={stats?.total_orders || 0} color="bg-[#D4A373]" delay={0.05} />
        <StatCard icon={Users} label="Users" value={stats?.total_users || 0} color="bg-emerald-600" delay={0.1} />
        <StatCard icon={IndianRupee} label="Revenue" value={`₹${(stats?.revenue || 0).toLocaleString('en-IN')}`} color="bg-purple-600" delay={0.15} />
      </div>

      {/* Orders by Status */}
      {stats?.orders_by_status && Object.keys(stats.orders_by_status).length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="bg-white rounded-2xl p-6 border border-stone-100 shadow-sm mb-10"
        >
          <h3 className="text-sm uppercase tracking-widest text-stone-500 font-medium mb-4">Orders by Status</h3>
          <div className="flex flex-wrap gap-3">
            {Object.entries(stats.orders_by_status).map(([status, count]) => (
              <span key={status} className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium ${statusColor(status)}`}>
                {status} <span className="font-bold">{count}</span>
              </span>
            ))}
          </div>
        </motion.div>
      )}

      {/* Recent Orders */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.25 }}
        className="bg-white rounded-2xl border border-stone-100 shadow-sm overflow-hidden"
      >
        <div className="p-6 border-b border-stone-100">
          <h3 className="text-sm uppercase tracking-widest text-stone-500 font-medium">Recent Orders</h3>
        </div>
        {!stats?.recent_orders?.length ? (
          <div className="p-10 text-center text-stone-400">No orders yet</div>
        ) : (
          <div className="divide-y divide-stone-50">
            {stats.recent_orders.map((order) => (
              <div key={order.order_id} className="px-6 py-4 flex items-center justify-between hover:bg-stone-50/50 transition-colors">
                <div>
                  <p className="text-sm font-medium text-stone-800">{order.order_id}</p>
                  <p className="text-xs text-stone-400 mt-0.5">
                    {new Date(order.created_at).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' })}
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-sm font-medium text-stone-900">₹{order.total?.toFixed(2)}</span>
                  <span className={`text-xs uppercase tracking-wider font-medium px-3 py-1 rounded-full ${statusColor(order.status)}`}>
                    {order.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </motion.div>
    </div>
  );
}
