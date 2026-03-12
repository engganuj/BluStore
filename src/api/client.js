/**
 * API Client — @wordpress/api-fetch
 *
 * When running inside WordPress admin, the PHP enqueue injects:
 *   window.bluSettings = { nonce, restUrl, siteUrl, version }
 *
 * apiFetch handles nonces automatically via middleware.
 */

import apiFetch from '@wordpress/api-fetch';

// Detect WordPress environment
const wpSettings = typeof window !== 'undefined' && window.bluSettings;

// Configure api-fetch with our REST root and nonce
if (wpSettings) {
  // Strip the namespace so apiFetch gets the raw REST root (e.g. /wp-json/)
  const restRoot = wpSettings.restUrl.replace(/blu\/v1\/?$/, '');
  apiFetch.use(apiFetch.createRootURLMiddleware(restRoot));
  apiFetch.use(apiFetch.createNonceMiddleware(wpSettings.nonce));
}

/**
 * Thin wrapper around apiFetch that returns { data } so existing
 * React Query hooks continue to work without changes.
 */
const api = {
  get: (path, opts = {}) =>
    apiFetch({ path: `/blu/v1${path}`, ...opts }).then((data) => ({ data })),

  post: (path, body, opts = {}) =>
    apiFetch({ path: `/blu/v1${path}`, method: 'POST', data: body, ...opts }).then((data) => ({ data })),

  put: (path, body, opts = {}) =>
    apiFetch({ path: `/blu/v1${path}`, method: 'PUT', data: body, ...opts }).then((data) => ({ data })),

  delete: (path, opts = {}) =>
    apiFetch({ path: `/blu/v1${path}`, method: 'DELETE', ...opts }).then((data) => ({ data })),
};

// Products API
export const productsAPI = {
  getAll: (params) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return api.get(`/products${qs}`);
  },
  getOne: (id) => api.get(`/products/${id}`),
  create: (data) => api.post('/products', data),
  update: (id, data) => api.put(`/products/${id}`, data),
  delete: (id) => api.delete(`/products/${id}`),
};

// Orders API
export const ordersAPI = {
  getAll: (params) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return api.get(`/orders${qs}`);
  },
  getOne: (id) => api.get(`/orders/${id}`),
  getStats: () => api.get('/orders/stats'),
  updateStatus: (id, status) => api.put(`/orders/${id}/status`, { status }),
  updateTracking: (id, tracking) => api.put(`/orders/${id}/tracking`, tracking),
  create: (data) => api.post('/orders', data),
  getEvents: (id) => api.get(`/orders/${id}/events`),
  addNote: (id, note) => api.post(`/orders/${id}/notes`, { note }),
  createRefund: (id, data) => api.post(`/orders/${id}/refund`, data),
};

// Shipping API
export const shippingAPI = {
  getAll: (params) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return api.get(`/shipping${qs}`);
  },
  getOne: (id) => api.get(`/shipping/${id}`),
  create: (data) => api.post('/shipping', data),
  update: (id, data) => api.put(`/shipping/${id}`, data),
  delete: (id) => api.delete(`/shipping/${id}`),
};

// Store API
export const storeAPI = {
  get: () => api.get('/store'),
  getPublic: () => api.get('/store/public'),
  update: (data) => api.put('/store', data),
  // Stripe Connect
  getStripeConnectUrl: () => api.get('/store/stripe/connect'),
  getStripeStatus: () => api.get('/store/stripe/status'),
  getStripeOnboardingUrl: () => api.get('/store/stripe/onboarding'),
  disconnectStripe: () => api.post('/store/stripe/disconnect'),
  // Tax
  getTax: () => api.get('/store/tax'),
  updateTax: (data) => api.put('/store/tax', data),
};

// Discounts API
export const discountsAPI = {
  getAll: (params) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return api.get(`/discounts${qs}`);
  },
  getOne: (id) => api.get(`/discounts/${id}`),
  create: (data) => api.post('/discounts', data),
  update: (id, data) => api.put(`/discounts/${id}`, data),
  delete: (id) => api.delete(`/discounts/${id}`),
  validate: (code, subtotal) => api.post('/discounts/validate', { code, subtotal }),
  getUsage: (id) => api.get(`/discounts/${id}/usage`),
};

