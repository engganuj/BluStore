import { useState } from 'react';
import {
  FunnelIcon,
  Squares2X2Icon,
  TableCellsIcon,
  ArrowsUpDownIcon
} from '@heroicons/react/24/outline';
import ProductCard from './ProductCard';
import SearchBar from '../shared/SearchBar';
import Select from '../shared/Select';
import { Card, CardBody } from '../shared/Card';
import Button from '../shared/Button';
import Badge from '../shared/Badge';
import EmptyState from '../shared/EmptyState';
import LoadingSpinner from '../shared/LoadingSpinner';
import { formatCurrency, calculateMargin, getProductUrl } from '../../utils/helpers';

export const ProductList = ({ 
  products = [], 
  total,
  platforms = [],
  isLoading = false,
  onEdit,
  onDelete,
  onCreateNew,
  // Controlled search/filter — parent manages state for server-side queries
  searchQuery: controlledSearch,
  onSearchChange,
  statusFilter: controlledStatus,
  onStatusChange,
}) => {
  // Use controlled props if provided, otherwise fall back to internal state
  const [internalSearch, setInternalSearch] = useState('');
  const [internalStatus, setInternalStatus] = useState('all');
  const searchQuery = controlledSearch !== undefined ? controlledSearch : internalSearch;
  const setSearchQuery = onSearchChange || setInternalSearch;
  const statusFilter = controlledStatus !== undefined ? controlledStatus : internalStatus;
  const setStatusFilter = onStatusChange || setInternalStatus;

  const [categoryFilter, setCategoryFilter] = useState('all');
  const [sortBy, setSortBy] = useState('name');
  const [sortOrder, setSortOrder] = useState('asc');
  const [viewMode, setViewMode] = useState('grid'); // 'grid' or 'table'
  const [showFilters, setShowFilters] = useState(false);
  
  // Get unique categories from current page of products
  const allCategories = Array.from(
    new Set(products.flatMap(p => p.categories || []))
  ).sort();
  
  // Client-side filters: only category (search + status are server-side when controlled)
  let filteredProducts = products.filter(product => {
    const matchesCategory = categoryFilter === 'all' || 
                           product.categories?.includes(categoryFilter);
    return matchesCategory;
  });
  
  // Sort products
  filteredProducts = filteredProducts.sort((a, b) => {
    let aVal, bVal;
    
    switch(sortBy) {
      case 'name':
        aVal = a.name.toLowerCase();
        bVal = b.name.toLowerCase();
        break;
      case 'price':
        aVal = parseFloat(a.price) || 0;
        bVal = parseFloat(b.price) || 0;
        break;
      case 'stock':
        aVal = a.inventory_qty || 0;
        bVal = b.inventory_qty || 0;
        break;
      case 'sku':
        aVal = a.sku.toLowerCase();
        bVal = b.sku.toLowerCase();
        break;
      case 'margin':
        aVal = calculateMargin(a.price, a.cost) || 0;
        bVal = calculateMargin(b.price, b.cost) || 0;
        break;
      default:
        return 0;
    }
    
    if (sortOrder === 'asc') {
      return aVal > bVal ? 1 : -1;
    } else {
      return aVal < bVal ? 1 : -1;
    }
  });
  
  const toggleSortOrder = () => {
    setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
  };
  
  const activeFiltersCount = 
    (statusFilter !== 'all' ? 1 : 0) + 
    (categoryFilter !== 'all' ? 1 : 0);
  
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <LoadingSpinner />
      </div>
    );
  }
  
  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <Card className="mb-0">
        <CardBody className="!py-3">
          <div className="flex flex-col lg:flex-row gap-3">
          {/* Search */}
          <SearchBar
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Search products by name, SKU, description, or tags..."
            className="flex-1"
          />
          
          {/* Action Buttons */}
          <div className="flex gap-2">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`
                flex items-center gap-2 px-4 py-2.5 border rounded-lg text-sm font-medium transition-all
                ${showFilters 
                  ? 'bg-primary-50 border-primary-200 text-primary-700' 
                  : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                }
              `}
            >
              <FunnelIcon className="w-4 h-4" />
              Filters
              {activeFiltersCount > 0 && (
                <Badge variant="primary" size="sm" className="ml-1">
                  {activeFiltersCount}
                </Badge>
              )}
            </button>
            
            <div className="flex border border-gray-300 rounded-lg overflow-hidden">
              <button
                onClick={() => setViewMode('grid')}
                className={`px-3 py-2 ${
                  viewMode === 'grid' 
                    ? 'bg-primary-50 text-primary-700' 
                    : 'bg-white text-gray-600 hover:bg-gray-50'
                }`}
                title="Grid View"
              >
                <Squares2X2Icon className="w-5 h-5" />
              </button>
              <button
                onClick={() => setViewMode('table')}
                className={`px-3 py-2 border-l border-gray-300 ${
                  viewMode === 'table' 
                    ? 'bg-primary-50 text-primary-700' 
                    : 'bg-white text-gray-600 hover:bg-gray-50'
                }`}
                title="Table View"
              >
                <TableCellsIcon className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
        
        {/* Filters Panel */}
        {showFilters && (
          <div className="mt-4 pt-4 border-t border-gray-200 grid grid-cols-1 md:grid-cols-3 gap-4">
            <Select
              label="Status"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              options={[
                { value: 'all', label: 'All Status' },
                { value: 'active', label: 'Active' },
                { value: 'draft', label: 'Draft' },
              ]}
            />

            <Select
              label="Category"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              options={[
                { value: 'all', label: 'All Categories' },
                ...allCategories.map(cat => ({ value: cat, label: cat })),
              ]}
            />

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Sort By
              </label>
              <div className="flex gap-2">
                <Select
                  className="flex-1"
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  options={[
                    { value: 'name', label: 'Name' },
                    { value: 'sku', label: 'SKU' },
                    { value: 'price', label: 'Price' },
                    { value: 'stock', label: 'Stock' },
                    { value: 'margin', label: 'Margin' },
                  ]}
                />
                <button
                  onClick={toggleSortOrder}
                  className="px-3 py-2.5 border border-gray-300 rounded-lg hover:bg-gray-50 transition-all"
                  title={`Sort ${sortOrder === 'asc' ? 'Descending' : 'Ascending'}`}
                >
                  <ArrowsUpDownIcon className="w-4 h-4 text-gray-600" />
                </button>
              </div>
            </div>
            
            {/* Clear Filters */}
            {(statusFilter !== 'all' || categoryFilter !== 'all') && (
              <div className="md:col-span-3 flex justify-end">
                <button
                  onClick={() => {
                    setStatusFilter('all');
                    setCategoryFilter('all');
                  }}
                  className="text-sm text-primary-600 hover:text-primary-700 font-medium"
                >
                  Clear all filters
                </button>
              </div>
            )}
          </div>
        )}
        </CardBody>
      </Card>

      {/* Results Summary */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-gray-600">
          {total !== undefined ? (
            <span>
              <strong>{total}</strong> product{total !== 1 ? 's' : ''}
              {(searchQuery || statusFilter !== 'all') && ' matching filters'}
            </span>
          ) : filteredProducts.length === products.length ? (
            <span>
              Showing <strong>{filteredProducts.length}</strong> product{filteredProducts.length !== 1 ? 's' : ''}
            </span>
          ) : (
            <span>
              Showing <strong>{filteredProducts.length}</strong> of <strong>{products.length}</strong> products
            </span>
          )}
        </div>
        
        {/* Quick Stats */}
        <div className="hidden md:flex items-center gap-4 text-sm">
          <div className="flex items-center gap-2">
            <Badge variant="success" size="sm">
              {products.filter(p => p.status === 'active').length} Active
            </Badge>
            <Badge variant="warning" size="sm">
              {products.filter(p => p.status === 'draft').length} Draft
            </Badge>
          </div>
        </div>
      </div>
      
      {/* Products Grid/Table */}
      {filteredProducts.length === 0 ? (
        <EmptyState
          title={searchQuery || activeFiltersCount > 0 ? 'No products found' : 'No products yet'}
          description={
            searchQuery || activeFiltersCount > 0
              ? 'Try adjusting your search or filters to find what you\'re looking for'
              : 'Create your first product or sync from WooCommerce to get started.'
          }
          actionLabel={!searchQuery && activeFiltersCount === 0 ? 'Create Product' : undefined}
          onAction={!searchQuery && activeFiltersCount === 0 ? onCreateNew : undefined}
        />
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredProducts.map(product => (
            <ProductCard
              key={product.id}
              product={product}
              platforms={platforms}
              onEdit={() => onEdit(product)}
              onDelete={() => onDelete(product.id)}
            />
          ))}
        </div>
      ) : (
        <ProductTable
          products={filteredProducts}
          platforms={platforms}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      )}
    </div>
  );
};

