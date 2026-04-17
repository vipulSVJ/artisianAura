import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Search, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import API from '@/lib/api';

const statusOptions = ['confirmed', 'processing', 'shipped', 'delivered', 'cancelled'];

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

export default function AdminOrders() {
  const [orders, setOrders] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [expandedOrder, setExpandedOrder] = useState(null);
  const [updatingStatus, setUpdatingStatus] = useState({});

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', page.toString());
      params.set('limit', '15');
      if (statusFilter) params.set('status', statusFilter);
      const res = await API.get(`/admin/orders?${params.toString()}`);
      setOrders(res.data.orders || []);
      setTotal(res.data.total || 0);
      setPages(res.data.pages || 1);
    } catch {
      toast.error('Failed to load orders');
    }
    setLoading(false);
  }, [page, statusFilter]);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  const updateStatus = async (orderId, newStatus) => {
    setUpdatingStatus(prev => ({ ...prev, [orderId]: true }));
    try {
      await API.put(`/admin/orders/${orderId}/status`, { status: newStatus });
      toast.success(`Order status updated to "${newStatus}"`);
      fetchOrders();
    } catch (err) {
      toast.error('Failed to update status');
    }
    setUpdatingStatus(prev => ({ ...prev, [orderId]: false }));
  };

  return (
    <div>
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
        <div className="flex items-center justify-between mb-8">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-[#D4A373] mb-2 font-medium">Manage</p>
            <h1 className="font-heading text-4xl font-light text-stone-900">Orders</h1>
            <p className="text-sm text-stone-400 mt-1">{total} total orders</p>
          </div>
        </div>
      </motion.div>

      {/* Status Filter */}
      <div className="flex gap-3 mb-6 flex-wrap">
        <button
          onClick={() => { setStatusFilter(''); setPage(1); }}
          className={`px-4 py-2 rounded-full text-xs uppercase tracking-wider font-medium transition-colors ${
            !statusFilter ? 'bg-stone-900 text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
          }`}
        >
          All
        </button>
        {statusOptions.map((s) => (
          <button
            key={s}
            onClick={() => { setStatusFilter(s); setPage(1); }}
            className={`px-4 py-2 rounded-full text-xs uppercase tracking-wider font-medium transition-colors ${
              statusFilter === s ? 'bg-stone-900 text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      {/* Orders Table */}
      <div className="bg-white rounded-2xl border border-stone-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-10 text-center text-stone-400">Loading...</div>
        ) : orders.length === 0 ? (
          <div className="p-10 text-center text-stone-400">No orders found</div>
        ) : (
          <div className="divide-y divide-stone-50">
            {orders.map((order, i) => (
              <motion.div
                key={order.order_id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: i * 0.03 }}
              >
                {/* Order Row */}
                <div
                  className="px-6 py-5 flex items-center justify-between cursor-pointer hover:bg-stone-50/50 transition-colors"
                  onClick={() => setExpandedOrder(expandedOrder === order.order_id ? null : order.order_id)}
                >
                  <div className="flex items-center gap-6">
                    <div>
                      <p className="text-sm font-medium text-stone-800">{order.order_id}</p>
                      <p className="text-xs text-stone-400 mt-0.5">{order.user_name} · {order.user_email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-sm font-medium text-stone-900">₹{order.total?.toFixed(2)}</span>
                    <span className="text-xs text-stone-400">
                      {new Date(order.created_at).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}
                    </span>
                    <span className={`text-xs uppercase tracking-wider font-medium px-3 py-1 rounded-full ${statusColor(order.status)}`}>
                      {order.status}
                    </span>
                    <ChevronDown
                      size={16}
                      className={`text-stone-400 transition-transform ${expandedOrder === order.order_id ? 'rotate-180' : ''}`}
                    />
                  </div>
                </div>

                {/* Expanded Details */}
                {expandedOrder === order.order_id && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    className="px-6 pb-6 bg-stone-50/50"
                  >
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4">
                      {/* Items */}
                      <div className="md:col-span-2">
                        <p className="text-xs uppercase tracking-widest text-stone-400 font-medium mb-3">Items</p>
                        <div className="space-y-2">
                          {order.items?.map((item, idx) => (
                            <div key={idx} className="flex items-center gap-3 bg-white rounded-xl p-3">
                              <div className="w-10 h-10 rounded-lg overflow-hidden bg-stone-100 shrink-0">
                                <img src={item.image} alt="" className="w-full h-full object-cover" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm text-stone-800 truncate">{item.name}</p>
                                <p className="text-xs text-stone-400">Qty: {item.quantity} · ₹{item.price?.toFixed(2)}</p>
                              </div>
                              <span className="text-sm font-medium text-stone-900">₹{item.subtotal?.toFixed(2)}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Info + Status Update */}
                      <div className="space-y-4">
                        {order.shipping_address && (
                          <div>
                            <p className="text-xs uppercase tracking-widest text-stone-400 font-medium mb-2">Shipping</p>
                            <div className="bg-white rounded-xl p-3 text-sm text-stone-600 space-y-0.5">
                              <p>{order.shipping_address.name}</p>
                              <p>{order.shipping_address.street}</p>
                              <p>{order.shipping_address.city}, {order.shipping_address.state} {order.shipping_address.zip}</p>
                              <p>{order.shipping_address.phone}</p>
                            </div>
                          </div>
                        )}

                        <div>
                          <p className="text-xs uppercase tracking-widest text-stone-400 font-medium mb-2">Update Status</p>
                          <Select
                            value={order.status}
                            onValueChange={(val) => updateStatus(order.order_id, val)}
                            disabled={updatingStatus[order.order_id]}
                          >
                            <SelectTrigger className="w-full rounded-xl border-stone-200 text-sm">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {statusOptions.map((s) => (
                                <SelectItem key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div>
                          <p className="text-xs text-stone-400">
                            Payment: <span className="text-stone-600">{order.payment_method || 'cod'}</span>
                          </p>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Pagination */}
      {pages > 1 && (
        <div className="flex justify-center gap-2 mt-6">
          {[...Array(pages)].map((_, i) => (
            <button
              key={i}
              onClick={() => setPage(i + 1)}
              className={`w-9 h-9 rounded-full text-xs font-medium transition-colors ${
                page === i + 1 ? 'bg-stone-900 text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
              }`}
            >
              {i + 1}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
