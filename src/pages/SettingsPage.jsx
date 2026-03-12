import { useState, useEffect } from 'react';
import {
  useStore,
  useUpdateStore,
} from '../hooks/useAPI';
import {
  PageHeader,
  Card,
  CardBody,
  Button,
  Input,
  Select,
  LoadingSpinner,
} from '../components/shared';

// ── Country / Currency options ────────────────────────────────
const COUNTRY_OPTIONS = [
  { value: 'US', label: 'United States' },
  { value: 'CA', label: 'Canada' },
  { value: 'GB', label: 'United Kingdom' },
  { value: 'AU', label: 'Australia' },
  { value: 'DE', label: 'Germany' },
  { value: 'FR', label: 'France' },
  { value: 'NL', label: 'Netherlands' },
  { value: 'IE', label: 'Ireland' },
  { value: 'NZ', label: 'New Zealand' },
  { value: 'SG', label: 'Singapore' },
  { value: 'JP', label: 'Japan' },
  { value: 'SE', label: 'Sweden' },
  { value: 'NO', label: 'Norway' },
  { value: 'DK', label: 'Denmark' },
  { value: 'FI', label: 'Finland' },
  { value: 'AT', label: 'Austria' },
  { value: 'BE', label: 'Belgium' },
  { value: 'CH', label: 'Switzerland' },
  { value: 'ES', label: 'Spain' },
  { value: 'IT', label: 'Italy' },
  { value: 'PT', label: 'Portugal' },
  { value: 'MX', label: 'Mexico' },
  { value: 'BR', label: 'Brazil' },
  { value: 'IN', label: 'India' },
];

const CURRENCY_OPTIONS = [
  { value: 'USD', label: 'USD ($)' },
  { value: 'CAD', label: 'CAD ($)' },
  { value: 'GBP', label: 'GBP (£)' },
  { value: 'EUR', label: 'EUR (€)' },
  { value: 'AUD', label: 'AUD ($)' },
  { value: 'NZD', label: 'NZD ($)' },
  { value: 'SGD', label: 'SGD ($)' },
  { value: 'JPY', label: 'JPY (¥)' },
  { value: 'SEK', label: 'SEK (kr)' },
  { value: 'NOK', label: 'NOK (kr)' },
  { value: 'DKK', label: 'DKK (kr)' },
  { value: 'CHF', label: 'CHF (Fr)' },
  { value: 'MXN', label: 'MXN ($)' },
  { value: 'BRL', label: 'BRL (R$)' },
  { value: 'INR', label: 'INR (₹)' },
];

const TEMPLATE_OPTIONS = [
  { id: 'minimal', name: 'Minimal', desc: 'Clean, single column', icon: '◻️' },
  { id: 'modern', name: 'Modern', desc: 'Two column with zoom', icon: '▣' },
  { id: 'editorial', name: 'Editorial', desc: 'Stacked images, magazine style', icon: '▤' },
  { id: 'luxury', name: 'Luxury', desc: 'Split screen, premium feel', icon: '◧' },
  { id: 'bold', name: 'Bold', desc: 'Grid gallery, vibrant', icon: '▦' },
  { id: 'showcase', name: 'Showcase', desc: 'Full-width stacked', icon: '▥' },
];

// ── Main Page ─────────────────────────────────────────────────
function SettingsPage() {
  const { data: store, isLoading } = useStore();
  const updateStore = useUpdateStore();

  const [formData, setFormData] = useState({
    support_email: '',
    currency: 'USD',
    address_line1: '',
    address_line2: '',
    city: '',
    state: '',
    postal_code: '',
    country: 'US',
    phone: '',
    pdp_template: 'modern',
  });

  // Populate form when store data loads
  useEffect(() => {
    if (store) {
      setFormData({
        support_email: store.support_email || '',
        currency: store.currency || 'USD',
        address_line1: store.address_line1 || '',
        address_line2: store.address_line2 || '',
        city: store.city || '',
        state: store.state || '',
        postal_code: store.postal_code || '',
        country: store.country || 'US',
        phone: store.phone || '',
        pdp_template: store.pdp_template || 'modern',
      });
    }
  }, [store]);

  const update = (key, value) => setFormData((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = (e) => {
    e.preventDefault();
    updateStore.mutate(formData);
  };

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-4 sm:p-6">
        <div className="flex items-center justify-center py-20">
          <LoadingSpinner />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-4 sm:p-6">
      <PageHeader
        title="Store Settings"
        subtitle="Manage your store information and preferences"
      />

      <div className="space-y-8">
        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Contact Information */}
          <Card>
            <CardBody>
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Contact Information</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  label="Support Email"
                  type="email"
                  value={formData.support_email}
                  onChange={(e) => update('support_email', e.target.value)}
                  placeholder="support@yourstore.com"
                />
                <Input
                  label="Phone"
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => update('phone', e.target.value)}
                  placeholder="+1 (555) 000-0000"
                />
              </div>
            </CardBody>
          </Card>

          {/* Business Address */}
          <Card>
            <CardBody>
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Business Address</h2>
              <div className="space-y-4">
                <Input
                  label="Address Line 1"
                  value={formData.address_line1}
                  onChange={(e) => update('address_line1', e.target.value)}
                  placeholder="123 Main Street"
                />
                <Input
                  label="Address Line 2"
                  value={formData.address_line2}
                  onChange={(e) => update('address_line2', e.target.value)}
                  placeholder="Suite 100"
                />
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="col-span-2 md:col-span-1">
                    <Input
                      label="City"
                      value={formData.city}
                      onChange={(e) => update('city', e.target.value)}
                    />
                  </div>
                  <Input
                    label="State"
                    value={formData.state}
                    onChange={(e) => update('state', e.target.value)}
                  />
                  <Input
                    label="Postal Code"
                    value={formData.postal_code}
                    onChange={(e) => update('postal_code', e.target.value)}
                  />
                  <Select
                    label="Country"
                    value={formData.country}
                    onChange={(e) => update('country', e.target.value)}
                    options={COUNTRY_OPTIONS}
                  />
                </div>
              </div>
            </CardBody>
          </Card>

          {/* Currency */}
          <Card>
            <CardBody>
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Currency</h2>
              <div className="max-w-xs">
                <Select
                  label="Store Currency"
                  value={formData.currency}
                  onChange={(e) => update('currency', e.target.value)}
                  options={CURRENCY_OPTIONS}
                />
              </div>
            </CardBody>
          </Card>

          {/* Product Page Template */}
          <Card>
            <CardBody>
              <h2 className="text-lg font-semibold text-gray-900 mb-2">
                Product Page Template
              </h2>
              <p className="text-sm text-gray-500 mb-4">
                Choose how your product pages look on your storefront
              </p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {TEMPLATE_OPTIONS.map((template) => (
                  <button
                    key={template.id}
                    type="button"
                    onClick={() => update('pdp_template', template.id)}
                    className={`p-4 border-2 rounded-xl text-left transition-all ${
                      formData.pdp_template === template.id
                        ? 'border-primary-500 bg-primary-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <span className="text-2xl mb-2 block">{template.icon}</span>
                    <p className="font-medium text-gray-900">{template.name}</p>
                    <p className="text-xs text-gray-500">{template.desc}</p>
                  </button>
                ))}
              </div>
            </CardBody>
          </Card>

          {/* Save */}
          <div className="flex justify-end">
            <Button type="submit" loading={updateStore.isPending}>
              Save Changes
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default SettingsPage;
