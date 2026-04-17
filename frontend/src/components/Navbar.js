import { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { ShoppingBag, Heart, User, Menu, X, Search, LogOut, Shield } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useCart } from '@/contexts/CartContext';
import { Button } from '@/components/ui/button';

export const Navbar = () => {
  const { user, login, logout } = useAuth();
  const { cartCount, fetchCart } = useCart();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  const isLanding = location.pathname === '/';
  const showFullNav = !isLanding || scrolled;

  useEffect(() => {
    if (user) fetchCart();
  }, [user, fetchCart]);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 60);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const navLinks = [
    { label: 'Shop', path: '/shop' },
    { label: 'Ceramics', path: '/shop?category=Ceramics' },
    { label: 'Candles', path: '/shop?category=Candles+%26+Aromas' },
    { label: 'Wall Decor', path: '/shop?category=Wall+Decor' },
    { label: 'Textiles', path: '/shop?category=Textiles' },
  ];

  return (
    <nav
      data-testid="main-navbar"
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] ${
        showFullNav
          ? 'bg-[#FDFBF7]/90 backdrop-blur-xl border-b border-stone-200/50 shadow-[0_4px_30px_rgba(0,0,0,0.03)]'
          : 'bg-transparent'
      }`}
    >
      <div className="max-w-7xl mx-auto px-6 md:px-12">
        <div className="relative flex items-center justify-between h-20">
          {/* Mobile menu button */}
          <button
            data-testid="mobile-menu-toggle"
            className={`lg:hidden p-2 transition-colors duration-300 ${showFullNav ? 'text-stone-600 hover:text-stone-900' : 'text-white/80 hover:text-white'}`}
            onClick={() => setMenuOpen(!menuOpen)}
          >
            {menuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>

          {/* Brand name — animated from center to left (desktop only) */}
          <Link
            to="/"
            data-testid="brand-logo"
            className={`absolute top-1/2 -translate-y-1/2 transition-all duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] ${
              showFullNav
                ? 'left-1/2 -translate-x-1/2 lg:left-0 lg:translate-x-0'
                : 'left-1/2 -translate-x-1/2'
            }`}
          >
            <h1 className={`font-heading font-light tracking-tight whitespace-nowrap transition-all duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] ${
              showFullNav
                ? 'text-xl md:text-2xl text-stone-900'
                : 'text-2xl md:text-3xl lg:text-4xl text-white'
            }`}>
              Artisan & Aura
            </h1>
          </Link>

          {/* Center nav links — fade in on scroll */}
          <div className={`hidden lg:flex items-center gap-8 absolute left-1/2 -translate-x-1/2 transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${
            showFullNav
              ? 'opacity-100 translate-y-0 visible'
              : 'opacity-0 -translate-y-3 pointer-events-none invisible'
          }`}>
            {navLinks.map(link => (
              <Link
                key={link.path}
                to={link.path}
                className="text-xs uppercase tracking-[0.2em] text-stone-500 hover:text-stone-900 transition-colors duration-300 font-medium"
              >
                {link.label}
              </Link>
            ))}
          </div>

          {/* Right icons — always visible but color changes */}
          <div className="flex items-center gap-4 ml-auto">
            <button
              data-testid="search-icon"
              className={`hidden md:flex p-2 transition-colors duration-500 ${
                showFullNav ? 'text-stone-500 hover:text-stone-900' : 'text-white/70 hover:text-white'
              } ${showFullNav ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
              onClick={() => navigate('/shop')}
            >
              <Search size={18} />
            </button>

            {user ? (
              <>
                <Link
                  to="/wishlist"
                  data-testid="wishlist-icon"
                  className={`p-2 transition-colors duration-500 ${
                    showFullNav ? 'text-stone-500 hover:text-stone-900' : 'text-white/70 hover:text-white'
                  }`}
                >
                  <Heart size={18} />
                </Link>
                <Link
                  to="/cart"
                  data-testid="cart-icon"
                  className={`relative p-2 transition-colors duration-500 ${
                    showFullNav ? 'text-stone-500 hover:text-stone-900' : 'text-white/70 hover:text-white'
                  }`}
                >
                  <ShoppingBag size={18} />
                  {cartCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-[#D4A373] text-white text-[10px] flex items-center justify-center rounded-full">
                      {cartCount}
                    </span>
                  )}
                </Link>
                <Link
                  to="/profile"
                  data-testid="profile-icon"
                  className={`p-2 transition-colors duration-500 ${
                    showFullNav ? 'text-stone-500 hover:text-stone-900' : 'text-white/70 hover:text-white'
                  }`}
                >
                  <User size={18} />
                </Link>
                <button
                  data-testid="logout-btn"
                  className={`hidden md:flex p-2 transition-all duration-500 ${
                    showFullNav ? 'text-stone-500 hover:text-stone-900 opacity-100' : 'opacity-0 pointer-events-none'
                  }`}
                  onClick={logout}
                >
                  <LogOut size={18} />
                </button>
                {user.is_admin && (
                  <Link
                    to="/admin"
                    data-testid="admin-link"
                    className={`hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] uppercase tracking-widest font-medium transition-all duration-500 ${
                      showFullNav
                        ? 'bg-[#D4A373]/10 text-[#D4A373] hover:bg-[#D4A373]/20 opacity-100'
                        : 'opacity-0 pointer-events-none'
                    }`}
                  >
                    <Shield size={12} /> Admin
                  </Link>
                )}
              </>
            ) : (
              <Button
                data-testid="login-btn"
                onClick={login}
                className={`rounded-full px-6 py-2 text-xs uppercase tracking-widest transition-all duration-500 ${
                  showFullNav
                    ? 'bg-stone-900 text-white hover:bg-stone-800'
                    : 'bg-white/20 backdrop-blur-sm text-white border border-white/30 hover:bg-white/30'
                }`}
              >
                Sign In
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="lg:hidden bg-[#FDFBF7] border-t border-stone-200 px-6 py-6 space-y-4">
          {navLinks.map(link => (
            <Link
              key={link.path}
              to={link.path}
              className="block text-sm uppercase tracking-widest text-stone-600 hover:text-stone-900 py-2"
              onClick={() => setMenuOpen(false)}
            >
              {link.label}
            </Link>
          ))}
          {user && (
            <>
              <Link to="/orders" className="block text-sm uppercase tracking-widest text-stone-600 py-2" onClick={() => setMenuOpen(false)}>Orders</Link>
              {user.is_admin && (
                <Link to="/admin" className="block text-sm uppercase tracking-widest text-[#D4A373] py-2" onClick={() => setMenuOpen(false)}>Admin Panel</Link>
              )}
              <button
                className="block text-sm uppercase tracking-widest text-stone-600 py-2"
                onClick={() => { logout(); setMenuOpen(false); }}
              >
                Sign Out
              </button>
            </>
          )}
        </div>
      )}
    </nav>
  );
};
