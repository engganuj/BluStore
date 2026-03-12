import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCreateCustomer, useAddCustomerNote } from '../hooks/useAPI';
import {
  Card,
  CardHeader,
  CardBody,
  Button,
  Input,
  Select,
} from '../components/shared';
import {
  ArrowLeftIcon,
  UserIcon,
  MapPinIcon,
  TagIcon,
  PencilSquareIcon,
  XMarkIcon,
  ExclamationCircleIcon,
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

// ── Country options (most common first) ────────────────────────
const COUNTRY_OPTIONS = [
  { value: 'US', label: 'United States' },
  { value: 'CA', label: 'Canada' },
  { value: 'GB', label: 'United Kingdom' },
  { value: 'AU', label: 'Australia' },
  { value: 'DE', label: 'Germany' },
  { value: 'FR', label: 'France' },
  { value: 'NL', label: 'Netherlands' },
  { value: 'ES', label: 'Spain' },
  { value: 'IT', label: 'Italy' },
  { value: 'JP', label: 'Japan' },
  { value: 'BR', label: 'Brazil' },
  { value: 'MX', label: 'Mexico' },
  { value: 'IN', label: 'India' },
  { value: 'NZ', label: 'New Zealand' },
  { value: 'SE', label: 'Sweden' },
  { value: 'NO', label: 'Norway' },
  { value: 'DK', label: 'Denmark' },
  { value: 'FI', label: 'Finland' },
  { value: 'IE', label: 'Ireland' },
  { value: 'SG', label: 'Singapore' },
];

// ── Validation helpers ─────────────────────────────────────────
const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

// ── Main Page ──────────────────────────────────────────────────
function CreateCustomerPage() {
  const navigate = useNavigate();
  const createCustomer = useCreateCustomer();
  const addNote = useAddCustomerNote();

  // Contact
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');

  // Address
  const [addressLine1, setAddressLine1] = useState('');
  const [addressLine2, setAddressLine2] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [country, setCountry] = useState('US');

  // Tags
  const [tags, setTags] = useState([]);
  const [tagInput, setTagInput] = useState('');

  // Notes
  const [note, setNote] = useState('');

  // Validation
  const emailValid = email.trim() && isValidEmail(email);
  const canSubmit = emailValid;

  // ── Tag management ───────────────────────────────────────
  const addTag = () => {
    const tag = tagInput.trim().toLowerCase();
    if (!tag || tags.includes(tag)) return;
    setTags((prev) => [...prev, tag]);
    setTagInput('');
  };

  const removeTag = (tagToRemove) => {
    setTags((prev) => prev.filter((t) => t !== tagToRemove));
  };

  // ── Submit ───────────────────────────────────────────────
  const handleSubmit = () => {
    if (!canSubmit) return;

    const payload = {
      email: email.trim(),
      first_name: firstName.trim() || null,
      last_name: lastName.trim() || null,
      phone: phone.trim() || null,
      address_line1: addressLine1.trim() || null,
      address_line2: addressLine2.trim() || null,
      city: city.trim() || null,
      state: state.trim() || null,
      postal_code: postalCode.trim() || null,
      country: country || 'US',
      tags: tags.length > 0 ? tags : undefined,
    };

    createCustomer.mutate(payload, {
      onSuccess: (response) => {
        const customerId = response?.data?.customer?.id || response?.customer?.id;

        // If a note was entered, add it as a follow-up call
        if (customerId && note.trim()) {
          addNote.mutate(
            { id: customerId, text: note.trim() },
            { onSettled: () => navigate(`/customers/${customerId}`) }
          );
        } else if (customerId) {
          navigate(`/customers/${customerId}`);
        } else {
          navigate('/customers');
        }
      },
      onError: (err) => {
        const msg = err?.response?.data?.message || err?.message || 'Failed to create customer';
        toast.error(msg);
      },
    });
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-4 sm:p-6">
      {/* Header */}
      <div className="mb-8">
        <button
          onClick={() => navigate('/customers')}
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors mb-4"
        >
          <ArrowLeftIcon className="w-4 h-4" />
          Customers
        </button>
        <h1 className="text-2xl font-bold text-gray-900">Add Customer</h1>
        <p className="text-gray-500 mt-1">Create a new customer profile for your store</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* ── Left Column (2/3) ─────────────────────────────── */}
        <div className="lg:col-span-2 space-y-6">

          {/* Contact Information */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <UserIcon className="w-4 h-4 text-gray-500" />
                <h2 className="text-sm font-semibold text-gray-900">Contact Information</h2>
              </div>
            </CardHeader>
            <CardBody>
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Input
                    label="First Name"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="John"
                  />
                  <Input
                    label="Last Name"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="Doe"
                  />
                </div>
                <Input
                  label="Email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="customer@example.com"
                  error={email && !emailValid ? 'Please enter a valid email address' : undefined}
                />
                <Input
                  label="Phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+1 (555) 123-4567"
                />
              </div>
            </CardBody>
          </Card>

          {/* Address */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <MapPinIcon className="w-4 h-4 text-gray-500" />
                <h2 className="text-sm font-semibold text-gray-900">Address</h2>
              </div>
            </CardHeader>
            <CardBody>
              <div className="space-y-4">
                <Input
                  label="Address Line 1"
                  value={addressLine1}
                  onChange={(e) => setAddressLine1(e.target.value)}
                  placeholder="123 Main St"
                />
                <Input
                  label="Address Line 2"
                  value={addressLine2}
                  onChange={(e) => setAddressLine2(e.target.value)}
                  placeholder="Apt, suite, unit, etc. (optional)"
                />
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  <Input
                    label="City"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="San Francisco"
                  />
                  <Input
                    label="State / Province"
                    value={state}
                    onChange={(e) => setState(e.target.value)}
                    placeholder="CA"
                  />
                  <Input
                    label="ZIP / Postal Code"
                    value={postalCode}
                    onChange={(e) => setPostalCode(e.target.value)}
                    placeholder="94102"
                  />
                </div>
                <Select
                  label="Country"
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  options={COUNTRY_OPTIONS}
                />
              </div>
            </CardBody>
          </Card>

        </div>

        {/* ── Right Column (1/3) ────────────────────────────── */}
        <div className="space-y-6">

          {/* Tags */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <TagIcon className="w-4 h-4 text-gray-500" />
                <h2 className="text-sm font-semibold text-gray-900">Tags</h2>
              </div>
            </CardHeader>
            <CardBody>
              {tags.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-4">
                  {tags.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-primary-50 text-primary-700"
                    >
                      {tag}
                      <button
                        type="button"
                        onClick={() => removeTag(tag)}
                        className="hover:text-primary-900 transition-colors"
                      >
                        <XMarkIcon className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
              <div className="flex gap-2">
                <Input
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addTag();
                    }
                  }}
                  placeholder="e.g. vip, wholesale, newsletter"
                  className="!mb-0"
                />
                <Button
                  variant="secondary"
                  onClick={addTag}
                  disabled={!tagInput.trim()}
                  className="flex-shrink-0"
                >
                  Add
                </Button>
              </div>
              <p className="text-xs text-gray-400 mt-2">Press Enter or click Add. Tags help you segment and filter customers.</p>
            </CardBody>
          </Card>

          {/* Notes */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <PencilSquareIcon className="w-4 h-4 text-gray-500" />
                <h2 className="text-sm font-semibold text-gray-900">Internal Note</h2>
                <span className="text-xs text-gray-400 font-normal">(optional)</span>
              </div>
            </CardHeader>
            <CardBody>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Add any internal notes about this customer..."
                rows={4}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none transition-all duration-150 ease-in-out"
              />
              <p className="text-xs text-gray-400 mt-1.5">Only visible to your team, not the customer.</p>
            </CardBody>
          </Card>

          {/* Submit */}
          <Button
            onClick={handleSubmit}
            loading={createCustomer.isPending}
            disabled={!canSubmit}
            className="w-full"
            size="lg"
          >
            Create Customer
          </Button>

          {!canSubmit && (
            <div className="flex items-start gap-2 text-xs text-gray-400">
              <ExclamationCircleIcon className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>A valid email address is required to create a customer.</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default CreateCustomerPage;
