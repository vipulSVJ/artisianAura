import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ShoppingBag, Heart, User, Menu, X, Search, LogOut } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useCart } from '@/contexts/CartContext';
import { Button } from '@/components/ui/button';

export const Navbar = () => {
  const { user, login, logout } = useAuth();
  const { cartCount, fetchCart } = useCart();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    if (user) fetchCart();
  }, [user, fetchCart]);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
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
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
        scrolled
          ? 'bg-[#FDFBF7]/90 backdrop-blur-xl border-b border-stone-200/50 shadow-[0_4px_30px_rgba(0,0,0,0.03)]'
          : 'bg-transparent'
      }`}
    >
      <div className="max-w-7xl mx-auto px-6 md:px-12">
        <div className="flex items-center justify-between h-20">
          {/* Left nav links - desktop */}
          <div className="hidden lg:flex items-center gap-8">
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

          {/* Mobile menu button */}
          <button
            data-testid="mobile-menu-toggle"
            className="lg:hidden p-2 text-stone-600 hover:text-stone-900"
            onClick={() => setMenuOpen(!menuOpen)}
          >
            {menuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>

          {/* Center logo */}
          <Link to="/" className="absolute left-1/2 -translate-x-1/2" data-testid="brand-logo">
            <h1 className="font-heading text-2xl md:text-3xl font-light tracking-tight text-stone-900">
              Artisan & Aura
            </h1>
          </Link>

          {/* Right icons */}
          <div className="flex items-center gap-4">
            <button
              data-testid="search-icon"
              className="hidden md:flex p-2 text-stone-500 hover:text-stone-900 transition-colors"
              onClick={() => navigate('/shop')}
            >
              <Search size={18} />
            </button>

            {user ? (
              <>
                <Link to="/wishlist" data-testid="wishlist-icon" className="p-2 text-stone-500 hover:text-stone-900 transition-colors">
                  <Heart size={18} />
                </Link>
                <Link to="/cart" data-testid="cart-icon" className="relative p-2 text-stone-500 hover:text-stone-900 transition-colors">
                  <ShoppingBag size={18} />
                  {cartCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-[#D4A373] text-white text-[10px] flex items-center justify-center rounded-full">
                      {cartCount}
                    </span>
                  )}
                </Link>
                <Link to="/profile" data-testid="profile-icon" className="p-2 text-stone-500 hover:text-stone-900 transition-colors">
                  <User size={18} />
                </Link>
                <button
                  data-testid="logout-btn"
                  className="hidden md:flex p-2 text-stone-500 hover:text-stone-900 transition-colors"
                  onClick={logout}
                >
                  <LogOut size={18} />
                </button>
              </>
            ) : (
              <Button
                data-testid="login-btn"
                onClick={login}
                className="bg-stone-900 text-white hover:bg-stone-800 rounded-full px-6 py-2 text-xs uppercase tracking-widest"
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
