import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Search, Shield, ShieldAlert, User as UserIcon } from 'lucide-react';
import { toast } from 'sonner';
import API from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';

export default function AdminUsers() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', page.toString());
      params.set('limit', '15');
      if (search) params.set('search', search);
      const res = await API.get(`/admin/users?${params.toString()}`);
      setUsers(res.data.users || []);
      setTotal(res.data.total || 0);
      setPages(res.data.pages || 1);
    } catch (err) {
      toast.error('Failed to load users');
    }
    setLoading(false);
  }, [page, search]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const toggleAdminRole = async (userId, currentStatus) => {
    if (userId === currentUser?.user_id && currentStatus) {
      toast.error("You cannot remove your own admin privileges.");
      return;
    }
    
    try {
      await API.put(`/admin/users/${userId}/role`, { is_admin: !currentStatus });
      toast.success(`User role updated to ${!currentStatus ? 'Admin' : 'Customer'}`);
      fetchUsers();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to update user role');
    }
  };

  return (
    <div>
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
        <div className="flex items-center justify-between mb-8">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-[#D4A373] mb-2 font-medium">Manage</p>
            <h1 className="font-heading text-4xl font-light text-stone-900">Users</h1>
            <p className="text-sm text-stone-400 mt-1">{total} registered users</p>
          </div>
        </div>
      </motion.div>

      {/* Search */}
      <div className="relative mb-6">
        <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400" />
        <input
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          placeholder="Search users by name or email..."
          className="w-full bg-white border border-stone-200 rounded-xl pl-11 pr-4 py-3 text-sm focus:outline-none focus:border-stone-400 transition-colors"
        />
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-2xl border border-stone-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-10 text-center text-stone-400">Loading...</div>
        ) : users.length === 0 ? (
          <div className="p-10 text-center text-stone-400">No users found</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-stone-100">
                  <th className="text-left text-xs uppercase tracking-widest text-stone-400 font-medium px-6 py-4">User</th>
                  <th className="text-left text-xs uppercase tracking-widest text-stone-400 font-medium px-4 py-4">Email</th>
                  <th className="text-left text-xs uppercase tracking-widest text-stone-400 font-medium px-4 py-4">Role</th>
                  <th className="text-right text-xs uppercase tracking-widest text-stone-400 font-medium px-4 py-4">Referrals</th>
                  <th className="text-right text-xs uppercase tracking-widest text-stone-400 font-medium px-6 py-4">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-50">
                {users.map((user, i) => (
                  <motion.tr
                    key={user.user_id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.03 }}
                    className="hover:bg-stone-50/50 transition-colors"
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full overflow-hidden bg-stone-100 shrink-0 flex items-center justify-center">
                          {user.picture ? (
                            <img src={user.picture} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <UserIcon size={16} className="text-stone-300" />
                          )}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-stone-800">{user.name}</p>
                          <p className="text-xs text-stone-400 font-mono">{user.user_id}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-sm text-stone-600">{user.email}</td>
                    <td className="px-4 py-4">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-medium uppercase tracking-wider ${
                        user.is_admin ? 'bg-stone-900 text-white' : 'bg-stone-100 text-stone-500'
                      }`}>
                        {user.is_admin ? <ShieldAlert size={12} /> : <UserIcon size={12} />}
                        {user.is_admin ? 'Admin' : 'Customer'}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-right text-sm text-stone-600">
                      {user.referral_count || 0}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => toggleAdminRole(user.user_id, user.is_admin)}
                          disabled={user.user_id === currentUser?.user_id}
                          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                            user.user_id === currentUser?.user_id 
                              ? 'opacity-50 cursor-not-allowed bg-stone-50 text-stone-400'
                              : user.is_admin
                                ? 'bg-red-50 text-red-600 hover:bg-red-100'
                                : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
                          }`}
                        >
                          <Shield size={14} />
                          {user.is_admin ? 'Revoke Admin' : 'Make Admin'}
                        </button>
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
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
