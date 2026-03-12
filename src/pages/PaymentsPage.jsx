import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  useStripeStatus,
  useStripeConnect,
  useStripeOnboarding,
  useStripeDisconnect,
  useTaxSettings,
  useUpdateTaxSettings,
} from '../hooks/useAPI';
import {
  PageHeader,
  Card,
  CardHeader,
  CardBody,
  Button,
  Input,
  LoadingSpinner,
} from '../components/shared';
import toast from 'react-hot-toast';

// ── Payment Processing (Stripe) ──────────────────────────────
const PaymentProcessingSection = () => {
  const { data: stripeStatus, isLoading } = useStripeStatus();
  const connectStripe = useStripeConnect();
  const completeOnboarding = useStripeOnboarding();
  const disconnectStripe = useStripeDisconnect();
  const [showDisconnectConfirm, setShowDisconnectConfirm] = useState(false);

  const handleDisconnect = () => {
    disconnectStripe.mutate();
    setShowDisconnectConfirm(false);
  };

  const needsOnboarding =
    stripeStatus?.connected &&
    stripeStatus?.account_details &&
    (!stripeStatus.account_details.charges_enabled ||
      !stripeStatus.account_details.payouts_enabled);

  const isConnected = stripeStatus?.connected && !needsOnboarding;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Payment Processing</h2>
            <p className="text-sm text-gray-500 mt-0.5">Accept payments through Stripe</p>
          </div>
          {!isLoading && (
            <span
              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                isConnected
                  ? 'bg-success-100 text-success-800'
                  : needsOnboarding
                  ? 'bg-warning-100 text-warning-800'
                  : 'bg-gray-100 text-gray-800'
              }`}
            >
              {isConnected ? 'Connected' : needsOnboarding ? 'Setup Incomplete' : 'Not Connected'}
            </span>
          )}
        </div>
      </CardHeader>
      <CardBody>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <LoadingSpinner />
          </div>
        ) : stripeStatus?.connected ? (
          <div className="space-y-4">
            {/* Connected State */}
            <div
              className={`flex items-center gap-3 p-4 border rounded-lg ${
                needsOnboarding
                  ? 'bg-warning-50 border-warning-200'
                  : 'bg-success-50 border-success-200'
              }`}
            >
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center ${
                  needsOnboarding ? 'bg-warning-100' : 'bg-success-100'
                }`}
              >
                {needsOnboarding ? (
                  <svg className="w-6 h-6 text-warning-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                ) : (
                  <svg className="w-6 h-6 text-success-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </div>
              <div className="flex-1">
                <p className={`font-medium ${needsOnboarding ? 'text-warning-800' : 'text-success-800'}`}>
                  {needsOnboarding ? 'Stripe Setup Incomplete' : 'Stripe Connected'}
                </p>
                <p className={`text-sm ${needsOnboarding ? 'text-warning-600' : 'text-success-600'}`}>
                  Account: {stripeStatus.account_id}
                </p>
              </div>
            </div>

            {/* Complete Setup Button */}
            {needsOnboarding && (
              <Button
                onClick={() => completeOnboarding.mutate()}
                loading={completeOnboarding.isPending}
                className="w-full !bg-warning-500 hover:!bg-warning-600"
              >
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Complete Stripe Setup
              </Button>
            )}

            {/* Account Details */}
            {stripeStatus.account_details && (
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-gray-500">Charges</p>
                  <p className={`font-medium ${stripeStatus.account_details.charges_enabled ? 'text-success-600' : 'text-red-600'}`}>
                    {stripeStatus.account_details.charges_enabled ? 'Enabled' : 'Disabled'}
                  </p>
                </div>
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-gray-500">Payouts</p>
                  <p className={`font-medium ${stripeStatus.account_details.payouts_enabled ? 'text-success-600' : 'text-red-600'}`}>
                    {stripeStatus.account_details.payouts_enabled ? 'Enabled' : 'Disabled'}
                  </p>
                </div>
              </div>
            )}

            {/* Disconnect */}
            {showDisconnectConfirm ? (
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-800 mb-3">
                  Are you sure? You won't be able to accept payments until you reconnect.
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={handleDisconnect}
                    loading={disconnectStripe.isPending}
                  >
                    Yes, Disconnect
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setShowDisconnectConfirm(false)}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setShowDisconnectConfirm(true)}
                className="text-sm text-red-600 hover:text-red-700 font-medium"
              >
                Disconnect Stripe Account
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {/* Not Connected State */}
            <div className="flex items-center gap-3 p-4 bg-gray-50 border border-gray-200 rounded-lg">
              <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center">
                <svg className="w-6 h-6 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                </svg>
              </div>
              <div className="flex-1">
                <p className="font-medium text-gray-900">Connect Your Stripe Account</p>
                <p className="text-sm text-gray-500">
                  Accept credit cards, Apple Pay, Google Pay, and more
                </p>
              </div>
            </div>

            <button
              onClick={() => connectStripe.mutate()}
              disabled={connectStripe.isPending}
              className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-[#635BFF] text-white rounded-lg font-medium hover:bg-[#5851ea] disabled:opacity-50 transition-colors"
            >
              {connectStripe.isPending ? (
                'Connecting...'
              ) : (
                <>
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M13.976 9.15c-2.172-.806-3.356-1.426-3.356-2.409 0-.831.683-1.305 1.901-1.305 2.227 0 4.515.858 6.09 1.631l.89-5.494C18.252.975 15.697 0 12.165 0 9.667 0 7.589.654 6.104 1.872 4.56 3.147 3.757 4.992 3.757 7.218c0 4.039 2.467 5.76 6.476 7.219 2.585.92 3.445 1.574 3.445 2.583 0 .98-.84 1.545-2.354 1.545-1.875 0-4.965-.921-6.99-2.109l-.9 5.555C5.175 22.99 8.385 24 11.714 24c2.641 0 4.843-.624 6.328-1.813 1.664-1.305 2.525-3.236 2.525-5.732 0-4.128-2.524-5.851-6.591-7.305z"/>
                  </svg>
                  Connect with Stripe
                </>
              )}
            </button>

            <p className="text-xs text-gray-500 text-center">
              You'll be redirected to Stripe to complete the connection.
            </p>
          </div>
        )}
      </CardBody>
    </Card>
  );
};

