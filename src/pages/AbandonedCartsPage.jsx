import { useState } from 'react';
import {
  useAbandonedCarts,
  useAbandonedCartStats,
  useAbandonedCartAnalytics,
  useAbandonedCartSettings,
  useUpdateAbandonedCartSettings,
  useDeleteAbandonedCart,
  useSendRecoveryEmail,
  useSendTestRecoveryEmail,
} from '../hooks/useAPI';
import { formatCents } from '../utils/helpers';
import {
  PageHeader,
  StatCard,
  StatusBadge,
  Card,
  CardBody,
  Button,
  Input,
  LoadingSpinner,
} from '../components/shared';
import {
  ShoppingCartIcon,
  ArrowPathIcon,
  CurrencyDollarIcon,
  ChartBarIcon,
  EnvelopeIcon,
  TrashIcon,
  PaperAirplaneIcon,
  ClockIcon,
  CheckCircleIcon,
  XCircleIcon,
  EyeIcon,
  CursorArrowRaysIcon,
  CubeIcon,
  BeakerIcon,
} from '@heroicons/react/24/outline';

// ── Status badge mapping ──────────────────────────────────────
const CART_STATUS_MAP = {
  abandoned:  { label: 'Abandoned', className: 'bg-warning-100 text-warning-700' },
  recovered:  { label: 'Recovered', className: 'bg-primary-100 text-primary-700' },
  converted:  { label: 'Converted', className: 'bg-success-100 text-success-700' },
  active:     { label: 'Active',    className: 'bg-gray-100 text-gray-600' },
};

// ── Tab button ────────────────────────────────────────────────
const Tab = ({ active, children, onClick }) => (
  <button
    onClick={onClick}
    className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
      active
        ? 'bg-primary-50 text-primary-700'
        : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
    }`}
  >
    {children}
  </button>
);

// ── Email step indicator ──────────────────────────────────────
const EmailProgress = ({ sent, total = 3 }) => (
  <div className="flex items-center gap-1">
    {[1, 2, 3].map((step) => (
      <div
        key={step}
        className={`w-2 h-2 rounded-full ${
          step <= sent ? 'bg-primary-500' : 'bg-gray-200'
        }`}
      />
    ))}
    <span className="text-xs text-gray-500 ml-1">{sent}/{total}</span>
  </div>
);

// ── Email funnel bar ──────────────────────────────────────────
const FunnelBar = ({ label, value, max, color, icon: Icon }) => {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div className="flex items-center gap-3">
      <div className="w-24 text-sm text-gray-600 flex items-center gap-1.5">
        <Icon className="w-4 h-4" />
        {label}
      </div>
      <div className="flex-1 bg-gray-100 rounded-full h-6 overflow-hidden">
        <div
          className={`h-full rounded-full ${color} flex items-center justify-end pr-2 text-xs font-semibold text-white min-w-[32px] transition-all`}
          style={{ width: `${Math.max(pct, 8)}%` }}
        >
          {value}
        </div>
      </div>
      <span className="text-xs text-gray-400 w-12 text-right">
        {pct > 0 ? `${pct.toFixed(1)}%` : '—'}
      </span>
    </div>
  );
};

// ── Toggle switch ─────────────────────────────────────────────
const Toggle = ({ checked, onChange, label }) => (
  <label className="flex items-center gap-3 cursor-pointer">
    <div className="relative">
      <input
        type="checkbox"
        className="sr-only"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <div className={`w-10 h-6 rounded-full transition-colors ${checked ? 'bg-primary-600' : 'bg-gray-300'}`} />
      <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${checked ? 'translate-x-4' : ''}`} />
    </div>
    {label && <span className="text-sm text-gray-700">{label}</span>}
  </label>
);

