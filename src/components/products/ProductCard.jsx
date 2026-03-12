import { useState } from 'react';
import { 
  PencilIcon, 
  TrashIcon, 
  ArrowUpTrayIcon,
  EyeIcon,
  ChartBarIcon,
  CubeIcon
} from '@heroicons/react/24/outline';
import { CheckCircleIcon } from '@heroicons/react/24/solid';
import Card from '../shared/Card';
import Badge from '../shared/Badge';
import Button from '../shared/Button';
import { formatCurrency, calculateMargin, getInventoryStatus, getProductUrl } from '../../utils/helpers';

// Resolve product thumbnail from multiple possible data shapes
const getProductImage = (product) => {
  if (product.image_url) return product.image_url;
  if (product.images?.length > 0) {
    const img = product.images[0];
    return img.url || img.src || null;
  }
  return null;
};

export const ProductCard = ({ product, platforms, onEdit, onDelete }) => {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const hasPlatforms = product.platforms && product.platforms.length > 0;
  const hasComparePrice = product.compare_at_price && product.compare_at_price > product.price;
  const margin = calculateMargin(product.price, product.cost);
  const inventoryStatus = getInventoryStatus(product.inventory_qty);
  const savings = hasComparePrice 
    ? Math.round(((product.compare_at_price - product.price) / product.compare_at_price) * 100)
    : 0;
  
  return (
    <Card className="group overflow-hidden transition-all duration-200 hover:shadow-xl">
      {/* Product Image with Overlay */}
      <div className="aspect-square bg-gradient-to-br from-gray-100 to-gray-200 relative overflow-hidden">
        {getProductImage(product) ? (
          <img
            src={getProductImage(product)}
            alt={product.name}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <svg className="w-20 h-20 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
        )}
        
        {/* Quick Actions Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/0 to-black/0 opacity-0 group-hover:opacity-100 transition-all duration-200 flex items-end justify-center pb-4 gap-2">
          <Button
            size="sm"
            variant="secondary"
            icon={<PencilIcon className="w-4 h-4" />}
            onClick={onEdit}
            className="shadow-xl backdrop-blur-sm bg-white/95"
          >
            Edit
          </Button>
          {getProductUrl(product) && (
            <a
              href={getProductUrl(product)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg shadow-xl backdrop-blur-sm bg-white/95 text-gray-700 hover:bg-white transition-colors"
            >
              <EyeIcon className="w-4 h-4" />
              View
            </a>
          )}
        </div>
        
        {/* Badges */}
        <div className="absolute top-3 left-3 right-3 flex justify-between items-start">
          <div className="flex flex-col gap-2">
            <Badge variant={product.status === 'active' ? 'success' : 'warning'} className="shadow-sm">
              {product.status === 'active' ? '✓ Active' : '○ Draft'}
            </Badge>
            {hasComparePrice && (
              <Badge variant="danger" className="font-bold shadow-sm">
                {savings}% OFF
              </Badge>
            )}
            {product.pdp_template && (
              <Badge variant="purple" className="shadow-sm capitalize">
                {product.pdp_template}
              </Badge>
            )}
          </div>
          
          {/* Synced Badge */}
          {hasPlatforms && (
            <div className="bg-success-500 text-white px-2 py-1 rounded-md text-xs font-semibold shadow-sm flex items-center gap-1">
              <CheckCircleIcon className="w-3 h-3" />
              Synced
            </div>
          )}
        </div>
      </div>
      
      {/* Product Info */}
      <div className="p-5">
        {/* Header */}
        <div className="mb-3">
          <h3 className="text-lg font-semibold text-gray-900 mb-1 line-clamp-2 leading-snug group-hover:text-primary-600 transition-colors">
            {product.name}
          </h3>
          <p className="text-xs text-gray-500 font-mono tracking-wide">
            SKU: {product.sku}
          </p>
        </div>
        
        {/* Price */}
        <div className="mb-3">
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-gray-900">
              {formatCurrency(product.price)}
            </span>
            {hasComparePrice && (
              <span className="text-sm text-gray-400 line-through">
                {formatCurrency(product.compare_at_price)}
              </span>
            )}
          </div>
        </div>
        
        {/* Description */}
        {product.short_description && (
          <p className="text-sm text-gray-600 mb-4 line-clamp-2 leading-relaxed">
            {product.short_description}
          </p>
        )}
        
        {/* Metrics */}
        <div className="grid grid-cols-2 gap-2 mb-4 pb-4 border-b border-gray-200">
          {/* Margin */}
          {margin && (
            <div className="bg-success-50 rounded-lg px-3 py-2 border border-success-200">
              <div className="flex items-center gap-1.5 mb-0.5">
                <ChartBarIcon className="w-3.5 h-3.5 text-success-600" />
                <span className="text-xs text-success-700 font-medium">Margin</span>
              </div>
              <p className="text-lg font-bold text-success-900">{margin}%</p>
            </div>
          )}
          
          {/* Stock */}
          <div className={`rounded-lg px-3 py-2 border ${
            product.inventory_qty > 10 
              ? 'bg-success-50 border-success-200' 
              : product.inventory_qty > 0 
              ? 'bg-warning-50 border-warning-200' 
              : 'bg-red-50 border-red-200'
          }`}>
            <div className="flex items-center gap-1.5 mb-0.5">
              <CubeIcon className={`w-3.5 h-3.5 ${
                product.inventory_qty > 10 
                  ? 'text-success-600' 
                  : product.inventory_qty > 0 
                  ? 'text-warning-600' 
                  : 'text-red-600'
              }`} />
              <span className={`text-xs font-medium ${
                product.inventory_qty > 10 
                  ? 'text-success-700' 
                  : product.inventory_qty > 0 
                  ? 'text-warning-700' 
                  : 'text-red-700'
              }`}>
                Stock
              </span>
            </div>
            <p className={`text-lg font-bold ${
              product.inventory_qty > 10 
                ? 'text-success-900' 
                : product.inventory_qty > 0 
                ? 'text-warning-900' 
                : 'text-red-900'
            }`}>
              {product.inventory_qty || 0}
            </p>
          </div>
        </div>
        
        {/* Categories & Tags */}
        {(product.categories?.length > 0 || product.tags?.length > 0) && (
          <div className="flex flex-wrap gap-1.5 mb-4">
            {product.categories?.slice(0, 2).map(cat => (
              <Badge key={cat} variant="info" size="sm">
                {cat}
              </Badge>
            ))}
            {product.tags?.slice(0, 2).map(tag => (
              <Badge key={tag} variant="purple" size="sm">
                #{tag}
              </Badge>
            ))}
            {(product.categories?.length > 2 || product.tags?.length > 2) && (
              <Badge variant="default" size="sm">
                +{(product.categories?.length || 0) + (product.tags?.length || 0) - 4} more
              </Badge>
            )}
          </div>
        )}
        
        {/* Actions */}
        <div className="space-y-2">
          {showDeleteConfirm ? (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-800 mb-2">Delete <strong>{product.name}</strong>?</p>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="danger"
                  className="flex-1"
                  onClick={() => { onDelete(); setShowDeleteConfirm(false); }}
                >
                  Delete
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  className="flex-1"
                  onClick={() => setShowDeleteConfirm(false)}
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <Button
              size="sm"
              variant="ghost"
              className="w-full justify-center text-red-600 hover:text-red-700 hover:bg-red-50 border border-transparent hover:border-red-200"
              icon={<TrashIcon className="w-4 h-4" />}
              onClick={() => setShowDeleteConfirm(true)}
            >
              Delete Product
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
};

export default ProductCard;
