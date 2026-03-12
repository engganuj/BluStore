import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { productsAPI, platformsAPI, ordersAPI, shippingAPI, storeAPI, discountsAPI, customersAPI, demoAPI, channelsAPI, integrationsAPI, wpPagesAPI, designAPI, analyticsAPI, abandonedCartsAPI, wpAdminUrl } from '../api/client';
import toast from 'react-hot-toast';

// Products hooks
export const useProducts = (params = {}) => {
  return useQuery({
    queryKey: ['products', params],
    queryFn: async () => {
      const response = await productsAPI.getAll(params);
      return response.data;
    },
  });
};

export const useProduct = (id) => {
  return useQuery({
    queryKey: ['product', id],
    queryFn: async () => {
      const response = await productsAPI.getOne(id);
      return response.data.product;
    },
    enabled: !!id,
  });
};

export const useCreateProduct = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (data) => productsAPI.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      toast.success('Product created successfully!');
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to create product');
    },
  });
};

export const useUpdateProduct = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, data }) => productsAPI.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      toast.success('Product updated successfully!');
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to update product');
    },
  });
};

export const useDeleteProduct = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (id) => productsAPI.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      toast.success('Product deleted successfully!');
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to delete product');
    },
  });
};

// Platforms hooks
export const usePlatforms = () => {
  return useQuery({
    queryKey: ['platforms'],
    queryFn: async () => {
      const response = await platformsAPI.getAll();
      return response.data.platforms || [];
    },
  });
};

export const useCreatePlatform = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (data) => platformsAPI.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platforms'] });
      toast.success('Platform connected! Now click "Sync from Platform" to import products.');
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to connect platform');
    },
  });
};

export const useDeletePlatform = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (id) => platformsAPI.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platforms'] });
      toast.success('Platform disconnected successfully!');
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to disconnect platform');
    },
  });
};

export const useSyncPull = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (platformId) => platformsAPI.syncPull(platformId),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      const data = response.data;
      toast.success(
        `Sync complete!\n✅ Created: ${data.created}\n✅ Updated: ${data.updated}\n${data.errors ? `❌ Errors: ${data.errors}` : ''}`,
        { duration: 5000 }
      );
    },
    onError: (error) => {
      toast.error(error.message || 'Sync failed');
    },
  });
};

export const useSyncPush = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ productId, platformId }) => platformsAPI.syncPush(productId, platformId),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      const data = response.data;
      toast.success(`Product pushed to platform!\n🔗 ${data.platform_url}`, {
        duration: 5000,
      });
    },
    onError: (error) => {
      toast.error(error.message || 'Push failed');
    },
  });
};

// Orders hooks
export const useOrders = (params = {}) => {
  return useQuery({
    queryKey: ['orders', params],
    queryFn: async () => {
      const response = await ordersAPI.getAll(params);
      return response.data;
    },
  });
};

export const useOrder = (id) => {
  return useQuery({
    queryKey: ['order', id],
    queryFn: async () => {
      const response = await ordersAPI.getOne(id);
      return response.data.order;
    },
    enabled: !!id,
  });
};

export const useOrderStats = () => {
  return useQuery({
    queryKey: ['orderStats'],
    queryFn: async () => {
      const response = await ordersAPI.getStats();
      return response.data;
    },
  });
};

export const useCreateOrder = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data) => ordersAPI.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['orderStats'] });
      toast.success('Order created!');
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to create order');
    },
  });
};

export const useUpdateOrderStatus = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, status }) => ordersAPI.updateStatus(id, status),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['order', variables.id] });
      queryClient.invalidateQueries({ queryKey: ['orderEvents', variables.id] });
      queryClient.invalidateQueries({ queryKey: ['orderStats'] });
      toast.success('Order status updated!');
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to update order status');
    },
  });
};

export const useOrderEvents = (id) => {
  return useQuery({
    queryKey: ['orderEvents', id],
    queryFn: async () => {
      const response = await ordersAPI.getEvents(id);
      return response.data.events;
    },
    enabled: !!id,
  });
};

export const useAddOrderNote = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, note }) => ordersAPI.addNote(id, note),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['orderEvents', variables.id] });
      toast.success('Note added');
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to add note');
    },
  });
};

export const useRefundOrder = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, amount_cents, reason }) => ordersAPI.createRefund(id, { amount_cents, reason }),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['order', variables.id] });
      queryClient.invalidateQueries({ queryKey: ['orderEvents', variables.id] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['orderStats'] });
      toast.success('Refund processed');
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to process refund');
    },
  });
};

