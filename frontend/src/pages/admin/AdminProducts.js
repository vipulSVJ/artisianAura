import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Pencil, Trash2, Search, X, ImagePlus, Star, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import API from '@/lib/api';

const emptyProduct = {
  name: '', description: '', story: '', price: '', original_price: '',
  category: '', material: '', color: '', stock: '', featured: false, images: [],
};

export default function AdminProducts() {
  const [products, setProducts] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null); // null = new, object = editing
  const [form, setForm] = useState(emptyProduct);
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [imageUrl, setImageUrl] = useState('');

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', page.toString());
      params.set('limit', '15');
      if (search) params.set('search', search);
      const res = await API.get(`/admin/products?${params.toString()}`);
      setProducts(res.data.products || []);
      setTotal(res.data.total || 0);
      setPages(res.data.pages || 1);
    } catch (err) {
      toast.error('Failed to load products');
    }
    setLoading(false);
  }, [page, search]);

  useEffect(() => { fetchProducts(); }, [fetchProducts]);

  const openNew = () => {
    setEditing(null);
    setForm(emptyProduct);
    setImageUrl('');
    setModalOpen(true);
  };

  const openEdit = (product) => {
    setEditing(product);
    setForm({
      name: product.name || '',
      description: product.description || '',
      story: product.story || '',
      price: product.price?.toString() || '',
      original_price: product.original_price?.toString() || '',
      category: product.category || '',
      material: product.material || '',
      color: product.color || '',
      stock: product.stock?.toString() || '',
      featured: product.featured || false,
      images: product.images || [],
    });
    setImageUrl('');
    setModalOpen(true);
  };

  const addImageUrl = () => {
    if (!imageUrl.trim()) return;
    setForm(prev => ({
      ...prev,
      images: [...prev.images, { url: imageUrl.trim(), source: 'external' }],
    }));
    setImageUrl('');
  };

  const removeImage = (idx) => {
    setForm(prev => ({
      ...prev,
      images: prev.images.filter((_, i) => i !== idx),
    }));
  };

  const handleSave = async () => {
    if (!form.name || !form.price) {
      toast.error('Name and price are required');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        ...form,
        price: parseFloat(form.price),
        original_price: form.original_price ? parseFloat(form.original_price) : null,
        stock: parseInt(form.stock) || 0,
      };
      if (editing) {
        await API.put(`/admin/products/${editing.product_id}`, payload);
        toast.success('Product updated');
      } else {
        await API.post('/admin/products', payload);
        toast.success('Product created');
      }
      setModalOpen(false);
      fetchProducts();
    } catch (err) {
      toast.error('Failed to save product');
    }
    setSaving(false);
  };

  const handleDelete = async (productId) => {
    try {
      await API.delete(`/admin/products/${productId}`);
      toast.success('Product deleted');
      setDeleteConfirm(null);
      fetchProducts();
    } catch (err) {
      toast.error('Failed to delete product');
    }
  };

  const InputField = ({ label, field, type = 'text', ...props }) => (
    <div>
      <label className="text-xs uppercase tracking-wider text-stone-500 mb-1.5 block font-medium">{label}</label>
      <input
        type={type}
        value={form[field]}
        onChange={(e) => setForm(prev => ({ ...prev, [field]: e.target.value }))}
        className="w-full bg-stone-50 border border-stone-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-stone-400 transition-colors"
        {...props}
      />
    </div>
  );

  return (
    <div>
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
        <div className="flex items-center justify-between mb-8">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-[#D4A373] mb-2 font-medium">Manage</p>
            <h1 className="font-heading text-4xl font-light text-stone-900">Products</h1>
            <p className="text-sm text-stone-400 mt-1">{total} total products</p>
          </div>
          <Button
            onClick={openNew}
            className="bg-stone-900 text-white hover:bg-stone-800 rounded-full px-6 py-5 text-xs uppercase tracking-widest"
          >
            <Plus size={16} className="mr-2" /> Add Product
          </Button>
        </div>
      </motion.div>

      {/* Search */}
      <div className="relative mb-6">
        <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400" />
        <input
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          placeholder="Search products..."
          className="w-full bg-white border border-stone-200 rounded-xl pl-11 pr-4 py-3 text-sm focus:outline-none focus:border-stone-400 transition-colors"
        />
      </div>

      {/* Products Table */}
      <div className="bg-white rounded-2xl border border-stone-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-10 text-center text-stone-400">Loading...</div>
        ) : products.length === 0 ? (
          <div className="p-10 text-center text-stone-400">No products found</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-stone-100">
                  <th className="text-left text-xs uppercase tracking-widest text-stone-400 font-medium px-6 py-4">Product</th>
                  <th className="text-left text-xs uppercase tracking-widest text-stone-400 font-medium px-4 py-4">Category</th>
                  <th className="text-right text-xs uppercase tracking-widest text-stone-400 font-medium px-4 py-4">Price</th>
                  <th className="text-right text-xs uppercase tracking-widest text-stone-400 font-medium px-4 py-4">Stock</th>
                  <th className="text-center text-xs uppercase tracking-widest text-stone-400 font-medium px-4 py-4">Featured</th>
                  <th className="text-right text-xs uppercase tracking-widest text-stone-400 font-medium px-6 py-4">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-50">
                {products.map((product, i) => (
                  <motion.tr
                    key={product.product_id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.03 }}
                    className="hover:bg-stone-50/50 transition-colors"
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-xl overflow-hidden bg-stone-100 shrink-0">
                          {product.images?.[0] ? (
                            <img src={product.images[0].url || product.images[0]} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-stone-300">
                              <ImagePlus size={16} />
                            </div>
                          )}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-stone-800 line-clamp-1">{product.name}</p>
                          <p className="text-xs text-stone-400">{product.product_id}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-sm text-stone-600">{product.category}</td>
                    <td className="px-4 py-4 text-sm text-stone-900 font-medium text-right">₹{product.price?.toFixed(2)}</td>
                    <td className="px-4 py-4 text-right">
                      <span className={`text-sm font-medium ${product.stock <= 5 ? 'text-red-600' : 'text-stone-900'}`}>
                        {product.stock}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-center">
                      {product.featured ? (
                        <Star size={16} className="inline text-[#D4A373]" fill="currentColor" />
                      ) : (
                        <Star size={16} className="inline text-stone-200" />
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => openEdit(product)}
                          className="p-2 rounded-lg hover:bg-stone-100 text-stone-500 hover:text-stone-800 transition-colors"
                        >
                          <Pencil size={15} />
                        </button>
                        <button
                          onClick={() => setDeleteConfirm(product.product_id)}
                          className="p-2 rounded-lg hover:bg-red-50 text-stone-400 hover:text-red-600 transition-colors"
                        >
                          <Trash2 size={15} />
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

      {/* Delete Confirmation */}
      <AnimatePresence>
        {deleteConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[100]"
            onClick={() => setDeleteConfirm(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl p-8 max-w-sm mx-4 shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-lg font-medium text-stone-900 mb-2">Delete Product?</h3>
              <p className="text-sm text-stone-500 mb-6">This action cannot be undone.</p>
              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={() => setDeleteConfirm(null)} className="rounded-full">Cancel</Button>
                <Button onClick={() => handleDelete(deleteConfirm)} className="bg-red-600 text-white hover:bg-red-700 rounded-full">Delete</Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Create / Edit Modal */}
      <AnimatePresence>
        {modalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-start justify-center z-[100] overflow-y-auto py-10"
            onClick={() => setModalOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="bg-white rounded-2xl shadow-xl w-full max-w-2xl mx-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6 border-b border-stone-100 flex items-center justify-between">
                <h3 className="text-lg font-medium text-stone-900">
                  {editing ? 'Edit Product' : 'New Product'}
                </h3>
                <button onClick={() => setModalOpen(false)} className="p-2 rounded-lg hover:bg-stone-100 text-stone-400">
                  <X size={18} />
                </button>
              </div>

              <div className="p-6 space-y-5 max-h-[65vh] overflow-y-auto">
                <InputField label="Name" field="name" placeholder="Product name" />

                <div className="grid grid-cols-2 gap-4">
                  <InputField label="Price (₹)" field="price" type="number" placeholder="0.00" />
                  <InputField label="Original Price (₹)" field="original_price" type="number" placeholder="Optional" />
                </div>

                <div>
                  <label className="text-xs uppercase tracking-wider text-stone-500 mb-1.5 block font-medium">Description</label>
                  <textarea
                    value={form.description}
                    onChange={(e) => setForm(prev => ({ ...prev, description: e.target.value }))}
                    rows={3}
                    className="w-full bg-stone-50 border border-stone-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-stone-400 transition-colors resize-none"
                    placeholder="Product description"
                  />
                </div>

                <div>
                  <label className="text-xs uppercase tracking-wider text-stone-500 mb-1.5 block font-medium">Story</label>
                  <textarea
                    value={form.story}
                    onChange={(e) => setForm(prev => ({ ...prev, story: e.target.value }))}
                    rows={2}
                    className="w-full bg-stone-50 border border-stone-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-stone-400 transition-colors resize-none"
                    placeholder="Artisan story behind this product"
                  />
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <InputField label="Category" field="category" placeholder="e.g. Ceramics" />
                  <InputField label="Material" field="material" placeholder="e.g. Clay" />
                  <InputField label="Color" field="color" placeholder="e.g. Sage" />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <InputField label="Stock" field="stock" type="number" placeholder="0" />
                  <div>
                    <label className="text-xs uppercase tracking-wider text-stone-500 mb-1.5 block font-medium">Featured</label>
                    <button
                      onClick={() => setForm(prev => ({ ...prev, featured: !prev.featured }))}
                      className={`w-full border rounded-xl px-4 py-2.5 text-sm text-left transition-colors ${
                        form.featured
                          ? 'bg-[#D4A373]/10 border-[#D4A373] text-[#D4A373]'
                          : 'bg-stone-50 border-stone-200 text-stone-500'
                      }`}
                    >
                      {form.featured ? '★ Featured' : '☆ Not Featured'}
                    </button>
                  </div>
                </div>

                {/* Images */}
                <div>
                  <label className="text-xs uppercase tracking-wider text-stone-500 mb-2 block font-medium">Images</label>
                  <div className="flex gap-2 mb-3">
                    <input
                      value={imageUrl}
                      onChange={(e) => setImageUrl(e.target.value)}
                      placeholder="Paste image URL..."
                      className="flex-1 bg-stone-50 border border-stone-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-stone-400"
                      onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addImageUrl())}
                    />
                    <Button onClick={addImageUrl} variant="outline" className="rounded-xl px-4">
                      <Plus size={16} />
                    </Button>
                  </div>
                  {form.images.length > 0 && (
                    <div className="flex gap-2 flex-wrap">
                      {form.images.map((img, idx) => (
                        <div key={idx} className="relative group w-20 h-20 rounded-xl overflow-hidden bg-stone-100">
                          <img src={img.url || img} alt="" className="w-full h-full object-cover" />
                          <button
                            onClick={() => removeImage(idx)}
                            className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity"
                          >
                            <X size={16} className="text-white" />
                          </button>
                          {img.source && (
                            <span className="absolute bottom-0.5 right-0.5 text-[9px] bg-black/50 text-white px-1 rounded">
                              {img.source === 'cloudinary' ? 'CDN' : <ExternalLink size={8} />}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="p-6 border-t border-stone-100 flex justify-end gap-3">
                <Button variant="outline" onClick={() => setModalOpen(false)} className="rounded-full">Cancel</Button>
                <Button
                  onClick={handleSave}
                  disabled={saving}
                  className="bg-stone-900 text-white hover:bg-stone-800 rounded-full px-8"
                >
                  {saving ? 'Saving...' : editing ? 'Update' : 'Create'}
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
