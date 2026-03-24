import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { SlidersHorizontal, X, ChevronDown } from 'lucide-react';
import { ProductCard } from '@/components/ProductCard';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import API from '@/lib/api';

export default function ProductListingPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [products, setProducts] = useState([]);
  const [filters, setFilters] = useState({ categories: [], materials: [], colors: [] });
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const category = searchParams.get('category') || '';
  const material = searchParams.get('material') || '';
  const color = searchParams.get('color') || '';
  const sort = searchParams.get('sort') || 'newest';
  const search = searchParams.get('search') || '';
  const page = parseInt(searchParams.get('page') || '1');

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (category) params.set('category', category);
      if (material) params.set('material', material);
      if (color) params.set('color', color);
      if (sort) params.set('sort', sort);
      if (search) params.set('search', search);
      params.set('page', page.toString());
      params.set('limit', '12');

      const res = await API.get(`/products?${params.toString()}`);
      setProducts(res.data.products || []);
      setTotal(res.data.total || 0);
      setPages(res.data.pages || 1);
    } catch { /* ignore */ }
    setLoading(false);
  }, [category, material, color, sort, search, page]);

  const fetchFilters = useCallback(async () => {
    try {
      const res = await API.get('/filters');
      setFilters(res.data);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    fetchProducts();
    fetchFilters();
  }, [fetchProducts, fetchFilters]);

  const updateFilter = (key, value) => {
    const params = new URLSearchParams(searchParams);
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    params.set('page', '1');
    setSearchParams(params);
  };

  const clearFilters = () => {
    setSearchParams({});
  };

  const activeFilterCount = [category, material, color, search].filter(Boolean).length;

  return (
    <div className="pt-24 pb-20 min-h-screen" data-testid="product-listing-page">
      <div className="max-w-7xl mx-auto px-6 md:px-12">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="mb-12"
        >
          <p className="text-xs uppercase tracking-[0.3em] text-[#D4A373] mb-3 font-medium">Our Collection</p>
          <h1 className="font-heading text-4xl md:text-5xl font-light text-stone-900">
            {category || 'All Products'}
          </h1>
          <p className="text-base text-stone-500 font-light mt-3">{total} pieces found</p>
        </motion.div>

        {/* Filter bar */}
        <div className="flex flex-wrap items-center gap-4 mb-10 border-b border-stone-200 pb-6">
          {/* Search */}
          <div className="flex-1 min-w-[200px]">
            <input
              type="text"
              placeholder="Search products..."
              value={search}
              onChange={(e) => updateFilter('search', e.target.value)}
              className="w-full bg-transparent border-b border-stone-300 px-0 py-3 text-sm text-stone-800 placeholder:text-stone-400 focus:outline-none focus:border-stone-800 transition-colors"
              data-testid="product-search-input"
            />
          </div>

          {/* Sort */}
          <Select value={sort} onValueChange={(v) => updateFilter('sort', v)}>
            <SelectTrigger className="w-[180px] border-stone-300 rounded-full text-xs uppercase tracking-wider" data-testid="sort-select">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">Newest</SelectItem>
              <SelectItem value="price_asc">Price: Low to High</SelectItem>
              <SelectItem value="price_desc">Price: High to Low</SelectItem>
              <SelectItem value="popular">Most Popular</SelectItem>
            </SelectContent>
          </Select>

          {/* Filter toggle (mobile) */}
          <Button
            variant="outline"
            onClick={() => setFiltersOpen(!filtersOpen)}
            className="rounded-full text-xs uppercase tracking-wider border-stone-300"
            data-testid="filter-toggle-btn"
          >
            <SlidersHorizontal size={14} className="mr-2" />
            Filters {activeFilterCount > 0 && `(${activeFilterCount})`}
          </Button>

          {activeFilterCount > 0 && (
            <Button
              variant="ghost"
              onClick={clearFilters}
              className="text-xs uppercase tracking-wider text-stone-500 hover:text-stone-900"
              data-testid="clear-filters-btn"
            >
              <X size={14} className="mr-1" /> Clear
            </Button>
          )}
        </div>

        {/* Filters panel */}
        {filtersOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="mb-10 p-6 bg-stone-50/80 rounded-2xl border border-stone-100"
            data-testid="filters-panel"
          >
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              {/* Category */}
              <div>
                <label className="text-xs uppercase tracking-widest text-stone-500 mb-3 block font-medium">Category</label>
                <div className="space-y-2">
                  {filters.categories.map(cat => (
                    <button
                      key={cat}
                      onClick={() => updateFilter('category', category === cat ? '' : cat)}
                      className={`block text-sm transition-colors ${category === cat ? 'text-[#D4A373] font-medium' : 'text-stone-600 hover:text-stone-900'}`}
                      data-testid={`filter-category-${cat.toLowerCase().replace(/\s+/g, '-')}`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              {/* Material */}
              <div>
                <label className="text-xs uppercase tracking-widest text-stone-500 mb-3 block font-medium">Material</label>
                <div className="space-y-2">
                  {filters.materials.map(mat => (
                    <button
                      key={mat}
                      onClick={() => updateFilter('material', material === mat ? '' : mat)}
                      className={`block text-sm transition-colors ${material === mat ? 'text-[#D4A373] font-medium' : 'text-stone-600 hover:text-stone-900'}`}
                      data-testid={`filter-material-${mat.toLowerCase().replace(/\s+/g, '-')}`}
                    >
                      {mat}
                    </button>
                  ))}
                </div>
              </div>

              {/* Color */}
              <div>
                <label className="text-xs uppercase tracking-widest text-stone-500 mb-3 block font-medium">Color</label>
                <div className="space-y-2">
                  {filters.colors.map(col => (
                    <button
                      key={col}
                      onClick={() => updateFilter('color', color === col ? '' : col)}
                      className={`block text-sm transition-colors ${color === col ? 'text-[#D4A373] font-medium' : 'text-stone-600 hover:text-stone-900'}`}
                      data-testid={`filter-color-${col.toLowerCase().replace(/\s+/g, '-')}`}
                    >
                      {col}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* Products Grid */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-16">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="animate-pulse">
                <div className="aspect-[3/4] bg-stone-100 rounded-2xl mb-4" />
                <div className="h-3 bg-stone-100 rounded w-1/3 mb-2" />
                <div className="h-5 bg-stone-100 rounded w-2/3 mb-2" />
                <div className="h-4 bg-stone-100 rounded w-1/4" />
              </div>
            ))}
          </div>
        ) : products.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-stone-400 text-lg font-light">No products found matching your criteria.</p>
            <Button onClick={clearFilters} className="mt-6 rounded-full" data-testid="no-results-clear-btn">
              Clear Filters
            </Button>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-16">
              {products.map((product, i) => (
                <ProductCard key={product.product_id} product={product} index={i} />
              ))}
            </div>

            {/* Pagination */}
            {pages > 1 && (
              <div className="flex justify-center gap-2 mt-16">
                {[...Array(pages)].map((_, i) => (
                  <button
                    key={i}
                    onClick={() => updateFilter('page', (i + 1).toString())}
                    className={`w-10 h-10 rounded-full text-sm font-medium transition-colors ${
                      page === i + 1
                        ? 'bg-stone-900 text-white'
                        : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                    }`}
                    data-testid={`page-${i + 1}`}
                  >
                    {i + 1}
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