export const useUpdateOrderTracking = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, tracking }) => ordersAPI.updateTracking(id, tracking),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['order', variables.id] });
      queryClient.invalidateQueries({ queryKey: ['orderEvents', variables.id] });
      toast.success('Tracking info updated!');
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to update tracking');
    },
  });
};

// Shipping hooks
export const useShippingOptions = (params = {}) => {
  return useQuery({
    queryKey: ['shippingOptions', params],
    queryFn: async () => {
      const response = await shippingAPI.getAll(params);
      return response.data.shipping_options || [];
    },
  });
};

export const useCreateShippingOption = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (data) => shippingAPI.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shippingOptions'] });
      toast.success('Shipping option created!');
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to create shipping option');
    },
  });
};

export const useUpdateShippingOption = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, data }) => shippingAPI.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shippingOptions'] });
      toast.success('Shipping option updated!');
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to update shipping option');
    },
  });
};

export const useDeleteShippingOption = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (id) => shippingAPI.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shippingOptions'] });
      toast.success('Shipping option deleted!');
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to delete shipping option');
    },
  });
};

// Store hooks
export const useStore = () => {
  return useQuery({
    queryKey: ['store'],
    queryFn: async () => {
      const response = await storeAPI.get();
      return response.data.store;
    },
  });
};

export const useUpdateStore = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (data) => storeAPI.update(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['store'] });
      toast.success('Store settings saved!');
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to save store settings');
    },
  });
};

export const useStripeStatus = () => {
  return useQuery({
    queryKey: ['stripeStatus'],
    queryFn: async () => {
      const response = await storeAPI.getStripeStatus();
      return response.data;
    },
  });
};

export const useStripeConnect = () => {
  return useMutation({
    mutationFn: async () => {
      const response = await storeAPI.getStripeConnectUrl();
      return response.data;
    },
    onSuccess: (data) => {
      window.location.href = data.url;
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to connect to Stripe');
    },
  });
};

export const useStripeOnboarding = () => {
  return useMutation({
    mutationFn: async () => {
      const response = await storeAPI.getStripeOnboardingUrl();
      return response.data;
    },
    onSuccess: (data) => {
      window.location.href = data.url;
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to get onboarding link');
    },
  });
};

export const useStripeDisconnect = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: () => storeAPI.disconnectStripe(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stripeStatus'] });
      queryClient.invalidateQueries({ queryKey: ['store'] });
      toast.success('Stripe account disconnected');
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to disconnect Stripe');
    },
  });
};

// Tax hooks
export const useTaxSettings = () => {
  return useQuery({
    queryKey: ['taxSettings'],
    queryFn: async () => {
      const response = await storeAPI.getTax();
      return response.data.tax;
    },
  });
};

export const useUpdateTaxSettings = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data) => storeAPI.updateTax(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['taxSettings'] });
      toast.success('Tax settings saved!');
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to save tax settings');
    },
  });
};

// Discount hooks
export const useDiscounts = (params = {}) => {
  return useQuery({
    queryKey: ['discounts', params],
    queryFn: async () => {
      const response = await discountsAPI.getAll(params);
      return response.data.discounts || [];
    },
  });
};

export const useDiscount = (id) => {
  return useQuery({
    queryKey: ['discount', id],
    queryFn: async () => {
      const response = await discountsAPI.getOne(id);
      return response.data.discount;
    },
    enabled: !!id,
  });
};

export const useDiscountUsage = (id) => {
  return useQuery({
    queryKey: ['discountUsage', id],
    queryFn: async () => {
      const response = await discountsAPI.getUsage(id);
      return response.data;
    },
    enabled: !!id,
  });
};

export const useCreateDiscount = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data) => discountsAPI.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['discounts'] });
      toast.success('Discount created!');
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to create discount');
    },
  });
};

export const useUpdateDiscount = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }) => discountsAPI.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['discounts'] });
      toast.success('Discount updated!');
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to update discount');
    },
  });
};

export const useDeleteDiscount = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id) => discountsAPI.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['discounts'] });
      toast.success('Discount deleted!');
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to delete discount');
    },
  });
};

// Customer hooks (CRM)
export const useCustomers = (params = {}) => {
  return useQuery({
    queryKey: ['customers', params],
    queryFn: async () => {
      const response = await customersAPI.getAll(params);
      return response.data;
    },
  });
};

