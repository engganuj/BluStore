import { Link } from 'react-router-dom';
import { useOrderStats, useOrders, useProducts, useStore, useStripeStatus, useShippingOptions, useDemoStatus, useDemoPopulate, useTaxSettings, useAbandonedCartStats } from '../hooks/useAPI';
import SetupChecklist from '../components/SetupChecklist';
import { formatCents } from '../utils/helpers';
import { StatCard, StatusBadge, Card, LoadingSpinner } from '../components/shared';
import {
  CurrencyDollarIcon,
  ChartBarIcon,
  ClipboardDocumentListIcon,
  CubeIcon,
  PlusIcon,
  Cog6ToothIcon,
  TruckIcon,
  BoltIcon,
  UsersIcon,
  PaintBrushIcon,
  SparklesIcon,
  ShoppingCartIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline';

// ── Quick action card ────────────────────────────────────────
const QuickAction = ({ to, icon, title, subtitle, color = 'primary' }) => {
  const bg = {
    primary: 'bg-primary-50 text-primary-600',
    green: 'bg-success-50 text-success-600',
    purple: 'bg-navy-50 text-navy-600',
  };
  return (
    <Link
      to={to}
      className="flex items-center gap-3.5 bg-white rounded-xl border border-gray-200 p-4 hover:border-gray-300 hover:shadow-sm transition-all group"
    >
      <div className={`p-2.5 rounded-lg ${bg[color]} transition-colors`}>{icon}</div>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-gray-900">{title}</p>
        <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>
      </div>
    </Link>
  );
};

// ── Zero state (no data, no demo) ────────────────────────────
const ZeroStatePrompt = ({ onLoadDemo }) => (
  <div className="bg-gray-50 border border-gray-200 rounded-xl p-8 text-center mt-2">
    <div className="max-w-sm mx-auto">
      <div className="w-12 h-12 mx-auto mb-4 bg-primary-50 rounded-xl flex items-center justify-center">
        <SparklesIcon className="w-6 h-6 text-primary-600" />
      </div>
      <p className="text-sm text-gray-600 mb-4">
        Just exploring? Load sample products, orders, and customers to see how everything works.
      </p>
      <button
        onClick={onLoadDemo}
        className="inline-flex items-center gap-2 px-5 py-2.5 bg-gray-900 text-white rounded-lg text-sm font-semibold hover:bg-gray-800 transition-colors"
      >
        <BoltIcon className="w-4 h-4" />
        Load Demo Data
      </button>
    </div>
  </div>
);

// ── Greeting helper ──────────────────────────────────────────
const getGreeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
};

