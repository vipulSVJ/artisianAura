import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { User, Package, Heart, LogOut, Save, Gift, Copy, Share2, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import API from '@/lib/api';

export default function ProfilePage() {
  const { user, login, logout, checkAuth } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState({ street: '', city: '', state: '', zip: '' });
  const [saving, setSaving] = useState(false);
  const [referralStats, setReferralStats] = useState({ referral_code: '', referral_count: 0 });
  const [codeCopied, setCodeCopied] = useState(false);
  const [referralInput, setReferralInput] = useState('');

  useEffect(() => {
    if (user) {
      setName(user.name || '');
      setPhone(user.phone || '');
      setAddress(user.address || { street: '', city: '', state: '', zip: '' });
      // Fetch referral stats
      API.get('/referral/stats').then(res => setReferralStats(res.data)).catch(() => {});
    }
  }, [user]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await API.put('/profile', { name, phone, address });
      await checkAuth();
      toast.success('Profile updated');
    } catch {
      toast.error('Failed to update profile');
    }
    setSaving(false);
  };

  const copyReferralCode = () => {
    const code = referralStats.referral_code;
    if (!code) return;
    navigator.clipboard.writeText(code).then(() => {
      setCodeCopied(true);
      toast.success('Referral code copied!');
      setTimeout(() => setCodeCopied(false), 2000);
    }).catch(() => {});
  };

  const shareReferral = () => {
    const code = referralStats.referral_code;
    const link = `${window.location.origin}/shop?ref=${code}`;
    const text = `Join Artisan & Aura and get 10% off your first order! Use my referral code: ${code} — ${link}`;
    if (navigator.share) {
      navigator.share({ title: 'Artisan & Aura Referral', text, url: link }).catch(() => {});
    } else {
      navigator.clipboard.writeText(text).then(() => toast.success('Referral link copied!')).catch(() => {});
    }
  };

  const applyReferralCode = async () => {
    if (!referralInput.trim()) return;
    try {
      const res = await API.post('/referral/apply', { code: referralInput.trim() });
      toast.success(res.data.message);
      setReferralInput('');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to apply referral');
    }
  };

  if (!user) {
    return (
      <div className="pt-24 pb-20 min-h-screen flex items-center justify-center" data-testid="profile-page">
        <div className="text-center">
          <User size={48} className="mx-auto text-stone-300 mb-6" />
          <h2 className="font-heading text-3xl text-stone-900 mb-4">Sign in to your account</h2>
          <Button onClick={login} className="bg-stone-900 text-white hover:bg-stone-800 rounded-full px-8 py-6 text-xs uppercase tracking-widest" data-testid="profile-sign-in-btn">
            Sign In
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="pt-24 pb-20 min-h-screen" data-testid="profile-page">
      <div className="max-w-3xl mx-auto px-6 md:px-12">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
          <p className="text-xs uppercase tracking-[0.3em] text-[#D4A373] mb-3 font-medium">My Account</p>
          <h1 className="font-heading text-4xl md:text-5xl font-light text-stone-900 mb-12">Profile</h1>
        </motion.div>

        {/* Profile header */}
        <div className="flex items-center gap-6 mb-10">
          <div className="w-20 h-20 rounded-full overflow-hidden bg-stone-100 shrink-0">
            {user.picture ? (
              <img src={user.picture} alt={user.name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-[#D4A373]/20 text-[#D4A373] font-heading text-2xl">
                {user.name?.charAt(0)?.toUpperCase()}
              </div>
            )}
          </div>
          <div>
            <h2 className="font-heading text-2xl text-stone-900">{user.name}</h2>
            <p className="text-sm text-stone-500">{user.email}</p>
          </div>
        </div>

        {/* Quick Links */}
        <div className="grid grid-cols-2 gap-4 mb-10">
          <button
            onClick={() => navigate('/orders')}
            className="flex items-center gap-3 p-5 border border-stone-100 rounded-2xl hover:border-stone-300 transition-colors text-left"
            data-testid="profile-orders-link"
          >
            <Package size={20} className="text-[#D4A373]" />
            <div>
              <p className="text-sm font-medium text-stone-800">Orders</p>
              <p className="text-xs text-stone-400">Track your orders</p>
            </div>
          </button>
          <button
            onClick={() => navigate('/wishlist')}
            className="flex items-center gap-3 p-5 border border-stone-100 rounded-2xl hover:border-stone-300 transition-colors text-left"
            data-testid="profile-wishlist-link"
          >
            <Heart size={20} className="text-[#D4A373]" />
            <div>
              <p className="text-sm font-medium text-stone-800">Wishlist</p>
              <p className="text-xs text-stone-400">Saved items</p>
            </div>
          </button>
        </div>

        <Separator className="mb-10" />

        {/* Refer & Earn */}
        <div className="mb-10" data-testid="referral-section">
          <div className="bg-gradient-to-br from-[#D4A373]/10 to-stone-50 rounded-2xl p-8 border border-[#D4A373]/20">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-[#D4A373]/20 rounded-full flex items-center justify-center">
                <Gift size={20} className="text-[#D4A373]" />
              </div>
              <div>
                <h3 className="text-sm uppercase tracking-widest text-stone-800 font-medium">Refer & Earn</h3>
                <p className="text-xs text-stone-500 mt-0.5">Share the love, earn 10% off for you and your friend</p>
              </div>
            </div>

            {referralStats.referral_code ? (
              <>
                <div className="flex items-center gap-3 mb-4">
                  <div className="flex-1 bg-white border border-stone-200 rounded-xl px-4 py-3 font-mono text-lg tracking-wider text-stone-800 text-center">
                    {referralStats.referral_code}
                  </div>
                  <Button
                    size="sm"
                    onClick={copyReferralCode}
                    className="rounded-full px-4 py-5 bg-stone-900 text-white hover:bg-stone-800"
                    data-testid="copy-referral-btn"
                  >
                    {codeCopied ? <Check size={16} /> : <Copy size={16} />}
                  </Button>
                  <Button
                    size="sm"
                    onClick={shareReferral}
                    variant="outline"
                    className="rounded-full px-4 py-5 border-stone-300"
                    data-testid="share-referral-btn"
                  >
                    <Share2 size={16} />
                  </Button>
                </div>
                <div className="flex items-center gap-6 text-sm">
                  <span className="text-stone-500">Friends referred: <span className="font-medium text-stone-800">{referralStats.referral_count}</span></span>
                </div>
              </>
            ) : (
              <p className="text-sm text-stone-500">Generating your referral code...</p>
            )}

            {/* Apply someone else's code */}
            {!user?.referred_by && (
              <div className="mt-6 pt-6 border-t border-stone-200/50">
                <p className="text-xs uppercase tracking-widest text-stone-500 mb-3 font-medium">Have a referral code?</p>
                <div className="flex gap-2">
                  <input
                    value={referralInput}
                    onChange={e => setReferralInput(e.target.value)}
                    placeholder="Enter code"
                    className="flex-1 bg-white border border-stone-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-stone-400"
                    data-testid="apply-referral-input"
                  />
                  <Button
                    onClick={applyReferralCode}
                    className="bg-[#D4A373] text-white hover:bg-[#c49366] rounded-xl px-6"
                    data-testid="apply-referral-btn"
                  >
                    Apply
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>

        <Separator className="mb-10" />

        {/* Edit Profile */}
        <div className="space-y-6">
          <h3 className="text-sm uppercase tracking-widest text-stone-500 font-medium">Edit Profile</h3>

          <div>
            <label className="text-xs uppercase tracking-wider text-stone-500 mb-2 block">Name</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full bg-white border border-stone-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-stone-400"
              data-testid="profile-name-input"
            />
          </div>

          <div>
            <label className="text-xs uppercase tracking-wider text-stone-500 mb-2 block">Phone</label>
            <input
              value={phone}
              onChange={e => setPhone(e.target.value)}
              className="w-full bg-white border border-stone-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-stone-400"
              data-testid="profile-phone-input"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs uppercase tracking-wider text-stone-500 mb-2 block">Street</label>
              <input
                value={address.street || ''}
                onChange={e => setAddress({ ...address, street: e.target.value })}
                className="w-full bg-white border border-stone-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-stone-400"
                data-testid="profile-street-input"
              />
            </div>
            <div>
              <label className="text-xs uppercase tracking-wider text-stone-500 mb-2 block">City</label>
              <input
                value={address.city || ''}
                onChange={e => setAddress({ ...address, city: e.target.value })}
                className="w-full bg-white border border-stone-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-stone-400"
                data-testid="profile-city-input"
              />
            </div>
          </div>

          <div className="flex gap-4">
            <Button
              onClick={handleSave}
              disabled={saving}
              className="bg-stone-900 text-white hover:bg-stone-800 rounded-full px-8 py-6 text-xs uppercase tracking-[0.2em]"
              data-testid="profile-save-btn"
            >
              <Save size={16} className="mr-2" /> {saving ? 'Saving...' : 'Save Changes'}
            </Button>
            <Button
              variant="outline"
              onClick={async () => { await logout(); navigate('/'); }}
              className="rounded-full px-8 py-6 text-xs uppercase tracking-wider border-stone-300 text-red-500 hover:bg-red-50 hover:border-red-300"
              data-testid="profile-logout-btn"
            >
              <LogOut size={16} className="mr-2" /> Sign Out
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