export const useCustomer = (id) => {
  return useQuery({
    queryKey: ['customer', id],
    queryFn: async () => {
      const response = await customersAPI.getOne(id);
      return response.data.customer;
    },
    enabled: !!id,
  });
};

export const useCreateCustomer = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data) => customersAPI.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      toast.success('Customer created!');
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to create customer');
    },
  });
};

export const useUpdateCustomer = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }) => customersAPI.update(id, data),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      queryClient.invalidateQueries({ queryKey: ['customer', variables.id] });
      toast.success('Customer updated!');
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to update customer');
    },
  });
};

export const useDeleteCustomer = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id) => customersAPI.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      toast.success('Customer deleted!');
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to delete customer');
    },
  });
};

export const useAddCustomerNote = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, text }) => customersAPI.addNote(id, text),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['customer', variables.id] });
      toast.success('Note added');
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to add note');
    },
  });
};

export const useDeleteCustomerNote = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, noteId }) => customersAPI.deleteNote(id, noteId),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['customer', variables.id] });
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to delete note');
    },
  });
};

// Demo hooks
export const useDemoStatus = () => {
  return useQuery({
    queryKey: ['demoStatus'],
    queryFn: async () => {
      const response = await demoAPI.getStatus();
      return response.data;
    },
  });
};

export const useDemoPopulate = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: () => demoAPI.populate(),
    onSuccess: (response) => {
      queryClient.invalidateQueries();
      toast.success(response.data.message || 'Demo data loaded!');
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to load demo data');
    },
  });
};

export const useDemoReset = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: () => demoAPI.reset(),
    onSuccess: (response) => {
      queryClient.invalidateQueries();
      toast.success(response.data.message || 'Reset complete!');
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to reset');
    },
  });
};

// Channels hooks (Sales Channels - Google Merchant, Meta, etc.)
export const useChannels = () => {
  return useQuery({
    queryKey: ['channels'],
    queryFn: async () => {
      const response = await channelsAPI.getAll();
      return response.data.channels || [];
    },
  });
};

export const useAvailableChannels = () => {
  return useQuery({
    queryKey: ['availableChannels'],
    queryFn: async () => {
      const response = await channelsAPI.getAvailable();
      return response.data.channels || [];
    },
  });
};

export const useChannel = (id) => {
  return useQuery({
    queryKey: ['channel', id],
    queryFn: async () => {
      const response = await channelsAPI.getOne(id);
      return response.data.channel;
    },
    enabled: !!id,
  });
};

export const useChannelStatus = (id) => {
  return useQuery({
    queryKey: ['channelStatus', id],
    queryFn: async () => {
      const response = await channelsAPI.getStatus(id);
      return response.data;
    },
    enabled: !!id,
  });
};

export const useChannelLogs = (id, limit = 10) => {
  return useQuery({
    queryKey: ['channelLogs', id, limit],
    queryFn: async () => {
      const response = await channelsAPI.getLogs(id, limit);
      return response.data.logs || [];
    },
    enabled: !!id,
  });
};

export const useStartGoogleAuth = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: () => channelsAPI.startGoogleAuth(),
    onSuccess: (response) => {
      if (response.data.authUrl) {
        window.location.href = response.data.authUrl;
      } else if (response.data.demo_mode) {
        queryClient.invalidateQueries({ queryKey: ['channels'] });
        toast.success('Google Merchant Center connected (Demo Mode)');
      }
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to start Google authentication');
    },
  });
};

export const useStartMetaAuth = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (data) => channelsAPI.startMetaAuth(data),
    onSuccess: (response) => {
      if (response.data.authUrl) {
        window.location.href = response.data.authUrl;
      } else if (response.data.demo_mode) {
        queryClient.invalidateQueries({ queryKey: ['channels'] });
        toast.success('Meta Commerce connected (Demo Mode)');
      }
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to start Meta authentication');
    },
  });
};

export const useStartEtsyAuth = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (data) => channelsAPI.startEtsyAuth(data),
    onSuccess: (response) => {
      if (response.data.authUrl) {
        window.location.href = response.data.authUrl;
      } else if (response.data.demo_mode) {
        queryClient.invalidateQueries({ queryKey: ['channels'] });
        toast.success('Etsy connected (Demo Mode)');
      }
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to start Etsy authentication');
    },
  });
};

