// ── Currency ────────────────────────────────────────────────
/**
 * Format a dollar amount (e.g. 29.99) as currency string.
 * Used by ProductForm / ProductList where prices are stored in dollars.
 */
export const formatCurrency = (amount) => {
  if (amount === null || amount === undefined) return '$0.00';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
};

/**
 * Format a cent-based integer (e.g. 2999) as currency string.
 * Used by Orders, Customers, Shipping, Dashboard where Stripe stores cents.
 */
export const formatCents = (cents) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format((cents || 0) / 100);
};

/**
 * Parse a dollar string to cents (e.g. "9.99" → 999).
 */
export const dollarsToCents = (dollars) => {
  const num = parseFloat(dollars);
  return isNaN(num) ? 0 : Math.round(num * 100);
};

// ── Dates ───────────────────────────────────────────────────
/**
 * Short date: "Jan 5, 2025"
 */
export const formatDate = (dateString) => {
  if (!dateString) return '';
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

/**
 * Date + time: "Jan 5, 2025, 3:42 PM"
 */
export const formatDateTime = (dateString) => {
  if (!dateString) return '';
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
};

// ── Product math ────────────────────────────────────────────
export const calculateMargin = (price, cost) => {
  if (!price || !cost) return null;
  const margin = ((price - cost) / price) * 100;
  return margin.toFixed(1);
};

export const calculateProfit = (price, cost) => {
  if (!price || !cost) return 0;
  return (price - cost).toFixed(2);
};

// ── Status helpers ──────────────────────────────────────────
export const getStatusColor = (status) => {
  const colors = {
    active: 'bg-success-100 text-success-800',
    draft: 'bg-warning-100 text-warning-800',
    archived: 'bg-gray-100 text-gray-800',
  };
  return colors[status] || colors.draft;
};

export const ORDER_STATUS_STYLES = {
  pending:    { bg: 'bg-warning-100', text: 'text-warning-800' },
  paid:       { bg: 'bg-success-100', text: 'text-success-800' },
  processing: { bg: 'bg-primary-100', text: 'text-primary-800' },
  shipped:    { bg: 'bg-navy-100',    text: 'text-navy-800' },
  fulfilled:  { bg: 'bg-gray-100',    text: 'text-gray-800' },
  cancelled:  { bg: 'bg-red-100',     text: 'text-red-800' },
  refunded:   { bg: 'bg-warning-100', text: 'text-warning-800' },
};

// ── Inventory ───────────────────────────────────────────────
export const getInventoryStatus = (qty) => {
  if (qty === 0) return { label: 'Out of stock', color: 'text-red-600' };
  if (qty < 10) return { label: 'Low stock', color: 'text-warning-600' };
  return { label: 'In stock', color: 'text-success-600' };
};

// ── Product URLs ────────────────────────────────────────────
export const getProductUrl = (product) => {
  if (!product) return null;
  if (product.permalink) return product.permalink;
  const siteUrl = (typeof window !== 'undefined' && window.bluSettings?.siteUrl) || '';
  if (!siteUrl) return null;
  if (product.slug) return `${siteUrl}/product/${product.slug}/`;
  if (product.woo_product_id) return `${siteUrl}/?p=${product.woo_product_id}`;
  return null;
};

// ── Relative time ───────────────────────────────────────
export const timeAgo = (dateString) => {
  if (!dateString) return '';
  const now = new Date();
  const date = new Date(dateString);
  const seconds = Math.floor((now - date) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks}w ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  const years = Math.floor(days / 365);
  return `${years}y ago`;
};

// ── Misc ────────────────────────────────────────────────────
export const debounce = (func, wait) => {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
};

export const prepareProductData = (formData) => {
  return {
    ...formData,
    price: formData.price ? parseFloat(formData.price) : 0,
    compare_at_price: formData.compare_at_price ? parseFloat(formData.compare_at_price) : null,
    cost: formData.cost ? parseFloat(formData.cost) : null,
    inventory_qty: formData.inventory_qty ? parseInt(formData.inventory_qty) : 0,
    weight: formData.weight ? parseFloat(formData.weight) : null,
    dimensions: {
      length: formData.dimensions?.length ? parseFloat(formData.dimensions.length) : null,
      width: formData.dimensions?.width ? parseFloat(formData.dimensions.width) : null,
      height: formData.dimensions?.height ? parseFloat(formData.dimensions.height) : null,
    },
  };
};