// ── Cart detail modal ─────────────────────────────────────────
const CartDetailModal = ({ cart, onClose, onSendEmail, onDelete, sendingEmail }) => {
  if (!cart) return null;

  const items = cart.cart_contents || [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-gray-900">{cart.customer_name || 'Guest'}</h3>
            <p className="text-sm text-gray-500">{cart.customer_email || 'No email'}</p>
          </div>
          <StatusBadge status={cart.status} map={CART_STATUS_MAP} />
        </div>

        {/* Items */}
        <div className="px-6 py-4 border-b border-gray-100">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Cart Items</p>
          <div className="space-y-3">
            {items.map((item, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-lg bg-gray-100 overflow-hidden flex-shrink-0">
                  {item.image_url ? (
                    <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <CubeIcon className="w-5 h-5 text-gray-400" />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{item.name}</p>
                  <p className="text-xs text-gray-500">Qty: {item.quantity}</p>
                </div>
                <span className="text-sm font-semibold text-gray-900">{formatCents(item.price_cents * item.quantity)}</span>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between pt-3 mt-3 border-t border-gray-100">
            <span className="font-medium text-gray-600">Total</span>
            <span className="text-lg font-bold text-gray-900">{formatCents(cart.cart_total_cents)}</span>
          </div>
        </div>

        {/* Email timeline */}
        <div className="px-6 py-4 border-b border-gray-100">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Email Timeline</p>
          <div className="space-y-2">
            {[1, 2, 3].map((step) => {
              const sent = cart[`email${step}_sent_at`];
              const opened = cart[`email${step}_opened_at`];
              const clicked = cart[`email${step}_clicked_at`];
              return (
                <div key={step} className="flex items-center gap-3 text-sm">
                  <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                    sent ? 'bg-primary-100 text-primary-700' : 'bg-gray-100 text-gray-400'
                  }`}>{step}</span>
                  <div className="flex-1">
                    <span className="text-gray-700">Email {step}</span>
                    {sent && <span className="text-gray-400 text-xs ml-2">Sent {new Date(sent).toLocaleDateString()}</span>}
                  </div>
                  <div className="flex items-center gap-2">
                    {opened && <span className="text-xs text-success-600 flex items-center gap-0.5"><EyeIcon className="w-3.5 h-3.5" /> Opened</span>}
                    {clicked && <span className="text-xs text-primary-600 flex items-center gap-0.5"><CursorArrowRaysIcon className="w-3.5 h-3.5" /> Clicked</span>}
                    {!sent && <span className="text-xs text-gray-400">Not sent</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Discount code */}
        {cart.discount_code && (
          <div className="px-6 py-3 border-b border-gray-100 bg-primary-50/50">
            <p className="text-xs text-gray-500">Recovery Discount Code</p>
            <p className="text-sm font-bold text-primary-700 font-mono">{cart.discount_code}</p>
          </div>
        )}

        {/* Meta */}
        <div className="px-6 py-3 border-b border-gray-100 text-xs text-gray-400 space-y-1">
          {cart.abandoned_at && <p>Abandoned: {new Date(cart.abandoned_at).toLocaleString()}</p>}
          {cart.recovered_at && <p>Recovered: {new Date(cart.recovered_at).toLocaleString()}</p>}
          {cart.ip_address && <p>IP: {cart.ip_address}</p>}
        </div>

        {/* Actions */}
        <div className="px-6 py-4 flex items-center justify-between">
          <button
            onClick={onDelete}
            className="text-sm text-red-600 hover:text-red-700 flex items-center gap-1"
          >
            <TrashIcon className="w-4 h-4" />
            Delete
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
            >
              Close
            </button>
            {cart.status === 'abandoned' && cart.customer_email && cart.emails_sent < 3 && (
              <Button
                size="sm"
                onClick={onSendEmail}
                loading={sendingEmail}
              >
                <PaperAirplaneIcon className="w-4 h-4 mr-1" />
                Send Email {cart.emails_sent + 1}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// ── Carts Tab ─────────────────────────────────────────────────
const CartsTab = () => {
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [selectedCart, setSelectedCart] = useState(null);
  const { data: statsData } = useAbandonedCartStats();
  const { data, isLoading } = useAbandonedCarts({ status: statusFilter, search, limit: 50 });
  const deleteCart = useDeleteAbandonedCart();
  const sendEmail = useSendRecoveryEmail();

  const carts = data?.carts || [];
  const total = data?.total || 0;

  return (
    <>
      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard
          title="Abandoned (30d)"
          value={statsData?.abandoned_count || 0}
          subtext={formatCents(statsData?.total_abandoned_value || 0) + ' value'}
          icon={<ShoppingCartIcon className="w-6 h-6" />}
          color="orange"
        />
        <StatCard
          title="Recovery Rate"
          value={`${statsData?.recovery_rate || 0}%`}
          subtext={`${statsData?.recovered_count || 0} recovered`}
          icon={<ArrowPathIcon className="w-6 h-6" />}
          color="primary"
        />
        <StatCard
          title="Revenue Recovered"
          value={formatCents(statsData?.revenue_recovered || 0)}
          subtext={`${statsData?.converted_count || 0} converted`}
          icon={<CurrencyDollarIcon className="w-6 h-6" />}
          color="green"
        />
        <StatCard
          title="Avg Cart Value"
          value={formatCents(statsData?.avg_cart_value || 0)}
          subtext="Abandoned carts"
          icon={<ChartBarIcon className="w-6 h-6" />}
          color="purple"
        />
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-4">
        <div className="flex-1 max-w-xs">
          <input
            type="text"
            placeholder="Search by email or name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
        >
          <option value="">All Status</option>
          <option value="abandoned">Abandoned</option>
          <option value="recovered">Recovered</option>
          <option value="converted">Converted</option>
        </select>
        <span className="text-sm text-gray-500">{total} carts</span>
      </div>

      {/* Cart List */}
      {isLoading ? (
        <LoadingSpinner />
      ) : carts.length === 0 ? (
        <Card>
          <div className="p-12 text-center">
            <ShoppingCartIcon className="w-12 h-12 mx-auto text-gray-300 mb-3" />
            <p className="text-gray-600 font-medium">No abandoned carts yet</p>
            <p className="text-sm text-gray-500 mt-1">
              When customers add items to their cart but don't check out, they'll appear here.
            </p>
          </div>
        </Card>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">Customer</th>
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">Items</th>
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">Value</th>
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">Status</th>
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">Emails</th>
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">Abandoned</th>
                  <th className="text-right text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {carts.map((cart) => (
                  <tr
                    key={cart.id}
                    className="hover:bg-gray-50 cursor-pointer transition-colors"
                    onClick={() => setSelectedCart(cart)}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-primary-50 flex items-center justify-center text-primary-700 font-medium text-xs">
                          {(cart.customer_name || cart.customer_email || 'G')[0].toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">{cart.customer_name || 'Guest'}</p>
                          <p className="text-xs text-gray-500 truncate">{cart.customer_email || 'No email'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="flex -space-x-2">
                          {(cart.cart_contents || []).slice(0, 3).map((item, i) => (
                            <div key={i} className="w-7 h-7 rounded-md bg-gray-100 border-2 border-white overflow-hidden">
                              {item.image_url ? (
                                <img src={item.image_url} alt="" className="w-full h-full object-cover" />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                  <CubeIcon className="w-3.5 h-3.5 text-gray-400" />
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                        <span className="text-xs text-gray-500">{cart.item_count} item{cart.item_count !== 1 ? 's' : ''}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm font-semibold text-gray-900">{formatCents(cart.cart_total_cents)}</span>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={cart.status} map={CART_STATUS_MAP} />
                    </td>
                    <td className="px-4 py-3">
                      <EmailProgress sent={cart.emails_sent} />
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs text-gray-500">
                        {cart.abandoned_at ? timeAgo(cart.abandoned_at) : '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1" onClick={e => e.stopPropagation()}>
                        {cart.status === 'abandoned' && cart.customer_email && cart.emails_sent < 3 && (
                          <button
                            onClick={() => sendEmail.mutate(cart.id)}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-primary-600 hover:bg-primary-50 transition-colors"
                            title="Send recovery email"
                          >
                            <EnvelopeIcon className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          onClick={() => deleteCart.mutate(cart.id)}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                          title="Delete"
                        >
                          <TrashIcon className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Cart Detail Modal */}
      {selectedCart && (
        <CartDetailModal
          cart={selectedCart}
          onClose={() => setSelectedCart(null)}
          onSendEmail={() => sendEmail.mutate(selectedCart.id)}
          onDelete={() => {
            deleteCart.mutate(selectedCart.id);
            setSelectedCart(null);
          }}
          sendingEmail={sendEmail.isPending}
        />
      )}
    </>
  );
};

// ── Analytics Tab ─────────────────────────────────────────────
const AnalyticsTab = () => {
  const [days, setDays] = useState(30);
  const { data: stats } = useAbandonedCartStats({ days });
  const { data: analytics, isLoading } = useAbandonedCartAnalytics({ days });

  if (isLoading) return <LoadingSpinner />;

  const emailStats = stats?.email_stats || [];
  const maxSent = Math.max(...emailStats.map(e => e.sent), 1);
  const topProducts = analytics?.top_products || [];

  return (
    <div className="space-y-6">
      {/* Period selector */}
      <div className="flex items-center gap-2">
        {[7, 30, 90].map((d) => (
          <button
            key={d}
            onClick={() => setDays(d)}
            className={`px-3 py-1.5 text-sm rounded-lg font-medium transition-colors ${
              days === d ? 'bg-primary-50 text-primary-700' : 'text-gray-500 hover:bg-gray-100'
            }`}
          >
            {d}d
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Email Funnel */}
        <Card>
          <CardBody>
            <h3 className="font-semibold text-gray-900 mb-4">Email Recovery Funnel</h3>
            {emailStats.length > 0 ? (
              <div className="space-y-6">
                {emailStats.map((step) => (
                  <div key={step.step} className="space-y-2">
                    <p className="text-sm font-medium text-gray-700">
                      Email {step.step}
                      {step.step === 1 && ' — Reminder'}
                      {step.step === 2 && ' — Discount'}
                      {step.step === 3 && ' — Last Chance'}
                    </p>
                    <div className="space-y-1.5">
                      <FunnelBar label="Sent" value={step.sent} max={maxSent} color="bg-gray-400" icon={PaperAirplaneIcon} />
                      <FunnelBar label="Opened" value={step.opened} max={maxSent} color="bg-primary-500" icon={EyeIcon} />
                      <FunnelBar label="Clicked" value={step.clicked} max={maxSent} color="bg-success-500" icon={CursorArrowRaysIcon} />
                    </div>
                    <div className="flex gap-4 text-xs text-gray-400 mt-1">
                      <span>Open rate: {step.open_rate}%</span>
                      <span>Click rate: {step.click_rate}%</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500 text-center py-8">No email data yet</p>
            )}
          </CardBody>
        </Card>

        {/* Top Abandoned Products */}
        <Card>
          <CardBody>
            <h3 className="font-semibold text-gray-900 mb-4">Most Abandoned Products</h3>
            {topProducts.length > 0 ? (
              <div className="space-y-3">
                {topProducts.map((product, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-500">
                      {i + 1}
                    </span>
                    <div className="w-8 h-8 rounded-lg bg-gray-100 overflow-hidden flex-shrink-0">
                      {product.image_url ? (
                        <img src={product.image_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <CubeIcon className="w-4 h-4 text-gray-400" />
                        </div>
                      )}
                    </div>
                    <span className="flex-1 text-sm text-gray-700 truncate">{product.name}</span>
                    <span className="text-sm font-semibold text-gray-900">{product.count}x</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500 text-center py-8">No data yet</p>
            )}
          </CardBody>
        </Card>
      </div>

      {/* Recovery Timeline */}
      <Card>
        <CardBody>
          <h3 className="font-semibold text-gray-900 mb-4">Daily Recovery Overview</h3>
          {(analytics?.abandoned_by_day || []).length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left text-xs font-semibold text-gray-500 uppercase px-3 py-2">Date</th>
                    <th className="text-right text-xs font-semibold text-gray-500 uppercase px-3 py-2">Abandoned</th>
                    <th className="text-right text-xs font-semibold text-gray-500 uppercase px-3 py-2">Value</th>
                    <th className="text-right text-xs font-semibold text-gray-500 uppercase px-3 py-2">Recovered</th>
                    <th className="text-right text-xs font-semibold text-gray-500 uppercase px-3 py-2">Recovered Value</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {(analytics?.abandoned_by_day || []).slice(-14).map((day) => {
                    const recoveredDay = (analytics?.recovered_by_day || []).find(r => r.date === day.date);
                    return (
                      <tr key={day.date} className="text-sm">
                        <td className="px-3 py-2 text-gray-600">{new Date(day.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</td>
                        <td className="px-3 py-2 text-right font-medium text-gray-900">{day.count}</td>
                        <td className="px-3 py-2 text-right text-gray-600">{formatCents(day.value || 0)}</td>
                        <td className="px-3 py-2 text-right font-medium text-success-600">{recoveredDay?.count || 0}</td>
                        <td className="px-3 py-2 text-right text-success-600">{formatCents(recoveredDay?.value || 0)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-gray-500 text-center py-8">No data yet — recovery metrics will appear after carts are tracked.</p>
          )}
        </CardBody>
      </Card>
    </div>
  );
};

// ── Settings Tab ──────────────────────────────────────────────
const SettingsTab = () => {
  const { data: settings, isLoading } = useAbandonedCartSettings();
  const updateSettings = useUpdateAbandonedCartSettings();
  const sendTest = useSendTestRecoveryEmail();
  const [form, setForm] = useState(null);

  // Initialize form from settings
  if (settings && !form) {
    setForm({ ...settings });
  }

  if (isLoading || !form) return <LoadingSpinner />;

  const update = (key, value) => setForm(prev => ({ ...prev, [key]: value }));

  const handleSubmit = (e) => {
    e.preventDefault();
    updateSettings.mutate(form);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Master toggle */}
      <Card>
        <CardBody>
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-gray-900">Abandoned Cart Recovery</h3>
              <p className="text-sm text-gray-500 mt-1">
                Automatically send recovery emails to customers who abandon their carts
              </p>
            </div>
            <Toggle
              checked={!!form.enabled}
              onChange={(val) => update('enabled', val ? 1 : 0)}
            />
          </div>
        </CardBody>
      </Card>

      {/* Timing */}
      <Card>
        <CardBody>
          <h3 className="font-semibold text-gray-900 mb-4">Timing</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Abandonment timeout
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="15"
                  max="720"
                  value={form.abandonment_timeout}
                  onChange={(e) => update('abandonment_timeout', parseInt(e.target.value) || 60)}
                  className="w-24 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
                <span className="text-sm text-gray-500">minutes</span>
              </div>
              <p className="text-xs text-gray-400 mt-1">How long before a cart is marked as abandoned</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Cart expiry
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="1"
                  max="365"
                  value={form.cart_expiry_days}
                  onChange={(e) => update('cart_expiry_days', parseInt(e.target.value) || 30)}
                  className="w-24 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
                <span className="text-sm text-gray-500">days</span>
              </div>
              <p className="text-xs text-gray-400 mt-1">Auto-delete old abandoned carts after this period</p>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Email 1 */}
      <EmailSettingsCard
        step={1}
        title="Email 1 — Gentle Reminder"
        description="Sent shortly after cart abandonment"
        icon={<ClockIcon className="w-5 h-5 text-primary-600" />}
        enabled={!!form.email1_enabled}
        onToggle={(val) => update('email1_enabled', val ? 1 : 0)}
        delay={form.email1_delay}
        onDelayChange={(val) => update('email1_delay', val)}
        delayLabel="minutes after abandonment"
        subject={form.email1_subject}
        onSubjectChange={(val) => update('email1_subject', val)}
      />

      {/* Email 2 */}
      <EmailSettingsCard
        step={2}
        title="Email 2 — Discount Incentive"
        description="Includes an auto-generated discount code"
        icon={<CurrencyDollarIcon className="w-5 h-5 text-success-600" />}
        enabled={!!form.email2_enabled}
        onToggle={(val) => update('email2_enabled', val ? 1 : 0)}
        delay={form.email2_delay}
        onDelayChange={(val) => update('email2_delay', val)}
        delayLabel="minutes after abandonment"
        subject={form.email2_subject}
        onSubjectChange={(val) => update('email2_subject', val)}
        discountPct={form.email2_discount_pct}
        onDiscountChange={(val) => update('email2_discount_pct', val)}
      />

      {/* Email 3 */}
      <EmailSettingsCard
        step={3}
        title="Email 3 — Last Chance"
        description="Final reminder with stronger incentive"
        icon={<XCircleIcon className="w-5 h-5 text-warning-600" />}
        enabled={!!form.email3_enabled}
        onToggle={(val) => update('email3_enabled', val ? 1 : 0)}
        delay={form.email3_delay}
        onDelayChange={(val) => update('email3_delay', val)}
        delayLabel="minutes after abandonment"
        subject={form.email3_subject}
        onSubjectChange={(val) => update('email3_subject', val)}
        discountPct={form.email3_discount_pct}
        onDiscountChange={(val) => update('email3_discount_pct', val)}
      />

      {/* Actions */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => sendTest.mutate()}
          disabled={sendTest.isPending}
          className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-800 transition-colors"
        >
          <BeakerIcon className="w-4 h-4" />
          {sendTest.isPending ? 'Sending...' : 'Send Test Email'}
        </button>
        <Button type="submit" loading={updateSettings.isPending}>
          Save Settings
        </Button>
      </div>
    </form>
  );
};

// ── Email settings card (reusable) ────────────────────────────
const EmailSettingsCard = ({
  step, title, description, icon,
  enabled, onToggle,
  delay, onDelayChange, delayLabel,
  subject, onSubjectChange,
  discountPct, onDiscountChange,
}) => (
  <Card>
    <CardBody>
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-gray-50">{icon}</div>
          <div>
            <h3 className="font-semibold text-gray-900">{title}</h3>
            <p className="text-sm text-gray-500">{description}</p>
          </div>
        </div>
        <Toggle checked={enabled} onChange={onToggle} />
      </div>

      {enabled && (
        <div className="space-y-4 pt-4 border-t border-gray-100">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Subject line</label>
            <input
              type="text"
              value={subject}
              onChange={(e) => onSubjectChange(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
          </div>
          <div className="flex items-center gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Send delay</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="15"
                  value={delay}
                  onChange={(e) => onDelayChange(parseInt(e.target.value) || delay)}
                  className="w-24 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
                <span className="text-xs text-gray-500">{delayLabel}</span>
              </div>
            </div>
            {discountPct !== undefined && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Discount</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={discountPct}
                    onChange={(e) => onDiscountChange(parseInt(e.target.value) || 0)}
                    className="w-20 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                  <span className="text-xs text-gray-500">% off</span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </CardBody>
  </Card>
);

// ── Time ago helper ───────────────────────────────────────────
function timeAgo(dateStr) {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

// ── Main Page ─────────────────────────────────────────────────
function AbandonedCartsPage() {
  const [activeTab, setActiveTab] = useState('carts');

  return (
    <div className="max-w-7xl mx-auto px-4 py-4 sm:p-6">
      <PageHeader
        title="Abandoned Carts"
        subtitle="Recover lost sales with automated email sequences"
      />

      {/* Tabs */}
      <div className="flex items-center gap-1 mb-6 bg-gray-100 rounded-lg p-1 w-fit">
        <Tab active={activeTab === 'carts'} onClick={() => setActiveTab('carts')}>
          Carts
        </Tab>
        <Tab active={activeTab === 'analytics'} onClick={() => setActiveTab('analytics')}>
          Analytics
        </Tab>
        <Tab active={activeTab === 'settings'} onClick={() => setActiveTab('settings')}>
          Settings
        </Tab>
      </div>

      {/* Tab content */}
      {activeTab === 'carts' && <CartsTab />}
      {activeTab === 'analytics' && <AnalyticsTab />}
      {activeTab === 'settings' && <SettingsTab />}
    </div>
  );
}

export default AbandonedCartsPage;