export const useStartTikTokAuth = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (data) => channelsAPI.startTikTokAuth(data),
    onSuccess: (response) => {
      if (response.data.authUrl) {
        window.location.href = response.data.authUrl;
      } else if (response.data.demo_mode) {
        queryClient.invalidateQueries({ queryKey: ['channels'] });
        toast.success('TikTok Shop connected (Demo Mode)');
      }
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to start TikTok authentication');
    },
  });
};

export const useConfigureChannel = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, config }) => channelsAPI.configure(id, config),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['channels'] });
      toast.success('Channel configured!');
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to configure channel');
    },
  });
};

export const useSyncChannel = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, productIds }) => channelsAPI.sync(id, productIds),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ['channels'] });
      queryClient.invalidateQueries({ queryKey: ['channelStatus'] });
      const results = response.data.results;
      toast.success(
        `Sync complete! ${results.synced}/${results.total} products synced`,
        { duration: 5000 }
      );
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to sync channel');
    },
  });
};

export const useDisconnectChannel = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (id) => channelsAPI.disconnect(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['channels'] });
      toast.success('Channel disconnected');
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to disconnect channel');
    },
  });
};

// ── Integration hooks (Meta, Etsy, TikTok) ──────────────────────────────

export const useAvailableIntegrations = () => {
  return useQuery({
    queryKey: ['integrations-available'],
    queryFn: async () => {
      const response = await integrationsAPI.getAvailable();
      return response.data.integrations || [];
    },
  });
};

export const useSyncIntegration = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ channelId, direction, productIds }) =>
      integrationsAPI.sync(channelId, { direction, product_ids: productIds }),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ['channels'] });
      const r = response.data.results;
      toast.success(`Sync complete! ${r.synced}/${r.total} products synced`, { duration: 5000 });
    },
    onError: (error) => {
      toast.error(error.message || 'Sync failed');
    },
  });
};

export const useScanIntegration = (channelId) => {
  return useQuery({
    queryKey: ['integration-scan', channelId],
    queryFn: async () => {
      const response = await integrationsAPI.scan(channelId);
      return response.data;
    },
    enabled: !!channelId,
  });
};

export const useImportIntegration = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ channelId, options }) => integrationsAPI.importStore(channelId, options),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      const r = response.data;
      toast.success(`Import complete! ${r.products_imported} products imported`, { duration: 5000 });
    },
    onError: (error) => {
      toast.error(error.message || 'Import failed');
    },
  });
};

// ── WordPress Pages hooks ──

export const useWPPages = () => {
  return useQuery({
    queryKey: ['wp-pages'],
    queryFn: async () => {
      const response = await wpPagesAPI.getAll();
      return response?.data || [];
    },
  });
};

export const useCreateWPPage = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data) => wpPagesAPI.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wp-pages'] });
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to create page');
    },
  });
};

export const useUpdateWPPage = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }) => wpPagesAPI.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wp-pages'] });
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to update page');
    },
  });
};

export const useTrashWPPage = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id) => wpPagesAPI.trash(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wp-pages'] });
      toast.success('Page moved to trash');
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to delete page');
    },
  });
};

// ── Design hooks (Brand, Fonts, Colors, Navigation) ──

export const useDesignCapabilities = () => {
  return useQuery({
    queryKey: ['design-capabilities'],
    queryFn: async () => {
      const response = await designAPI.getCapabilities();
      return response.data;
    },
  });
};

export const useDesignSettings = () => {
  return useQuery({
    queryKey: ['design-settings'],
    queryFn: async () => {
      const response = await designAPI.getSettings();
      return response.data.settings;
    },
  });
};

export const useUpdateDesignSettings = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data) => designAPI.updateSettings(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['design-settings'] });
      toast.success('Design settings saved!');
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to save design settings');
    },
  });
};

export const useApplyDesignToTheme = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => designAPI.applyToTheme(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['design-settings'] });
      queryClient.invalidateQueries({ queryKey: ['design-versions'] });
      toast.success('Design applied to theme!');
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to apply design to theme');
    },
  });
};

export const useDesignVersions = () => {
  return useQuery({
    queryKey: ['design-versions'],
    queryFn: async () => {
      const response = await designAPI.getVersions();
      return response.data.versions || [];
    },
  });
};

export const useRestoreDesignVersion = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (index) => designAPI.restoreVersion(index),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['design-settings'] });
      queryClient.invalidateQueries({ queryKey: ['design-versions'] });
      toast.success('Version restored! Click "Apply to Theme" to push changes live.');
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to restore version');
    },
  });
};

export const useDesignFonts = () => {
  return useQuery({
    queryKey: ['design-fonts'],
    queryFn: async () => {
      const response = await designAPI.getFonts();
      return response.data.fonts || [];
    },
    staleTime: Infinity,
  });
};

