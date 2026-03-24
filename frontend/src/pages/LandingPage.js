import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, Instagram } from 'lucide-react';
import { ProductCard } from '@/components/ProductCard';
import { Button } from '@/components/ui/button';
import API from '@/lib/api';

const fadeInUp = {
  initial: { opacity: 0, y: 40 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.8, ease: [0.22, 1, 0.36, 1] }
};

const categories = [
  { name: 'Ceramics', image: 'https://images.unsplash.com/photo-1565193566173-7a0ee3dbe261?w=800&q=80', span: 'md:col-span-2 md:row-span-2' },
  { name: 'Candles & Aromas', image: 'https://images.unsplash.com/photo-1602607536880-e3e578ff35f4?w=800&q=80', span: 'md:col-span-2' },
  { name: 'Wall Decor', image: 'https://images.unsplash.com/photo-1513519245088-0e12902e35ca?w=800&q=80', span: 'md:col-span-2' },
  { name: 'Textiles', image: 'https://images.unsplash.com/photo-1540730930241-c9c3a32395f7?w=800&q=80', span: 'md:col-span-2' },
  { name: 'Crochet', image: 'https://images.unsplash.com/photo-1594040226829-7f251ab46d80?w=800&q=80', span: 'md:col-span-2' },
];

const socialProofImages = [
  'https://images.unsplash.com/photo-1602607536880-e3e578ff35f4?w=400&q=80',
  'https://images.unsplash.com/photo-1565193566173-7a0ee3dbe261?w=400&q=80',
  'https://images.unsplash.com/photo-1513519245088-0e12902e35ca?w=400&q=80',
  'https://images.unsplash.com/photo-1540730930241-c9c3a32395f7?w=400&q=80',
  'https://images.unsplash.com/photo-1572726729207-a78d6feb18d7?w=400&q=80',
  'https://images.unsplash.com/photo-1594040226829-7f251ab46d80?w=400&q=80',
];