// Customers API (CRM)
export const customersAPI = {
  getAll: (params) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return api.get(`/customers${qs}`);
  },
  getOne: (id) => api.get(`/customers/${id}`),
  create: (data) => api.post('/customers', data),
  update: (id, data) => api.put(`/customers/${id}`, data),
  delete: (id) => api.delete(`/customers/${id}`),
  addNote: (id, text) => api.post(`/customers/${id}/notes`, { text }),
  deleteNote: (id, noteId) => api.delete(`/customers/${id}/notes/${noteId}`),
  getByEmail: (email) => api.get(`/customers/lookup?email=${encodeURIComponent(email)}`),
  sync: () => api.post('/customers/sync'),
};

// Demo API
export const demoAPI = {
  getStatus: () => api.get('/demo/status'),
  populate: () => api.post('/demo/populate'),
  reset: () => api.post('/demo/reset'),
};

// Platforms API
export const platformsAPI = {
  getAll: () => api.get('/platforms'),
  create: (data) => api.post('/platforms', data),
  delete: (id) => api.delete(`/platforms/${id}`),
  syncPull: (platformId) => api.post(`/sync/pull/${platformId}`),
  syncPush: (productId, platformId) => api.post(`/sync/push/${productId}/${platformId}`),
};

// Channels API (Sales Channels - Google Merchant, Meta, etc.)
export const channelsAPI = {
  getAll: () => api.get('/channels'),
  getAvailable: () => api.get('/channels/available'),
  getOne: (id) => api.get(`/channels/${id}`),
  configure: (id, data) => api.post(`/channels/${id}/configure`, data),
  sync: (id, productIds) => api.post(`/channels/${id}/sync`, { product_ids: productIds }),
  getStatus: (id) => api.get(`/channels/${id}/status`),
  getLogs: (id, limit) => api.get(`/channels/${id}/logs${limit ? '?limit=' + limit : ''}`),
  getProducts: (id, params) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return api.get(`/channels/${id}/products${qs}`);
  },
  disconnect: (id) => api.delete(`/channels/${id}`),
  // Google specific
  startGoogleAuth: () => api.post('/channels/google/auth'),
  // Meta Commerce
  startMetaAuth: (data) => api.post('/channels/meta/auth', data),
  // Etsy
  startEtsyAuth: (data) => api.post('/channels/etsy/auth', data),
  // TikTok Shop
  startTikTokAuth: (data) => api.post('/channels/tiktok/auth', data),
};

// Integrations API (Meta, Etsy, TikTok)
export const integrationsAPI = {
  getAvailable: () => api.get('/integrations/available'),
  // OAuth
  startMetaAuth: (data) => api.post('/integrations/meta/auth', data),
  startEtsyAuth: (data) => api.post('/integrations/etsy/auth', data),
  startTikTokAuth: (data) => api.post('/integrations/tiktok/auth', data),
  // Sync
  sync: (channelId, data) => api.post(`/integrations/${channelId}/sync`, data),
  // Import
  scan: (channelId) => api.get(`/integrations/${channelId}/scan`),
  importStore: (channelId, data) => api.post(`/integrations/${channelId}/import`, data),
};

// Variants API (Product Options & Variants)
export const variantsAPI = {
  // Get all options and variants for a product
  getAll: (productId) => api.get(`/products/${productId}/variants`),

  // Options (Size, Color, etc.)
  createOption: (productId, data) => api.post(`/products/${productId}/options`, data),
  updateOption: (productId, optionId, data) => api.put(`/products/${productId}/options/${optionId}`, data),
  deleteOption: (productId, optionId) => api.delete(`/products/${productId}/options/${optionId}`),

  // Option Values (Small, Medium, Large)
  createValue: (productId, optionId, data) => api.post(`/products/${productId}/options/${optionId}/values`, data),
  deleteValue: (productId, optionId, valueId) => api.delete(`/products/${productId}/options/${optionId}/values/${valueId}`),

  // Variants (Small/Red, Medium/Blue)
  createVariant: (productId, data) => api.post(`/products/${productId}/variants`, data),
  updateVariant: (productId, variantId, data) => api.put(`/products/${productId}/variants/${variantId}`, data),
  deleteVariant: (productId, variantId) => api.delete(`/products/${productId}/variants/${variantId}`),

  // Bulk operations
  generateVariants: (productId, data) => api.post(`/products/${productId}/variants/generate`, data),
  bulkUpdateVariants: (productId, updates) => api.put(`/products/${productId}/variants/bulk`, { updates }),
};

