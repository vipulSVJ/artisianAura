import { Link } from 'react-router-dom';
import { Instagram, Youtube, MapPin, Mail, Phone } from 'lucide-react';

const PinterestIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="17" x2="12" y2="8" /><path d="M8 21c1.5-1 2-3 2.5-5.5" /><path d="M15.5 21c-1.5-1-2-3-2.5-5.5" /><circle cx="12" cy="12" r="10" />
  </svg>
);

export const Footer = () => {
  return (
    <footer data-testid="site-footer" className="bg-stone-900 text-stone-300 py-20 md:py-32">
      <div className="max-w-7xl mx-auto px-6 md:px-12">
        {/* Top section */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 md:gap-16 mb-16">
          {/* Brand */}
          <div className="lg:col-span-1">
            <h2 className="font-heading text-3xl font-light text-stone-100 mb-4">Artisan & Aura</h2>
            <p className="text-sm leading-relaxed text-stone-400 mb-6">
              A sanctuary for handmade, artisanal interior decor. Every piece tells a story of craftsmanship, tradition, and care.
            </p>
            <div className="flex gap-4">
              <a href="https://instagram.com" target="_blank" rel="noopener noreferrer" className="p-2.5 border border-stone-700 rounded-full hover:border-[#D4A373] hover:text-[#D4A373] transition-colors duration-300" data-testid="footer-instagram">
                <Instagram size={18} />
              </a>
              <a href="https://pinterest.com" target="_blank" rel="noopener noreferrer" className="p-2.5 border border-stone-700 rounded-full hover:border-[#D4A373] hover:text-[#D4A373] transition-colors duration-300" data-testid="footer-pinterest">
                <PinterestIcon />
              </a>
              <a href="https://youtube.com" target="_blank" rel="noopener noreferrer" className="p-2.5 border border-stone-700 rounded-full hover:border-[#D4A373] hover:text-[#D4A373] transition-colors duration-300" data-testid="footer-youtube">
                <Youtube size={18} />
              </a>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="text-xs uppercase tracking-[0.2em] text-stone-100 font-medium mb-6">Shop</h3>
            <div className="space-y-3">
              <Link to="/shop?category=Ceramics" className="block text-sm text-stone-400 hover:text-[#D4A373] transition-colors">Ceramics</Link>
              <Link to="/shop?category=Candles+%26+Aromas" className="block text-sm text-stone-400 hover:text-[#D4A373] transition-colors">Candles & Aromas</Link>
              <Link to="/shop?category=Wall+Decor" className="block text-sm text-stone-400 hover:text-[#D4A373] transition-colors">Wall Decor</Link>
              <Link to="/shop?category=Textiles" className="block text-sm text-stone-400 hover:text-[#D4A373] transition-colors">Textiles</Link>
              <Link to="/shop?category=Crochet" className="block text-sm text-stone-400 hover:text-[#D4A373] transition-colors">Crochet</Link>
            </div>
          </div>

          {/* Help */}
          <div>
            <h3 className="text-xs uppercase tracking-[0.2em] text-stone-100 font-medium mb-6">Help</h3>
            <div className="space-y-3">
              <Link to="/shop" className="block text-sm text-stone-400 hover:text-[#D4A373] transition-colors">All Products</Link>
              <Link to="/orders" className="block text-sm text-stone-400 hover:text-[#D4A373] transition-colors">Order Tracking</Link>
              <Link to="/profile" className="block text-sm text-stone-400 hover:text-[#D4A373] transition-colors">My Account</Link>
            </div>
          </div>

          {/* Contact */}
          <div>
            <h3 className="text-xs uppercase tracking-[0.2em] text-stone-100 font-medium mb-6">Contact</h3>
            <div className="space-y-3">
              <div className="flex items-center gap-3 text-sm text-stone-400">
                <MapPin size={16} className="text-[#D4A373] shrink-0" />
                <span>Jaipur, Rajasthan, India</span>
              </div>
              <div className="flex items-center gap-3 text-sm text-stone-400">
                <Mail size={16} className="text-[#D4A373] shrink-0" />
                <span>hello@artisanaura.com</span>
              </div>
              <div className="flex items-center gap-3 text-sm text-stone-400">
                <Phone size={16} className="text-[#D4A373] shrink-0" />
                <span>+91 98765 43210</span>
              </div>
            </div>
          </div>
        </div>

        {/* Divider */}
        <div className="border-t border-stone-800 pt-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-xs text-stone-500">2025 Artisan & Aura. Crafted with care.</p>
          <p className="text-xs text-stone-500 italic font-heading text-lg">Follow our journey</p>
        </div>
      </div>
    </footer>
  );
};