export default function LandingPage() {
  const [featuredProducts, setFeaturedProducts] = useState([]);

  useEffect(() => {
    const loadProducts = async () => {
      try {
        const res = await API.get('/products?featured=true&limit=4');
        setFeaturedProducts(res.data.products || []);
      } catch { /* ignore */ }
    };
    loadProducts();
    // Seed data on first visit
    API.post('/seed').catch(() => {});
  }, []);

  return (
    <div data-testid="landing-page">
      {/* ─── Hero Section ─── */}
      <section className="relative h-screen flex items-center justify-center overflow-hidden" data-testid="hero-section">
        <div className="absolute inset-0">
          <img
            src="https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?w=1920&q=80"
            alt="Artisanal home decor"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-black/30 to-black/50" />
        </div>
        <div className="relative z-10 text-center max-w-3xl px-6">
          <motion.p
            {...fadeInUp}
            className="text-xs uppercase tracking-[0.3em] text-white/80 mb-6 font-medium"
          >
            Handmade with intention
          </motion.p>
          <motion.h1
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
            className="font-heading text-5xl md:text-7xl lg:text-8xl font-light text-white leading-[0.95] mb-8"
          >
            Where Craft<br />Meets Soul
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="text-base md:text-lg text-white/70 font-light mb-10 max-w-xl mx-auto leading-relaxed"
          >
            Discover artisanal pieces that bring warmth, texture, and timeless beauty to every corner of your home.
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="flex flex-col sm:flex-row gap-4 justify-center"
          >
            <Link to="/shop">
              <Button data-testid="hero-shop-btn" className="bg-white text-stone-900 hover:bg-stone-100 rounded-full px-10 py-6 text-xs uppercase tracking-[0.2em] font-medium">
                Explore Collection
              </Button>
            </Link>
            <Link to="/shop?featured=true">
              <Button variant="outline" className="border-white/40 text-white hover:bg-white/10 rounded-full px-10 py-6 text-xs uppercase tracking-[0.2em] font-medium bg-transparent">
                Featured Picks
              </Button>
            </Link>
          </motion.div>
        </div>

        {/* Scroll indicator */}
        <motion.div
          animate={{ y: [0, 10, 0] }}
          transition={{ repeat: Infinity, duration: 2 }}
          className="absolute bottom-10 left-1/2 -translate-x-1/2"
        >
          <div className="w-px h-16 bg-gradient-to-b from-transparent to-white/50" />
        </motion.div>
      </section>

      {/* ─── Collections Grid ─── */}
      <section className="py-20 md:py-32" data-testid="collections-section">
        <div className="max-w-7xl mx-auto px-6 md:px-12">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="mb-16"
          >
            <p className="text-xs uppercase tracking-[0.3em] text-[#D4A373] mb-4 font-medium">Curated for you</p>
            <h2 className="font-heading text-4xl md:text-5xl font-light text-stone-900 leading-tight">
              Shop by Collection
            </h2>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 auto-rows-[280px]">
            {categories.map((cat, i) => (
              <motion.div
                key={cat.name}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: i * 0.1 }}
                className={cat.span}
              >
                <Link
                  to={`/shop?category=${encodeURIComponent(cat.name)}`}
                  className="group relative block w-full h-full overflow-hidden rounded-2xl"
                  data-testid={`collection-${cat.name.toLowerCase().replace(/\s+/g, '-')}`}
                >
                  <img
                    src={cat.image}
                    alt={cat.name}
                    className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                  <div className="absolute bottom-0 left-0 p-6 md:p-8">
                    <h3 className="font-heading text-2xl md:text-3xl font-light text-white mb-1">{cat.name}</h3>
                    <span className="inline-flex items-center gap-2 text-xs uppercase tracking-widest text-white/70 group-hover:text-white transition-colors">
                      Explore <ArrowRight size={14} />
                    </span>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Featured Products ─── */}
      {featuredProducts.length > 0 && (
        <section className="py-20 md:py-32 bg-stone-50/50" data-testid="featured-products-section">
          <div className="max-w-7xl mx-auto px-6 md:px-12">
            <div className="flex items-end justify-between mb-16">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-[#D4A373] mb-4 font-medium">Crafted with care</p>
                <h2 className="font-heading text-4xl md:text-5xl font-light text-stone-900">Featured Pieces</h2>
              </div>
              <Link
                to="/shop"
                className="hidden md:flex items-center gap-2 text-xs uppercase tracking-widest text-stone-600 hover:text-stone-900 transition-colors"
                data-testid="view-all-link"
              >
                View All <ArrowRight size={14} />
              </Link>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-8 gap-y-12">
              {featuredProducts.map((product, i) => (
                <ProductCard key={product.product_id} product={product} index={i} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ─── Brand Story ─── */}
      <section className="py-20 md:py-32" data-testid="brand-story-section">
        <div className="max-w-7xl mx-auto px-6 md:px-12">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-center">
            <motion.div
              initial={{ opacity: 0, x: -40 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8 }}
            >
              <div className="relative aspect-[4/5] rounded-2xl overflow-hidden">
                <img
                  src="https://images.unsplash.com/photo-1578749556568-bc2c40e68b61?w=800&q=80"
                  alt="Artisan at work"
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              </div>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, x: 40 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8 }}
            >
              <p className="text-xs uppercase tracking-[0.3em] text-[#D4A373] mb-6 font-medium">Our Philosophy</p>
              <h2 className="font-heading text-4xl md:text-5xl font-light text-stone-900 leading-tight mb-8">
                Every Piece Tells a Story
              </h2>
              <p className="text-base text-stone-500 font-light leading-relaxed mb-6">
                We partner with artisan communities across India to bring you objects that are more than decor — they are conversations between maker and material, tradition and innovation.
              </p>
              <p className="text-base text-stone-500 font-light leading-relaxed mb-10">
                Each piece in our collection is handmade using time-honored techniques, from wheel-thrown ceramics to hand-knotted macrame. We believe in slow making, fair wages, and the quiet power of a beautifully crafted object.
              </p>
              <Link to="/shop">
                <Button className="bg-stone-900 text-white hover:bg-stone-800 rounded-full px-8 py-6 text-xs uppercase tracking-[0.2em]" data-testid="story-shop-btn">
                  Discover Our Craft
                </Button>
              </Link>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ─── Styled by You / Social Proof ─── */}
      <section className="py-20 md:py-32 bg-stone-50/50" data-testid="social-proof-section">
        <div className="max-w-7xl mx-auto px-6 md:px-12">
          <div className="text-center mb-16">
            <p className="text-xs uppercase tracking-[0.3em] text-[#D4A373] mb-4 font-medium">Styled by You</p>
            <h2 className="font-heading text-4xl md:text-5xl font-light text-stone-900 mb-4">
              Real Homes, Real Stories
            </h2>
            <p className="text-base text-stone-500 font-light max-w-xl mx-auto">
              See how our community brings Artisan & Aura into their spaces. Tag us to be featured.
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {socialProofImages.map((img, i) => (
              <motion.a
                key={i}
                href="https://instagram.com"
                target="_blank"
                rel="noopener noreferrer"
                initial={{ opacity: 0, scale: 0.95 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.08 }}
                className="group relative aspect-square overflow-hidden rounded-xl"
                data-testid={`social-proof-${i}`}
              >
                <img src={img} alt="Customer styled home" className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" loading="lazy" />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors duration-300 flex items-center justify-center">
                  <Instagram className="text-white opacity-0 group-hover:opacity-100 transition-opacity duration-300" size={24} />
                </div>
              </motion.a>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Newsletter CTA ─── */}
      <section className="py-20 md:py-32" data-testid="newsletter-section">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <p className="text-xs uppercase tracking-[0.3em] text-[#D4A373] mb-6 font-medium">Stay in Touch</p>
          <h2 className="font-heading text-4xl md:text-5xl font-light text-stone-900 mb-6">
            Join the Artisan Circle
          </h2>
          <p className="text-base text-stone-500 font-light mb-10">
            Be the first to discover new collections, artisan stories, and exclusive offers.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto">
            <input
              type="email"
              placeholder="Your email address"
              className="flex-1 bg-transparent border-b border-stone-300 px-0 py-4 text-stone-800 placeholder:text-stone-400 focus:outline-none focus:border-stone-800 transition-colors"
              data-testid="newsletter-email-input"
            />
            <Button className="bg-stone-900 text-white hover:bg-stone-800 rounded-full px-8 py-4 text-xs uppercase tracking-[0.2em] whitespace-nowrap" data-testid="newsletter-subscribe-btn">
              Subscribe
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