// Analytics API
export const analyticsAPI = {
  getOverview: (params) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return api.get(`/analytics/overview${qs}`);
  },
  getRevenue: (params) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return api.get(`/analytics/revenue${qs}`);
  },
  getOrders: (params) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return api.get(`/analytics/orders${qs}`);
  },
  getProducts: (params) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return api.get(`/analytics/products${qs}`);
  },
  getCustomers: (params) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return api.get(`/analytics/customers${qs}`);
  },
};

// WooCommerce Sync API (WordPress plugin only)
export const wooSyncAPI = {
  getStatus: () => api.get('/sync/woo/status'),
  importProducts: () => api.post('/sync/woo/import-products'),
  importOrders: () => api.post('/sync/woo/import-orders'),
};

// ── WordPress Core REST API client (for pages, posts, media, etc.) ──
const wpApi = {
  get: (path, opts = {}) =>
    apiFetch({ path: `/wp/v2${path}`, ...opts }).then((data) => ({ data })),

  post: (path, body, opts = {}) =>
    apiFetch({ path: `/wp/v2${path}`, method: 'POST', data: body, ...opts }).then((data) => ({ data })),

  delete: (path, opts = {}) =>
    apiFetch({ path: `/wp/v2${path}`, method: 'DELETE', ...opts }).then((data) => ({ data })),
};

// WordPress Pages API
export const wpPagesAPI = {
  getAll: (params = {}) => {
    const defaults = { per_page: 100, orderby: 'modified', order: 'desc', status: 'publish,draft,private,pending,future' };
    const qs = '?' + new URLSearchParams({ ...defaults, ...params }).toString();
    return wpApi.get(`/pages${qs}`);
  },
  getOne: (id) => wpApi.get(`/pages/${id}`),
  create: (data) => wpApi.post('/pages', data),
  update: (id, data) => wpApi.post(`/pages/${id}`, data),
  trash: (id) => wpApi.delete(`/pages/${id}`),
};

// Design API (Brand, Fonts, Colors, Navigation)
export const designAPI = {
  getCapabilities: () => api.get('/design/capabilities'),
  getSettings: () => api.get('/design/settings'),
  updateSettings: (data) => api.put('/design/settings', data),
  applyToTheme: () => api.post('/design/apply'),
  getVersions: () => api.get('/design/versions'),
  restoreVersion: (index) => api.post(`/design/versions/${index}/restore`),
  getFonts: () => api.get('/design/fonts'),
  // Menus
  getMenus: () => api.get('/design/menus'),
  createMenu: (data) => api.post('/design/menus', data),
  updateMenu: (id, data) => api.put(`/design/menus/${id}`, data),
  deleteMenu: (id) => api.delete(`/design/menus/${id}`),
};

// Abandoned Carts API
export const abandonedCartsAPI = {
  getAll: (params) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return api.get(`/abandoned-carts${qs}`);
  },
  getOne: (id) => api.get(`/abandoned-carts/${id}`),
  getStats: (params) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return api.get(`/abandoned-carts/stats${qs}`);
  },
  getAnalytics: (params) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return api.get(`/abandoned-carts/analytics${qs}`);
  },
  delete: (id) => api.delete(`/abandoned-carts/${id}`),
  sendEmail: (id) => api.post(`/abandoned-carts/${id}/send-email`),
  getSettings: () => api.get('/abandoned-carts/settings'),
  updateSettings: (data) => api.put('/abandoned-carts/settings', data),
  sendTestEmail: () => api.post('/abandoned-carts/test-email'),
};

// Helper to build wp-admin URLs
export const wpAdminUrl = (path) => {
  if (!wpSettings) return '#';
  return `${wpSettings.siteUrl}/wp-admin/${path}`;
};

export default api;