// ── Tax Configuration ────────────────────────────────────────
const TaxConfigurationSection = () => {
  const { data: tax, isLoading } = useTaxSettings();
  const updateTax = useUpdateTaxSettings();
  const [localTax, setLocalTax] = useState(null);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (tax && !localTax) {
      setLocalTax(tax);
    }
  }, [tax, localTax]);

  const update = (key, value) => {
    setLocalTax((prev) => ({ ...prev, [key]: value }));
    setDirty(true);
  };

  const handleSave = () => {
    updateTax.mutate(localTax, {
      onSuccess: () => setDirty(false),
    });
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Tax</h2>
            <p className="text-sm text-gray-500 mt-0.5">Configure how tax is calculated on orders</p>
          </div>
          {dirty && (
            <Button size="sm" onClick={handleSave} loading={updateTax.isPending}>
              Save Tax Settings
            </Button>
          )}
        </div>
      </CardHeader>
      <CardBody>
        {isLoading || !localTax ? (
          <div className="flex items-center justify-center py-8">
            <LoadingSpinner />
          </div>
        ) : (
          <div className="space-y-5">
            {/* Enable/Disable */}
            <label className="flex items-center justify-between p-4 bg-gray-50 rounded-lg cursor-pointer">
              <div>
                <p className="font-medium text-gray-900">Charge tax on orders</p>
                <p className="text-sm text-gray-500">Enable tax calculation at checkout</p>
              </div>
              <div
                role="switch"
                aria-checked={localTax.enabled}
                onClick={() => update('enabled', !localTax.enabled)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  localTax.enabled ? 'bg-primary-500' : 'bg-gray-300'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${
                    localTax.enabled ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </div>
            </label>

            {localTax.enabled && (
              <div className="space-y-4 pl-1">
                {/* Tax Rate */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Default Tax Rate (%)
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        max="100"
                        value={localTax.rate}
                        onChange={(e) => update('rate', parseFloat(e.target.value) || 0)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                        placeholder="0.00"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">%</span>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">Applied to all taxable items</p>
                  </div>

                  <Input
                    label="Tax Label"
                    value={localTax.label}
                    onChange={(e) => update('label', e.target.value)}
                    placeholder="Tax"
                  />
                </div>

                {/* Tax Inclusive */}
                <label className="flex items-center justify-between p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50">
                  <div>
                    <p className="text-sm font-medium text-gray-900">Prices include tax</p>
                    <p className="text-xs text-gray-500">Product prices already have tax built in</p>
                  </div>
                  <div
                    role="switch"
                    aria-checked={localTax.inclusive}
                    onClick={() => update('inclusive', !localTax.inclusive)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      localTax.inclusive ? 'bg-primary-500' : 'bg-gray-300'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${
                        localTax.inclusive ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </div>
                </label>

                {/* Tax on Shipping */}
                <label className="flex items-center justify-between p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50">
                  <div>
                    <p className="text-sm font-medium text-gray-900">Charge tax on shipping</p>
                    <p className="text-xs text-gray-500">Apply tax rate to shipping charges</p>
                  </div>
                  <div
                    role="switch"
                    aria-checked={localTax.shipping_taxable}
                    onClick={() => update('shipping_taxable', !localTax.shipping_taxable)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      localTax.shipping_taxable ? 'bg-primary-500' : 'bg-gray-300'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${
                        localTax.shipping_taxable ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </div>
                </label>

                <p className="text-xs text-gray-400">
                  These settings sync to WooCommerce automatically. For advanced tax rules (per-state rates, tax classes), use WooCommerce tax settings.
                </p>
              </div>
            )}
          </div>
        )}
      </CardBody>
    </Card>
  );
};

// ── Main Page ────────────────────────────────────────────────
function PaymentsPage() {
  const [searchParams, setSearchParams] = useSearchParams();

  // Handle Stripe OAuth callback messages
  useEffect(() => {
    const stripeSuccess = searchParams.get('stripe_success');
    const stripeError = searchParams.get('stripe_error');
    const stripeOnboarding = searchParams.get('stripe_onboarding');
    const stripeRefresh = searchParams.get('stripe_refresh');

    if (stripeSuccess) {
      toast.success('Stripe account connected successfully!');
      searchParams.delete('stripe_success');
      setSearchParams(searchParams);
    }
    if (stripeError) {
      toast.error(`Stripe connection failed: ${stripeError}`);
      searchParams.delete('stripe_error');
      setSearchParams(searchParams);
    }
    if (stripeOnboarding === 'complete') {
      toast.success('Stripe setup completed!');
      searchParams.delete('stripe_onboarding');
      setSearchParams(searchParams);
    }
    if (stripeRefresh) {
      toast('Please complete Stripe setup to accept payments', { icon: '⚠️' });
      searchParams.delete('stripe_refresh');
      setSearchParams(searchParams);
    }
  }, [searchParams, setSearchParams]);

  return (
    <div className="max-w-4xl mx-auto px-4 py-4 sm:p-6">
      <PageHeader
        title="Payments"
        subtitle="Manage payment processing and tax configuration"
      />

      <div className="space-y-8">
        <PaymentProcessingSection />
        <TaxConfigurationSection />
      </div>
    </div>
  );
}

export default PaymentsPage;