export const useDesignMenus = () => {
  return useQuery({
    queryKey: ['design-menus'],
    queryFn: async () => {
      const response = await designAPI.getMenus();
      return response.data;
    },
  });
};

export const useCreateDesignMenu = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data) => designAPI.createMenu(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['design-menus'] });
      toast.success('Menu created!');
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to create menu');
    },
  });
};

export const useUpdateDesignMenu = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }) => designAPI.updateMenu(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['design-menus'] });
      toast.success('Menu updated!');
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to update menu');
    },
  });
};

export const useDeleteDesignMenu = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id) => designAPI.deleteMenu(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['design-menus'] });
      toast.success('Menu deleted!');
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to delete menu');
    },
  });
};

// ── Analytics hooks ──

export const useAnalyticsOverview = (params = {}) => {
  return useQuery({
    queryKey: ['analytics-overview', params],
    queryFn: async () => {
      const response = await analyticsAPI.getOverview(params);
      return response.data;
    },
  });
};

export const useAnalyticsRevenue = (params = {}) => {
  return useQuery({
    queryKey: ['analytics-revenue', params],
    queryFn: async () => {
      const response = await analyticsAPI.getRevenue(params);
      return response.data;
    },
  });
};

export const useAnalyticsOrders = (params = {}) => {
  return useQuery({
    queryKey: ['analytics-orders', params],
    queryFn: async () => {
      const response = await analyticsAPI.getOrders(params);
      return response.data;
    },
  });
};

export const useAnalyticsProducts = (params = {}) => {
  return useQuery({
    queryKey: ['analytics-products', params],
    queryFn: async () => {
      const response = await analyticsAPI.getProducts(params);
      return response.data;
    },
  });
};

export const useAnalyticsCustomers = (params = {}) => {
  return useQuery({
    queryKey: ['analytics-customers', params],
    queryFn: async () => {
      const response = await analyticsAPI.getCustomers(params);
      return response.data;
    },
  });
};

// ── Abandoned Carts ──────────────────────────────────────────
export const useAbandonedCarts = (params = {}) => {
  return useQuery({
    queryKey: ['abandoned-carts', params],
    queryFn: async () => {
      const response = await abandonedCartsAPI.getAll(params);
      return response.data;
    },
  });
};

export const useAbandonedCart = (id) => {
  return useQuery({
    queryKey: ['abandoned-cart', id],
    queryFn: async () => {
      const response = await abandonedCartsAPI.getOne(id);
      return response.data?.cart;
    },
    enabled: !!id,
  });
};

export const useAbandonedCartStats = (params = {}) => {
  return useQuery({
    queryKey: ['abandoned-cart-stats', params],
    queryFn: async () => {
      const response = await abandonedCartsAPI.getStats(params);
      return response.data;
    },
  });
};

export const useAbandonedCartAnalytics = (params = {}) => {
  return useQuery({
    queryKey: ['abandoned-cart-analytics', params],
    queryFn: async () => {
      const response = await abandonedCartsAPI.getAnalytics(params);
      return response.data;
    },
  });
};

export const useAbandonedCartSettings = () => {
  return useQuery({
    queryKey: ['abandoned-cart-settings'],
    queryFn: async () => {
      const response = await abandonedCartsAPI.getSettings();
      return response.data?.settings;
    },
  });
};

export const useUpdateAbandonedCartSettings = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data) => abandonedCartsAPI.updateSettings(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['abandoned-cart-settings'] });
      toast.success('Settings saved');
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to save settings');
    },
  });
};

export const useDeleteAbandonedCart = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id) => abandonedCartsAPI.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['abandoned-carts'] });
      queryClient.invalidateQueries({ queryKey: ['abandoned-cart-stats'] });
      toast.success('Cart deleted');
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to delete cart');
    },
  });
};

export const useSendRecoveryEmail = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id) => abandonedCartsAPI.sendEmail(id),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['abandoned-carts'] });
      toast.success(`Recovery email sent to ${data.data?.email || 'customer'}`);
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to send email');
    },
  });
};

export const useSendTestRecoveryEmail = () => {
  return useMutation({
    mutationFn: () => abandonedCartsAPI.sendTestEmail(),
    onSuccess: (data) => {
      toast.success(`Test email sent to ${data.data?.email || 'admin'}`);
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to send test email');
    },
  });
};

export { wpAdminUrl };
