import { useState, useEffect, useRef } from 'react';
import { 
  XMarkIcon, 
  PlusIcon, 
  PhotoIcon,
  InformationCircleIcon,
  ChartBarIcon,
  CubeIcon,
  TagIcon
} from '@heroicons/react/24/outline';
import Card from '../shared/Card';
import Input from '../shared/Input';
import Button from '../shared/Button';
import Badge from '../shared/Badge';
import { calculateMargin, calculateProfit, formatCurrency } from '../../utils/helpers';
import { platformsAPI } from '../../api/client';

export const ProductForm = ({ 
  initialData = null, 
  onSubmit, 
  onCancel,
  isLoading = false,
}) => {
  const defaultFormData = {
    sku: '',
    name: '',
    description: '',
    short_description: '',
    price: '',
    compare_at_price: '',
    cost: '',
    inventory_qty: 0,
    track_inventory: true,
    status: 'draft',
    product_type: 'simple',
    tags: [],
    categories: [],
    images: [],
    weight: '',
    dimensions: { length: '', width: '', height: '' },
    virtual: false,
    downloadable: false,
    downloads: [],
    download_limit: '',
    download_expiry: '',
    upsells: [],
    cross_sells: [],
    pdp_template: null
  };
  
  const [formData, setFormData] = useState(() => {
    if (!initialData) return defaultFormData;
    return {
      ...defaultFormData,
      ...initialData,
      tags: initialData.tags || [],
      categories: initialData.categories || [],
      images: initialData.images || [],
      downloads: initialData.downloads || [],
      upsells: initialData.upsells || [],
      cross_sells: initialData.cross_sells || [],
      short_description: initialData.short_description || '',
      description: initialData.description || '',
      name: initialData.name || '',
      sku: initialData.sku || '',
      dimensions: initialData.dimensions || { length: '', width: '', height: '' },
    };
  });
  
  const [newTag, setNewTag] = useState('');
  const [newCategory, setNewCategory] = useState('');
  const [openSections, setOpenSections] = useState({ basic: true, pricing: false, inventory: false, organization: false });
  const [validationErrors, setValidationErrors] = useState({});
  const fileInputRef = useRef(null);
  const [wooCategories, setWooCategories] = useState([]);
  const [categorySuggestions, setCategorySuggestions] = useState([]);
  
  const margin = calculateMargin(formData.price, formData.cost);
  const profit = calculateProfit(formData.price, formData.cost);
  const savings = formData.compare_at_price && formData.price 
    ? ((formData.compare_at_price - formData.price) / formData.compare_at_price * 100).toFixed(0)
    : null;
  
  useEffect(() => {
    const errors = {};
    if (formData.price && formData.compare_at_price) {
      if (parseFloat(formData.price) >= parseFloat(formData.compare_at_price)) {
        errors.compare_at_price = 'Compare price must be higher than regular price';
      }
    }
    if (formData.inventory_qty < 0) {
      errors.inventory_qty = 'Stock quantity cannot be negative';
    }
    setValidationErrors(errors);
  }, [formData.price, formData.compare_at_price, formData.inventory_qty]);

  useEffect(() => {
    (async () => {
      try {
        const res = await platformsAPI.wooCategories();
        setWooCategories(res.data.tree || []);
      } catch (e) {
        // ignore if not configured
      }
    })();
  }, []);

  useEffect(() => {
    const title = (formData.name || '').toLowerCase();
    const desc = (formData.description || '').toLowerCase();
    const text = `${title} ${desc}`;
    const suggestions = new Set();
    const match = (keywords, path) => {
      if (keywords.some(k => text.includes(k))) suggestions.add(path);
    };
    match(['shirt','tshirt','tee'], 'Apparel > Tops');
    match(['hoodie','sweatshirt'], 'Apparel > Tops > Hoodies');
    match(['jeans','denim','pants','trousers'], 'Apparel > Bottoms');
    match(['dress','skirt'], 'Apparel > Womens > Dresses');
    match(['sneaker','shoe','boots'], 'Footwear');
    match(['earbuds','headphones','charger','cable'], 'Electronics > Accessories');
    setCategorySuggestions(Array.from(suggestions));
  }, [formData.name, formData.description]);
  
  const handleSubmit = (e) => {
    e.preventDefault();
    if (Object.keys(validationErrors).length > 0) {
      alert('Please fix validation errors before submitting');
      return;
    }
    onSubmit(formData);
  };
  
  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };
  
  const handleDimensionChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      dimensions: { ...prev.dimensions, [field]: value }
    }));
  };

  const handleChooseFile = () => {
    fileInputRef.current?.click();
  };

  const handleImageSelected = (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const newImage = {
        url: reader.result,
        alt: formData.name || 'Product image',
        position: (formData.images?.length || 0)
      };
      setFormData(prev => ({
        ...prev,
        images: [ ...(prev.images || []), newImage ]
      }));
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };
  
  const addTag = () => {
    if (newTag.trim() && !formData.tags.includes(newTag.trim().toLowerCase())) {
      setFormData(prev => ({
        ...prev,
        tags: [...prev.tags, newTag.trim().toLowerCase()]
      }));
      setNewTag('');
    }
  };
  
  const removeTag = (tag) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.filter(t => t !== tag)
    }));
  };
  
  const addCategory = () => {
    if (newCategory.trim() && !formData.categories.includes(newCategory.trim())) {
      setFormData(prev => ({
        ...prev,
        categories: [...prev.categories, newCategory.trim()]
      }));
      setNewCategory('');
    }
  };
  
  const removeCategory = (cat) => {
    setFormData(prev => ({
      ...prev,
      categories: prev.categories.filter(c => c !== cat)
    }));
  };
  
  const addRelation = (field, value) => {
    const v = (value || '').trim();
    if (!v) return;
    setFormData(prev => ({
      ...prev,
      [field]: Array.from(new Set([...(prev[field] || []), v]))
    }));
  };
  const removeRelation = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: (prev[field] || []).filter(x => x !== value)
    }));
  };
  
  const handleKeyPress = (e, action) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      action();
    }
  };
  
  const addDownload = () => {
    setFormData(prev => ({
      ...prev,
      downloads: [...(prev.downloads || []), { name: '', url: '' }]
    }));
  };
  const updateDownload = (index, field, value) => {
    setFormData(prev => {
      const next = [...(prev.downloads || [])];
      next[index] = { ...next[index], [field]: value };
      return { ...prev, downloads: next };
    });
  };
  const removeDownload = (index) => {
    setFormData(prev => {
      const next = [...(prev.downloads || [])];
      next.splice(index, 1);
      return { ...prev, downloads: next };
    });
  };
  
  const toggleSection = (id) => {
    setOpenSections(prev => ({ ...prev, [id]: !prev[id] }));
  };
  
  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Sticky action bar */}
      <div className="hidden sm:flex items-center justify-end gap-3">
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" loading={isLoading}>
          {initialData ? 'Update Product' : 'Create Product'}
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Basic Information */}
          <Card>
            <div className="p-6">
              <button type="button" onClick={() => toggleSection('basic')} className="w-full flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                  <InformationCircleIcon className="w-5 h-5 text-gray-400" />
                  Basic Information
                </h3>
                <span className="text-sm text-gray-500">{openSections.basic ? 'Hide' : 'Show'}</span>
              </button>
            </div>
            {openSections.basic && (
              <div className="px-6 pb-6 space-y-6">
                <div className="space-y-4">
                  <Input label="Product Name" placeholder="e.g., Premium Cotton T-Shirt" required value={formData.name} onChange={(e) => handleChange('name', e.target.value)} helperText="Keep it clear and descriptive" />
                  <div className="grid grid-cols-2 gap-4">
                    <Input label="SKU" placeholder="e.g., PROD-001" required value={formData.sku} onChange={(e) => handleChange('sku', e.target.value.toUpperCase())} helperText="Unique identifier" />
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">Product Type <span className="text-red-500">*</span></label>
                      <select value={formData.product_type} onChange={(e) => handleChange('product_type', e.target.value)} className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all text-sm" required>
                        <option value="simple">Simple Product</option>
                        <option value="variable" disabled>Variable Product (Coming Soon)</option>
                        <option value="grouped" disabled>Grouped Product (Coming Soon)</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Short Description</label>
                    <textarea placeholder="Brief product summary for product cards and listings" value={formData.short_description} onChange={(e) => handleChange('short_description', e.target.value)} rows={2} maxLength={200} className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all text-sm resize-none" />
                    <div className="flex justify-between items-center mt-1">
                      <p className="text-xs text-gray-500">Shown in product listings and cards</p>
                      <p className="text-xs text-gray-400">{(formData.short_description || '').length}/200</p>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Full Description</label>
                    <textarea placeholder="Detailed product description with features, benefits, and specifications" value={formData.description} onChange={(e) => handleChange('description', e.target.value)} rows={6} className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all text-sm resize-none" />
                    <p className="text-xs text-gray-500 mt-1">Include key features, materials, care instructions, etc.</p>
                  </div>
                </div>
              </div>
            )}
          </Card>

          {/* Pricing & Profitability */}
          <Card>
            <div className="p-6">
              <button type="button" onClick={() => toggleSection('pricing')} className="w-full flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                  <ChartBarIcon className="w-5 h-5 text-gray-400" />
                  Pricing &amp; Profitability
                </h3>
                <span className="text-sm text-gray-500">{openSections.pricing ? 'Hide' : 'Show'}</span>
              </button>
            </div>
            {openSections.pricing && (
              <div className="px-6 pb-6 space-y-6">
                <div className="grid grid-cols-1 gap-4 mb-6">
                  <div className="grid grid-cols-3 gap-4">
                    <div className="col-span-1"><Input type="number" step="0.01" label="Regular Price" placeholder="99.99" required value={formData.price} onChange={(e) => handleChange('price', e.target.value)} helperText="Customer price" /></div>
                    <div className="col-span-1"><Input type="number" step="0.01" label="Compare at Price" placeholder="129.99" value={formData.compare_at_price} onChange={(e) => handleChange('compare_at_price', e.target.value)} error={validationErrors.compare_at_price} helperText={!validationErrors.compare_at_price ? 'Original/MSRP price' : undefined} /></div>
                    <div className="col-span-1"><Input type="number" step="0.01" label="Cost (COGS)" placeholder="45.00" value={formData.cost} onChange={(e) => handleChange('cost', e.target.value)} helperText="Your cost (private)" /></div>
                  </div>
                </div>
                {formData.price && (
                  <div className="bg-gradient-to-br from-primary-50 to-primary-50 rounded-xl p-6 border border-primary-100">
                    <h4 className="text-sm font-semibold text-gray-700 mb-4">Pricing Preview</h4>
                    <div className="grid grid-cols-3 gap-4 mb-4">
                      <div><p className="text-xs text-gray-600 mb-1">Customer Pays</p><p className="text-2xl font-bold text-gray-900">{formatCurrency(formData.price)}</p></div>
                      {formData.compare_at_price && parseFloat(formData.compare_at_price) > parseFloat(formData.price) && (
                        <div>
                          <p className="text-xs text-gray-600 mb-1">Original Price</p>
                          <p className="text-xl font-semibold text-gray-400 line-through">{formatCurrency(formData.compare_at_price)}</p>
                          <Badge variant="danger" size="sm" className="mt-1">{savings}% OFF</Badge>
                        </div>
                      )}
                      {formData.cost && (
                        <div>
                          <p className="text-xs text-gray-600 mb-1">Your Cost</p>
                          <p className="text-xl font-semibold text-gray-700">{formatCurrency(formData.cost)}</p>
                        </div>
                      )}
                    </div>
                    {margin && profit && (
                      <div className="grid grid-cols-2 gap-3 pt-4 border-t border-primary-200">
                        <div className="bg-white/60 rounded-lg p-3"><p className="text-xs text-gray-600 mb-1">Profit per Unit</p><p className="text-lg font-bold text-success-700">{formatCurrency(profit)}</p></div>
                        <div className="bg-white/60 rounded-lg p-3"><p className="text-xs text-gray-600 mb-1">Profit Margin</p><p className="text-lg font-bold text-success-700">{margin}%</p></div>
                      </div>
                    )}
                  </div>
                )}
                {/* Virtual / Downloadable */}
                <div className="mt-6 pt-6 border-t border-gray-200">
                  <h4 className="text-sm font-semibold text-gray-700 mb-3">Product Flags</h4>
                  <div className="flex items-center gap-6">
                    <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                      <input type="checkbox" checked={formData.virtual} onChange={(e) => handleChange('virtual', e.target.checked)} />
                      Virtual (no shipping)
                    </label>
                    <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                      <input type="checkbox" checked={formData.downloadable} onChange={(e) => handleChange('downloadable', e.target.checked)} />
                      Downloadable
                    </label>
                  </div>
                </div>
                {formData.downloadable && (
                  <div className="mt-4 space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-semibold text-gray-700">Downloadable Files</h4>
                      <Button type="button" variant="secondary" size="sm" icon={<PlusIcon className="w-4 h-4" />} onClick={addDownload}>Add file</Button>
                    </div>
                    {(formData.downloads || []).map((dl, idx) => (
                      <div key={idx} className="grid grid-cols-5 gap-3 items-end">
                        <div className="col-span-2">
                          <Input label="File name" placeholder="User Manual PDF" value={dl.name} onChange={(e) => updateDownload(idx, 'name', e.target.value)} />
                        </div>
                        <div className="col-span-3">
                          <Input label="File URL" placeholder="https://..." value={dl.url} onChange={(e) => updateDownload(idx, 'url', e.target.value)} />
                        </div>
                        <div className="col-span-5">
                          <button type="button" className="text-xs text-red-600" onClick={() => removeDownload(idx)}>Remove</button>
                        </div>
                      </div>
                    ))}
                    <div className="grid grid-cols-2 gap-4">
                      <Input type="number" label="Download limit" placeholder="Leave blank for unlimited" value={formData.download_limit} onChange={(e) => handleChange('download_limit', e.target.value)} />
                      <Input type="number" label="Download expiry (days)" placeholder="Leave blank for no expiry" value={formData.download_expiry} onChange={(e) => handleChange('download_expiry', e.target.value)} />
                    </div>
                  </div>
                )}
                {!formData.virtual && (
                  <div className="mt-6 pt-6 border-t border-gray-200">
                    <h4 className="text-sm font-semibold text-gray-700 mb-4">Shipping Information (Optional)</h4>
                    <div className="grid grid-cols-4 gap-4">
                      <Input type="number" step="0.01" label="Weight (lbs)" placeholder="2.5" value={formData.weight} onChange={(e) => handleChange('weight', e.target.value)} />
                      <Input type="number" step="0.01" label="Length (in)" placeholder="12" value={formData.dimensions.length} onChange={(e) => handleDimensionChange('length', e.target.value)} />
                      <Input type="number" step="0.01" label="Width (in)" placeholder="8" value={formData.dimensions.width} onChange={(e) => handleDimensionChange('width', e.target.value)} />
                      <Input type="number" step="0.01" label="Height (in)" placeholder="3" value={formData.dimensions.height} onChange={(e) => handleDimensionChange('height', e.target.value)} />
                    </div>
                    <p className="text-xs text-gray-500 mt-2">Used for shipping calculations and carrier integrations</p>
                  </div>
                )}
              </div>
            )}
          </Card>

          {/* Inventory Management */}
          <Card>
            <div className="p-6">
              <button type="button" onClick={() => toggleSection('inventory')} className="w-full flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                  <CubeIcon className="w-5 h-5 text-gray-400" />
                  Inventory Management
                </h3>
                <span className="text-sm text-gray-500">{openSections.inventory ? 'Hide' : 'Show'}</span>
              </button>
            </div>
            {openSections.inventory && (
              <div className="px-6 pb-6 space-y-6">
                <div className="bg-primary-50 border border-primary-200 rounded-lg p-4 mb-6">
                  <div className="flex items-start gap-3">
                    <InformationCircleIcon className="w-5 h-5 text-primary-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-primary-900">Inventory Tracking</p>
                      <p className="text-sm text-primary-700 mt-1">Enable tracking to monitor stock levels and receive low stock alerts</p>
                    </div>
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div>
                      <p className="text-sm font-medium text-gray-900">Track inventory quantity</p>
                      <p className="text-xs text-gray-500 mt-1">Blu Store will automatically update stock as orders come in</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" checked={formData.track_inventory} onChange={(e) => handleChange('track_inventory', e.target.checked)} className="sr-only peer" />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
                    </label>
                  </div>
                  {formData.track_inventory && (
                    <div className="grid grid-cols-2 gap-4">
                      <div><Input type="number" label="Current Stock" placeholder="100" value={formData.inventory_qty} onChange={(e) => handleChange('inventory_qty', e.target.value)} error={validationErrors.inventory_qty} /></div>
                      <div className="flex flex-col justify-end">
                        <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                          <p className="text-xs text-gray-600">Stock Status</p>
                          <p className={`text-sm font-semibold mt-1 ${formData.inventory_qty > 10 ? 'text-success-700' : formData.inventory_qty > 0 ? 'text-warning-700' : 'text-red-700'}`}>
                            {formData.inventory_qty > 10 ? '✓ In Stock' : formData.inventory_qty > 0 ? '⚠ Low Stock' : '✕ Out of Stock'}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </Card>

          {/* Organization & Taxonomy */}
          <Card>
            <div className="p-6">
              <button type="button" onClick={() => toggleSection('organization')} className="w-full flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                  <TagIcon className="w-5 h-5 text-gray-400" />
                  Organization &amp; Taxonomy
                </h3>
                <span className="text-sm text-gray-500">{openSections.organization ? 'Hide' : 'Show'}</span>
              </button>
            </div>
            {openSections.organization && (
              <div className="px-6 pb-6 space-y-6">
                {/* Categories */}
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Categories</label>
                  <p className="text-xs text-gray-500 mb-3">Organize products into hierarchical categories for easy browsing</p>
                  <div className="flex gap-2">
                    <input type="text" placeholder="e.g., Clothing, Electronics, Home & Garden" value={newCategory} onChange={(e) => setNewCategory(e.target.value)} onKeyPress={(e) => handleKeyPress(e, addCategory)} className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all text-sm" />
                    <Button type="button" onClick={addCategory} variant="secondary" icon={<PlusIcon className="w-4 h-4" />}>Add</Button>
                  </div>
                  <div className="mt-3 space-y-2">
                    <div className="text-xs text-gray-500">Suggestions</div>
                    <div className="flex flex-wrap gap-2">
                      {['Apparel','Accessories','Electronics','Home & Garden','Beauty','Sports','Footwear'].map(cat => (
                        <Button key={cat} type="button" variant="secondary" size="sm" onClick={() => { setFormData(prev => ({ ...prev, categories: Array.from(new Set([...(prev.categories||[]), cat])) })); }}>{cat}</Button>
                      ))}
                      {categorySuggestions.map(path => (
                        <Button key={path} type="button" variant="secondary" size="sm" onClick={() => { setFormData(prev => ({ ...prev, categories: Array.from(new Set([...(prev.categories||[]), path])) })); }}>{path}</Button>
                      ))}
                    </div>
                  </div>
                  {wooCategories.length > 0 && (
                    <div className="mt-4">
                      <label className="block text-xs font-medium text-gray-700 mb-1.5">Browse Woo Categories</label>
                      <div className="max-h-48 overflow-auto border rounded-lg p-2 bg-white">
                        {wooCategories.map(root => (
                          <CategoryNode key={root.id} node={root} onPick={(path) => { setFormData(prev => ({ ...prev, categories: Array.from(new Set([...(prev.categories||[]), path])) })); }} />
                        ))}
                      </div>
                    </div>
                  )}
                  {formData.categories.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-3">
                      {formData.categories.map(cat => (
                        <Badge key={cat} variant="info" className="text-sm pl-3 pr-1 py-1.5">{cat}<button type="button" onClick={() => removeCategory(cat)} className="ml-2 hover:text-info-900 focus:outline-none"><XMarkIcon className="w-4 h-4" /></button></Badge>
                      ))}
                    </div>
                  )}
                </div>

                {/* Tags */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Tags</label>
                  <p className="text-xs text-gray-500 mb-3">Add tags for filtering, search, and internal organization</p>
                  <div className="flex gap-2">
                    <input type="text" placeholder="e.g., premium, bestseller, new-arrival" value={newTag} onChange={(e) => setNewTag(e.target.value)} onKeyPress={(e) => handleKeyPress(e, addTag)} className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all text-sm" />
                    <Button type="button" onClick={addTag} variant="secondary" icon={<PlusIcon className="w-4 h-4" />}>Add</Button>
                  </div>
                  {formData.tags.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-3">
                      {formData.tags.map(tag => (
                        <Badge key={tag} variant="purple" className="text-sm pl-3 pr-1 py-1.5">#{tag}<button type="button" onClick={() => removeTag(tag)} className="ml-2 hover:text-navy-900 focus:outline-none"><XMarkIcon className="w-4 h-4" /></button></Badge>
                      ))}
                    </div>
                  )}
                </div>

                {/* Relations: Upsells / Cross-sells */}
                <div className="mt-6 pt-6 border-t border-gray-200">
                  <h4 className="text-sm font-semibold text-gray-700 mb-2">Product Relations (Optional)</h4>
                  <p className="text-xs text-gray-500 mb-3">Add related product IDs/SKUs for upsells and cross-sells</p>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="flex gap-2">
                        <input type="text" placeholder="Enter ID or SKU and press Add" className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg text-sm" id="upsell-input" />
                        <Button type="button" variant="secondary" onClick={() => {
                          const el = document.getElementById('upsell-input');
                          addRelation('upsells', el?.value);
                          if (el) el.value = '';
                        }}>Add</Button>
                      </div>
                      {formData.upsells.length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-2">
                          {formData.upsells.map(v => (
                            <Badge key={v} variant="info" className="text-sm pl-3 pr-1 py-1.5">
                              {v}
                              <button type="button" onClick={() => removeRelation('upsells', v)} className="ml-2 hover:text-info-900"><XMarkIcon className="w-4 h-4" /></button>
                            </Badge>
                          ))}
                        </div>
                      )}
                      <p className="text-xs text-gray-500 mt-1">Upsells are recommended on product pages</p>
                    </div>
                    <div>
                      <div className="flex gap-2">
                        <input type="text" placeholder="Enter ID or SKU and press Add" className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg text-sm" id="crosssell-input" />
                        <Button type="button" variant="secondary" onClick={() => {
                          const el = document.getElementById('crosssell-input');
                          addRelation('cross_sells', el?.value);
                          if (el) el.value = '';
                        }}>Add</Button>
                      </div>
                      {formData.cross_sells.length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-2">
                          {formData.cross_sells.map(v => (
                            <Badge key={v} variant="info" className="text-sm pl-3 pr-1 py-1.5">
                              {v}
                              <button type="button" onClick={() => removeRelation('cross_sells', v)} className="ml-2 hover:text-info-900"><XMarkIcon className="w-4 h-4" /></button>
                            </Badge>
                          ))}
                        </div>
                      )}
                      <p className="text-xs text-gray-500 mt-1">Cross-sells are suggested in cart</p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </Card>

        </div>
        
        {/* Sidebar */}
        <div className="lg:col-span-1">
          <div className="space-y-6 sticky top-24">
            {/* Status Card */}
            <Card>
              <div className="p-6">
                <h3 className="text-sm font-semibold text-gray-900 mb-4 uppercase tracking-wide">Status</h3>
                <select
                  value={formData.status}
                  onChange={(e) => handleChange('status', e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all text-sm font-medium"
                >
                  <option value="draft">📝 Draft</option>
                  <option value="active">✅ Active</option>
                </select>
                <p className="text-xs text-gray-500 mt-2">
                  {formData.status === 'draft' 
                    ? 'Product is hidden from your store' 
                    : 'Product is live and visible to customers'
                  }
                </p>
              </div>
            </Card>

            {/* Template Card */}
            <Card>
              <div className="p-6">
                <h3 className="text-sm font-semibold text-gray-900 mb-4 uppercase tracking-wide">Page Template</h3>
                <select
                  value={formData.pdp_template || ''}
                  onChange={(e) => handleChange('pdp_template', e.target.value || null)}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all text-sm font-medium"
                >
                  <option value="">Use store default</option>
                  <option value="minimal">◻️ Minimal</option>
                  <option value="modern">▣ Modern</option>
                  <option value="editorial">▤ Editorial</option>
                  <option value="luxury">◧ Luxury</option>
                  <option value="bold">▦ Bold</option>
                  <option value="showcase">▥ Showcase</option>
                </select>
                <p className="text-xs text-gray-500 mt-2">Override the store default template for this product</p>
              </div>
            </Card>
            
            {/* Product Image */}
            <Card>
              <div className="p-6">
                <h3 className="text-sm font-semibold text-gray-900 mb-4 uppercase tracking-wide">Product Image</h3>
                <div className="aspect-square bg-gradient-to-br from-gray-50 to-gray-100 rounded-lg border-2 border-dashed border-gray-300 flex flex-col items-center justify-center p-6 hover:border-primary-400 hover:bg-primary-50 transition-all cursor-pointer">
                  <PhotoIcon className="w-12 h-12 text-gray-400 mb-3" />
                  <p className="text-sm font-medium text-gray-600 mb-1">Upload Image</p>
                  <p className="text-xs text-gray-500 text-center">PNG, JPG up to 10MB</p>
                  <Button type="button" variant="secondary" size="sm" className="mt-4" onClick={handleChooseFile}>
                    Choose File
                  </Button>
                  <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageSelected} />
                </div>
                <p className="text-xs text-gray-500 mt-3">Images will be synced to WooCommerce</p>
                {formData.images && formData.images.length > 0 && (
                  <div className="mt-4 grid grid-cols-4 gap-3">
                    {formData.images.map((img, idx) => (
                      <div key={idx} className="relative">
                        <img src={img.url} alt={img.alt || ''} className="w-full h-24 object-cover rounded-lg border" />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </Card>
            
            {/* Quick Stats */}
            {(margin || formData.inventory_qty) && (
              <Card>
                <div className="p-6">
                  <h3 className="text-sm font-semibold text-gray-900 mb-4 uppercase tracking-wide">Quick Stats</h3>
                  <div className="space-y-3">
                    {margin && (
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">Margin</span>
                        <span className="text-sm font-semibold text-success-700">{margin}%</span>
                      </div>
                    )}
                    {formData.inventory_qty !== '' && (
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">Stock</span>
                        <span className={`text-sm font-semibold ${
                          formData.inventory_qty > 10 ? 'text-success-700' :
                          formData.inventory_qty > 0 ? 'text-warning-700' :
                          'text-red-700'
                        }`}>
                          {formData.inventory_qty} units
                        </span>
                      </div>
                    )}
                    {formData.categories.length > 0 && (
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">Categories</span>
                        <span className="text-sm font-semibold text-gray-900">{formData.categories.length}</span>
                      </div>
                    )}
                    {formData.tags.length > 0 && (
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">Tags</span>
                        <span className="text-sm font-semibold text-gray-900">{formData.tags.length}</span>
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            )}
          </div>
        </div>
      </div>
      
      {/* Bottom Actions (Mobile) */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 flex gap-3 shadow-lg">
        <Button type="button" variant="secondary" onClick={onCancel} className="flex-1">
          Cancel
        </Button>
        <Button type="submit" loading={isLoading} className="flex-1">
          {initialData ? 'Update' : 'Create'}
        </Button>
      </div>
    </form>
  );
};

export default ProductForm;

// Lightweight recursive category tree node for Woo browse
const CategoryNode = ({ node, onPick, path = '' }) => {
  const currentPath = path ? `${path} > ${node.name}` : node.name;
  return (
    <div className="ml-2">
      <button
        type="button"
        className="text-left text-sm text-gray-700 hover:text-primary-700 w-full"
        onClick={() => onPick(currentPath)}
      >
        {currentPath}
      </button>
      {node.children && node.children.length > 0 && (
        <div className="ml-3 border-l pl-2">
          {node.children.map(child => (
            <CategoryNode key={child.id} node={child} onPick={onPick} path={currentPath} />
          ))}
        </div>
      )}
    </div>
  );
};