// ── Main ────────────────────────────────────────────────────
function DashboardPage() {
  const { data: stats, isLoading: statsLoading } = useOrderStats();
  const { data: ordersData, isLoading: ordersLoading } = useOrders({ limit: 5 });
  const { data: productsData, isLoading: productsLoading } = useProducts({ limit: 100 });
  const { data: store } = useStore();
  const { data: stripeStatus } = useStripeStatus();
  const { data: shippingOptions } = useShippingOptions();
  const { data: taxSettings } = useTaxSettings();
  const { data: demoStatus } = useDemoStatus();
  const populateDemo = useDemoPopulate();
  const { data: abandonedStats } = useAbandonedCartStats();

  // Determine if setup is complete
  const isSetupComplete = !!(
    store?.name &&
    store?.logo_url &&
    stripeStatus?.connected &&
    stripeStatus?.account_details?.charges_enabled &&
    Array.isArray(shippingOptions) && shippingOptions.length > 0 &&
    (productsData?.total || 0) > 0 &&
    taxSettings?.tax_enabled
  );

  const recentOrders = ordersData?.orders || [];
  const products = productsData?.products || [];
  const lowStockProducts = products.filter(
    (p) => p.inventory_qty <= 5 && p.track_inventory
  );

  const isLoading = statsLoading || ordersLoading || productsLoading;
  const hasNoData = !isLoading && products.length === 0 && recentOrders.length === 0;

  // Use WP logged-in user's name for greeting
  const userName = (typeof window !== 'undefined' && window.bluSettings?.userName) || '';

  return (
    <div className="max-w-7xl mx-auto px-4 py-4 sm:p-6">
      {/* Header with greeting */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
          {getGreeting()}{userName ? `, ${userName}` : ''}
        </h1>
        <p className="text-gray-500 mt-1 text-sm">
          Here's what's happening with your store today.
        </p>
      </div>

      {isLoading ? (
        <LoadingSpinner />
      ) : (
        <>
          {/* Stats — always visible, even at zero */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <StatCard
              title="Today's Revenue"
              value={formatCents(stats?.revenue_today_cents || 0)}
              subtext={`${stats?.orders_today || 0} orders`}
              icon={<CurrencyDollarIcon className="w-6 h-6" />}
              color="green"
            />
            <StatCard
              title="Total Revenue"
              value={formatCents(stats?.total_revenue_cents || 0)}
              subtext={`${stats?.total_orders || 0} total orders`}
              icon={<ChartBarIcon className="w-6 h-6" />}
              color="primary"
            />
            <StatCard
              title="Pending Orders"
              value={stats?.paid_orders || 0}
              subtext="Awaiting fulfilment"
              icon={<ClipboardDocumentListIcon className="w-6 h-6" />}
              color="orange"
            />
            <StatCard
              title="Products"
              value={productsData?.total || products.length}
              subtext={
                lowStockProducts.length > 0
                  ? `${lowStockProducts.length} low stock`
                  : 'All stocked'
              }
              icon={<CubeIcon className="w-6 h-6" />}
              color="purple"
            />
          </div>

          {/* Setup checklist — shown until all steps complete */}
          {!isSetupComplete && <SetupChecklist />}

          {/* Zero-state demo prompt — only when no data and not in demo mode */}
          {hasNoData && !demoStatus?.demo_mode && (
            <ZeroStatePrompt onLoadDemo={() => populateDemo.mutate()} />
          )}

          {/* Content panels — only show when there's data */}
          {!hasNoData && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
              {/* Recent orders */}
              <Card className="lg:col-span-2">
                <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                  <h2 className="font-semibold text-gray-900">Recent Orders</h2>
                  <Link to="/orders" className="text-sm text-primary-600 hover:text-primary-700 font-medium">
                    View all →
                  </Link>
                </div>
                {recentOrders.length === 0 ? (
                  <div className="p-8 text-center text-gray-500">
                    <ClipboardDocumentListIcon className="w-12 h-12 mx-auto text-gray-300 mb-3" />
                    <p>No orders yet</p>
                    <p className="text-sm mt-1">Orders will appear here once customers start buying.</p>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-100">
                    {recentOrders.map((order) => (
                      <Link
                        key={order.id}
                        to={`/orders/${order.id}`}
                        className="flex items-center justify-between px-6 py-4 hover:bg-gray-50 transition-colors"
                      >
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-full bg-primary-50 flex items-center justify-center text-primary-700 font-medium text-sm">
                            {(order.customer_name || order.customer_email || 'G')[0].toUpperCase()}
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">{order.order_number}</p>
                            <p className="text-sm text-gray-500">{order.customer_email || 'Guest'}</p>
                          </div>
                        </div>
                        <div className="text-right flex items-center gap-3">
                          <span className="font-semibold text-gray-900">{formatCents(order.total_cents)}</span>
                          <StatusBadge status={order.status} />
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </Card>

              {/* Low stock */}
              <Card>
                <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                  <h2 className="font-semibold text-gray-900">Low Stock</h2>
                  <Link to="/products" className="text-sm text-primary-600 hover:text-primary-700 font-medium">
                    View all →
                  </Link>
                </div>
                {lowStockProducts.length === 0 ? (
                  <div className="p-8 text-center text-gray-500">
                    <div className="w-12 h-12 mx-auto rounded-full bg-success-50 flex items-center justify-center mb-3">
                      <CubeIcon className="w-6 h-6 text-success-500" />
                    </div>
                    <p className="text-success-600 font-medium">All stocked up!</p>
                    <p className="text-sm mt-1">No products are running low.</p>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-100">
                    {lowStockProducts.slice(0, 5).map((product) => (
                      <Link
                        key={product.id}
                        to={`/products/${product.id}/edit`}
                        className="flex items-center justify-between px-6 py-4 hover:bg-gray-50 transition-colors"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-10 h-10 rounded-lg bg-gray-100 overflow-hidden flex-shrink-0">
                            {product.images?.[0]?.url ? (
                              <img src={product.images[0].url} alt={product.name} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <CubeIcon className="w-5 h-5 text-gray-400" />
                              </div>
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-gray-900 text-sm truncate">{product.name}</p>
                            <p className="text-xs text-gray-500">{product.sku || 'No SKU'}</p>
                          </div>
                        </div>
                        <span
                          className={`flex-shrink-0 px-2 py-1 rounded text-xs font-bold ${
                            product.inventory_qty === 0
                              ? 'bg-red-100 text-red-700'
                              : 'bg-warning-100 text-warning-700'
                          }`}
                        >
                          {product.inventory_qty === 0 ? 'Out' : product.inventory_qty + ' left'}
                        </span>
                      </Link>
                    ))}
                  </div>
                )}
              </Card>
            </div>
          )}

          {/* Abandoned cart recovery */}
          {(abandonedStats?.abandoned_count > 0 || abandonedStats?.revenue_recovered > 0) && (
            <div className="mt-6">
              <Link
                to="/abandoned-carts"
                className="block bg-white rounded-xl border border-gray-200 p-5 hover:border-gray-300 hover:shadow-sm transition-all"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="p-2.5 rounded-lg bg-warning-50">
                      <ShoppingCartIcon className="w-5 h-5 text-warning-600" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-900">
                        {abandonedStats.abandoned_count} abandoned cart{abandonedStats.abandoned_count !== 1 ? 's' : ''} this month
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {formatCents(abandonedStats.total_abandoned_value || 0)} recoverable revenue
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    {abandonedStats.revenue_recovered > 0 && (
                      <div className="text-right">
                        <p className="text-sm font-bold text-success-600">{formatCents(abandonedStats.revenue_recovered)}</p>
                        <p className="text-xs text-gray-500">recovered</p>
                      </div>
                    )}
                    <div className="flex items-center gap-1 text-primary-600 text-sm font-medium">
                      <ArrowPathIcon className="w-4 h-4" />
                      {abandonedStats.recovery_rate}% rate
                    </div>
                  </div>
                </div>
              </Link>
            </div>
          )}

          {/* Quick actions — always visible */}
          <div className="mt-6">
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
              Quick actions
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <QuickAction
                to="/products/new"
                icon={<PlusIcon className="w-5 h-5" />}
                color="primary"
                title="Add Product"
                subtitle="Create a new listing"
              />
              <QuickAction
                to="/design"
                icon={<PaintBrushIcon className="w-5 h-5" />}
                color="purple"
                title="Edit Design"
                subtitle="Colors, fonts, navigation"
              />
              <QuickAction
                to="/settings"
                icon={<Cog6ToothIcon className="w-5 h-5" />}
                color="green"
                title="Store Settings"
                subtitle="Branding, contact, currency"
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default DashboardPage;