// Resolve product thumbnail from multiple possible data shapes
const getProductImage = (product) => {
  if (product.image_url) return product.image_url;
  if (product.images?.length > 0) {
    const img = product.images[0];
    return img.url || img.src || null;
  }
  return null;
};

// Table View Component
const ProductTable = ({ products, platforms, onEdit, onDelete }) => {
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full table-auto">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Product
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                SKU
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Price
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Margin
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Stock
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {products.map(product => {
              const margin = calculateMargin(product.price, product.cost);
              const hasComparePrice = product.compare_at_price && product.compare_at_price > product.price;

              return (
                <tr key={product.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center min-w-0">
                      <div className="h-10 w-10 flex-shrink-0 bg-gradient-to-br from-gray-100 to-gray-200 rounded-lg flex items-center justify-center">
                        {getProductImage(product) ? (
                          <img src={getProductImage(product)} alt={product.name} className="h-10 w-10 rounded-lg object-cover" />
                        ) : (
                          <svg className="h-6 w-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                        )}
                      </div>
                      <div className="ml-3 min-w-0">
                        <div className="text-sm font-medium text-gray-900 truncate">{product.name}</div>
                        {product.categories?.length > 0 && (
                          <div className="flex gap-1 mt-0.5">
                            {product.categories.slice(0, 1).map(cat => (
                              <Badge key={cat} variant="info" size="sm">
                                {cat}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="text-sm text-gray-900 font-mono">{product.sku}</div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="flex items-baseline gap-1.5">
                      <div className="text-sm font-semibold text-gray-900">
                        {formatCurrency(product.price)}
                      </div>
                      {hasComparePrice && (
                        <>
                          <div className="text-xs text-gray-400 line-through">
                            {formatCurrency(product.compare_at_price)}
                          </div>
                          <Badge variant="danger" size="sm">SALE</Badge>
                        </>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {margin ? (
                      <Badge variant="success" size="sm" className="font-semibold">
                        {margin}%
                      </Badge>
                    ) : (
                      <span className="text-sm text-gray-400">-</span>
                    )}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className={`text-sm font-medium ${
                      product.inventory_qty > 10 ? 'text-success-700' :
                      product.inventory_qty > 0 ? 'text-warning-700' :
                      'text-red-700'
                    }`}>
                      {product.inventory_qty || 0}
                    </div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <Badge
                      variant={product.status === 'active' ? 'success' : 'warning'}
                      size="sm"
                    >
                      {product.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex items-center justify-end gap-1.5">
                      {getProductUrl(product) && (
                        <a
                          href={getProductUrl(product)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center px-2.5 py-1.5 text-sm font-medium text-primary-700 bg-primary-50 rounded-lg hover:bg-primary-100 transition-colors"
                        >
                          View
                        </a>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => onEdit(product)}
                      >
                        Edit
                      </Button>
                      {deleteConfirmId === product.id ? (
                        <div className="flex items-center gap-1">
                          <Button
                            size="sm"
                            variant="danger"
                            onClick={() => { onDelete(product.id); setDeleteConfirmId(null); }}
                          >
                            Confirm
                          </Button>
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => setDeleteConfirmId(null)}
                          >
                            Cancel
                          </Button>
                        </div>
                      ) : (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setDeleteConfirmId(product.id)}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          Delete
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ProductList;
