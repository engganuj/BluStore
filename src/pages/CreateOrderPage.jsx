import { useState, useMemo, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProducts, useCustomers, useCreateOrder } from '../hooks/useAPI';
import {
  PageHeader,
  Card,
  CardHeader,
  CardBody,
  CardFooter,
  Button,
  Input,
  Select,
  Badge,
  LoadingSpinner,
} from '../components/shared';
import { formatCents, formatCurrency } from '../utils/helpers';
import {
  ArrowLeftIcon,
  MagnifyingGlassIcon,
  PlusIcon,
  TrashIcon,
  UserIcon,
  ShoppingBagIcon,
  XMarkIcon,
  ChevronDownIcon,
  ChevronUpIcon,
} from '@heroicons/react/24/outline';
import { SEARCH_ICON_CLASS, SEARCH_ICON_GLYPH_CLASS, SEARCH_INPUT_CLASS } from '../components/shared/SearchBar';

// ── Constants ─────────────────────────────────────────────────
const STATUS_OPTIONS = [
  { value: 'pending', label: 'Pending' },
  { value: 'paid', label: 'Paid' },
  { value: 'processing', label: 'Processing' },
];

// ── Combobox Dropdown ─────────────────────────────────────────
// Reusable search dropdown used by both customer and product pickers
const SearchDropdown = ({ query, setQuery, placeholder, results, onSelect, renderItem, emptyText, isLoading, inputRef }) => {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef();

  useEffect(() => {
    const handleClick = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <div className="relative" ref={wrapperRef}>
      <div className="relative">
        <div className={SEARCH_ICON_CLASS}>
          <MagnifyingGlassIcon className={SEARCH_ICON_GLYPH_CLASS} />
        </div>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder={placeholder}
          className={SEARCH_INPUT_CLASS}
        />
      </div>
      {open && query.length >= 1 && (
        <div className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-64 overflow-y-auto">
          {isLoading ? (
            <div className="px-4 py-6 text-center">
              <LoadingSpinner />
            </div>
          ) : results.length === 0 ? (
            <div className="px-4 py-4 text-sm text-gray-500 text-center">{emptyText}</div>
          ) : (
            results.map((item, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => { onSelect(item); setOpen(false); setQuery(''); }}
                className="w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-b-0"
              >
                {renderItem(item)}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
};

// ── Customer Picker ───────────────────────────────────────────
const CustomerPicker = ({ customer, setCustomer }) => {
  const [mode, setMode] = useState(customer ? 'selected' : 'search'); // search | guest | selected
  const [searchQuery, setSearchQuery] = useState('');
  const { data: customersData, isLoading: customersLoading } = useCustomers(
    searchQuery.length >= 2 ? { search: searchQuery } : {}
  );

  const customers = customersData?.customers || [];
  const filtered = searchQuery.length >= 2
    ? customers.filter((c) => {
        const q = searchQuery.toLowerCase();
        return c.customer_email?.toLowerCase().includes(q) || c.customer_name?.toLowerCase().includes(q);
      })
    : [];

  const handleSelectCustomer = (c) => {
    setCustomer({
      customer_email: c.customer_email,
      customer_name: c.customer_name,
      isExisting: true,
    });
    setMode('selected');
  };

  const handleGuestChange = (field, value) => {
    setCustomer((prev) => ({ ...prev, [field]: value, isExisting: false }));
  };

  if (mode === 'selected' && customer) {
    return (
      <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-primary-100 flex items-center justify-center">
            <UserIcon className="w-4 h-4 text-primary-700" />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-900">{customer.customer_name || 'Guest'}</p>
            <p className="text-sm text-gray-500">{customer.customer_email}</p>
          </div>
          {customer.isExisting && <Badge variant="primary" size="sm">Existing</Badge>}
        </div>
        <button
          type="button"
          onClick={() => { setCustomer(null); setMode('search'); }}
          className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-200 rounded-lg transition-colors"
        >
          <XMarkIcon className="w-4 h-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {mode === 'search' && (
        <>
          <SearchDropdown
            query={searchQuery}
            setQuery={setSearchQuery}
            placeholder="Search existing customers by name or email..."
            results={filtered.slice(0, 8)}
            onSelect={handleSelectCustomer}
            isLoading={customersLoading && searchQuery.length >= 2}
            emptyText="No matching customers found"
            renderItem={(c) => (
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                  <UserIcon className="w-4 h-4 text-gray-500" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{c.customer_name || 'Guest'}</p>
                  <p className="text-xs text-gray-500 truncate">{c.customer_email} · {c.order_count} order{c.order_count !== 1 ? 's' : ''}</p>
                </div>
              </div>
            )}
          />
          <div className="flex items-center gap-3">
            <div className="flex-1 border-t border-gray-200" />
            <span className="text-xs text-gray-400 uppercase font-medium">or</span>
            <div className="flex-1 border-t border-gray-200" />
          </div>
          <Button
            variant="secondary"
            size="sm"
            className="w-full"
            icon={<PlusIcon className="w-4 h-4" />}
            onClick={() => {
              setMode('guest');
              setCustomer({ customer_name: '', customer_email: '', isExisting: false });
            }}
          >
            Add guest customer
          </Button>
        </>
      )}

      {mode === 'guest' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-gray-700">Guest customer details</p>
            <button
              type="button"
              onClick={() => { setCustomer(null); setMode('search'); }}
              className="text-xs text-gray-500 hover:text-gray-700"
            >
              ← Search instead
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Name"
              value={customer?.customer_name || ''}
              onChange={(e) => handleGuestChange('customer_name', e.target.value)}
              placeholder="Customer name"
            />
            <Input
              label="Email"
              type="email"
              required
              value={customer?.customer_email || ''}
              onChange={(e) => handleGuestChange('customer_email', e.target.value)}
              placeholder="customer@example.com"
            />
          </div>
        </div>
      )}
    </div>
  );
};

// ── Product Picker ────────────────────────────────────────────
const ProductPicker = ({ items, setItems }) => {
  const [searchQuery, setSearchQuery] = useState('');
  // Fetch a large page of products for the typeahead picker
  const { data: productsData, isLoading: productsLoading } = useProducts({ limit: 500 });
  const allProducts = productsData?.products || [];

  // Filter products matching search, exclude already-added
  const addedIds = new Set(items.map((i) => i.product_id));
  const filtered = useMemo(() => {
    if (searchQuery.length < 1) return [];
    const q = searchQuery.toLowerCase();
    return allProducts
      .filter((p) =>
        !addedIds.has(p.id) && (
          p.name?.toLowerCase().includes(q) ||
          p.sku?.toLowerCase().includes(q)
        )
      )
      .slice(0, 8);
  }, [searchQuery, allProducts, addedIds]);

  const handleAddProduct = (product) => {
    const priceCents = Math.round((parseFloat(product.price) || 0) * 100);
    setItems((prev) => [
      ...prev,
      {
        product_id: product.id,
        product_name: product.name,
        product_sku: product.sku || '',
        product_image: product.images?.[0] || product.image_url || null,
        unit_price_cents: priceCents,
        quantity: 1,
      },
    ]);
  };

  const handleQuantityChange = (index, quantity) => {
    const qty = Math.max(1, parseInt(quantity) || 1);
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, quantity: qty } : item)));
  };

  const handleRemove = (index) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handlePriceChange = (index, dollars) => {
    const cents = Math.round((parseFloat(dollars) || 0) * 100);
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, unit_price_cents: cents } : item)));
  };

  return (
    <div className="space-y-4">
      <SearchDropdown
        query={searchQuery}
        setQuery={setSearchQuery}
        placeholder="Search products by name or SKU..."
        results={filtered}
        onSelect={handleAddProduct}
        isLoading={productsLoading}
        emptyText="No matching products found"
        renderItem={(p) => (
          <div className="flex items-center gap-3">
            {p.images?.[0] || p.image_url ? (
              <img
                src={p.images?.[0] || p.image_url}
                alt={p.name}
                className="w-10 h-10 rounded-lg object-cover border border-gray-200"
              />
            ) : (
              <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center border border-gray-200">
                <ShoppingBagIcon className="w-5 h-5 text-gray-400" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">{p.name}</p>
              <p className="text-xs text-gray-500">
                {p.sku && <span>SKU: {p.sku} · </span>}
                {formatCurrency(p.price)}
                {p.inventory_qty !== null && p.inventory_qty !== undefined && (
                  <span className="ml-1 text-gray-400">({p.inventory_qty} in stock)</span>
                )}
              </p>
            </div>
          </div>
        )}
      />

      {/* Line items */}
      {items.length > 0 && (
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Product</th>
                <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase w-24">Qty</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase w-28">Price</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase w-24">Total</th>
                <th className="w-10" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {items.map((item, idx) => (
                <tr key={idx}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {item.product_image ? (
                        <img src={item.product_image} alt="" className="w-8 h-8 rounded object-cover border border-gray-200" />
                      ) : (
                        <div className="w-8 h-8 rounded bg-gray-100 flex items-center justify-center">
                          <ShoppingBagIcon className="w-4 h-4 text-gray-400" />
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{item.product_name}</p>
                        {item.product_sku && <p className="text-xs text-gray-400">{item.product_sku}</p>}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <input
                      type="number"
                      min="1"
                      value={item.quantity}
                      onChange={(e) => handleQuantityChange(idx, e.target.value)}
                      className="w-16 mx-auto block text-center px-2 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={(item.unit_price_cents / 100).toFixed(2)}
                      onChange={(e) => handlePriceChange(idx, e.target.value)}
                      className="w-24 ml-auto block text-right px-2 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    />
                  </td>
                  <td className="px-4 py-3 text-right text-sm font-medium text-gray-900">
                    {formatCents(item.unit_price_cents * item.quantity)}
                  </td>
                  <td className="px-2 py-3">
                    <button
                      type="button"
                      onClick={() => handleRemove(idx)}
                      className="p-1 text-gray-400 hover:text-red-600 rounded transition-colors"
                    >
                      <TrashIcon className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {items.length === 0 && (
        <div className="text-center py-8 border border-dashed border-gray-300 rounded-lg">
          <ShoppingBagIcon className="w-8 h-8 text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-gray-500">Search and add products above</p>
        </div>
      )}
    </div>
  );
};

// ── Shipping Address ──────────────────────────────────────────
const ShippingAddressForm = ({ address, setAddress }) => {
  const [expanded, setExpanded] = useState(false);

  const handleChange = (field, value) => {
    setAddress((prev) => ({ ...prev, [field]: value }));
  };

  const hasAddress = address && Object.values(address).some((v) => v);

  return (
    <div>
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 transition-colors w-full justify-between"
      >
        <span className="font-medium">
          Shipping Address {hasAddress && <span className="text-success-600 font-normal">(added)</span>}
        </span>
        {expanded ? <ChevronUpIcon className="w-4 h-4" /> : <ChevronDownIcon className="w-4 h-4" />}
      </button>
      {expanded && (
        <div className="mt-3 space-y-3">
          <Input label="Full name" value={address?.name || ''} onChange={(e) => handleChange('name', e.target.value)} placeholder="Recipient name" />
          <Input label="Address line 1" value={address?.line1 || ''} onChange={(e) => handleChange('line1', e.target.value)} placeholder="123 Main St" />
          <Input label="Address line 2" value={address?.line2 || ''} onChange={(e) => handleChange('line2', e.target.value)} placeholder="Apt, suite, etc." />
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <Input label="City" value={address?.city || ''} onChange={(e) => handleChange('city', e.target.value)} />
            <Input label="State" value={address?.state || ''} onChange={(e) => handleChange('state', e.target.value)} />
            <Input label="ZIP / Postal" value={address?.postal_code || ''} onChange={(e) => handleChange('postal_code', e.target.value)} />
          </div>
          <Input label="Country" value={address?.country || ''} onChange={(e) => handleChange('country', e.target.value)} placeholder="US" />
        </div>
      )}
    </div>
  );
};

// ── Main Page ─────────────────────────────────────────────────
function CreateOrderPage() {
  const navigate = useNavigate();
  const createOrder = useCreateOrder();

  const [customer, setCustomer] = useState(null);
  const [items, setItems] = useState([]);
  const [status, setStatus] = useState('paid');
  const [shippingAddress, setShippingAddress] = useState({});
  const [shippingCents, setShippingCents] = useState(0);
  const [taxCents, setTaxCents] = useState(0);
  const [orderNote, setOrderNote] = useState('');

  // Calculations
  const subtotalCents = items.reduce((sum, i) => sum + i.unit_price_cents * i.quantity, 0);
  const totalCents = subtotalCents + shippingCents + taxCents;

  // Validation
  const canSubmit = customer?.customer_email && items.length > 0 && totalCents > 0;

  const handleSubmit = () => {
    if (!canSubmit) return;

    const hasAddress = shippingAddress && Object.values(shippingAddress).some((v) => v);

    const payload = {
      customer_email: customer.customer_email,
      customer_name: customer.customer_name || null,
      status,
      subtotal_cents: subtotalCents,
      shipping_cents: shippingCents,
      tax_cents: taxCents,
      total_cents: totalCents,
      shipping_address: hasAddress ? shippingAddress : {},
      source: 'manual',
      items: items.map((item) => ({
        product_id: item.product_id,
        product_name: item.product_name,
        product_sku: item.product_sku,
        product_image: item.product_image,
        unit_price_cents: item.unit_price_cents,
        quantity: item.quantity,
      })),
    };

    createOrder.mutate(payload, {
      onSuccess: (response) => {
        const orderId = response?.data?.order_id;
        if (orderId) {
          navigate(`/orders/${orderId}`);
        } else {
          navigate('/orders');
        }
      },
    });
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-4 sm:p-6">
      {/* Header */}
      <div className="mb-8">
        <button
          onClick={() => navigate('/orders')}
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors mb-4"
        >
          <ArrowLeftIcon className="w-4 h-4" />
          Orders
        </button>
        <h1 className="text-2xl font-bold text-gray-900">Create Order</h1>
        <p className="text-gray-500 mt-1">Manually create an order for a customer</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* ── Left Column (2/3) ── */}
        <div className="lg:col-span-2 space-y-6">

          {/* Customer */}
          <Card>
            <CardHeader>
              <h2 className="text-sm font-semibold text-gray-900">Customer</h2>
            </CardHeader>
            <CardBody>
              <CustomerPicker customer={customer} setCustomer={setCustomer} />
            </CardBody>
          </Card>

          {/* Products */}
          <Card>
            <CardHeader>
              <h2 className="text-sm font-semibold text-gray-900">Products</h2>
            </CardHeader>
            <CardBody>
              <ProductPicker items={items} setItems={setItems} />
            </CardBody>
          </Card>

          {/* Shipping Address */}
          <Card>
            <CardBody>
              <ShippingAddressForm address={shippingAddress} setAddress={setShippingAddress} />
            </CardBody>
          </Card>

          {/* Internal note */}
          <Card>
            <CardHeader>
              <h2 className="text-sm font-semibold text-gray-900">Note (optional)</h2>
            </CardHeader>
            <CardBody>
              <textarea
                value={orderNote}
                onChange={(e) => setOrderNote(e.target.value)}
                placeholder="Add an internal note about this order..."
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
              />
            </CardBody>
          </Card>
        </div>

        {/* ── Right Column (1/3) ── */}
        <div className="space-y-6">

          {/* Order Summary */}
          <Card>
            <CardHeader>
              <h2 className="text-sm font-semibold text-gray-900">Summary</h2>
            </CardHeader>
            <CardBody>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Subtotal ({items.length} item{items.length !== 1 ? 's' : ''})</span>
                  <span className="text-gray-900 font-medium">{formatCents(subtotalCents)}</span>
                </div>

                {/* Editable shipping */}
                <div className="flex justify-between items-center">
                  <span className="text-gray-500">Shipping</span>
                  <div className="flex items-center gap-1">
                    <span className="text-gray-400 text-xs">$</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={(shippingCents / 100).toFixed(2)}
                      onChange={(e) => setShippingCents(Math.round((parseFloat(e.target.value) || 0) * 100))}
                      className="w-20 text-right px-2 py-1 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    />
                  </div>
                </div>

                {/* Editable tax */}
                <div className="flex justify-between items-center">
                  <span className="text-gray-500">Tax</span>
                  <div className="flex items-center gap-1">
                    <span className="text-gray-400 text-xs">$</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={(taxCents / 100).toFixed(2)}
                      onChange={(e) => setTaxCents(Math.round((parseFloat(e.target.value) || 0) * 100))}
                      className="w-20 text-right px-2 py-1 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    />
                  </div>
                </div>

                <div className="flex justify-between pt-3 border-t border-gray-200 text-base font-semibold">
                  <span>Total</span>
                  <span>{formatCents(totalCents)}</span>
                </div>
              </div>
            </CardBody>
          </Card>

          {/* Status */}
          <Card>
            <CardHeader>
              <h2 className="text-sm font-semibold text-gray-900">Status</h2>
            </CardHeader>
            <CardBody>
              <Select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                options={STATUS_OPTIONS}
              />
              <p className="text-xs text-gray-400 mt-2">
                {status === 'paid' && 'Order will be marked as paid immediately.'}
                {status === 'pending' && 'Order will await payment.'}
                {status === 'processing' && 'Order will be marked as processing.'}
              </p>
            </CardBody>
          </Card>

          {/* Submit */}
          <Button
            onClick={handleSubmit}
            loading={createOrder.isPending}
            disabled={!canSubmit}
            className="w-full"
            size="lg"
          >
            Create Order
          </Button>

          {!canSubmit && items.length === 0 && customer?.customer_email && (
            <p className="text-xs text-gray-400 text-center">Add at least one product to continue</p>
          )}
          {!canSubmit && !customer?.customer_email && (
            <p className="text-xs text-gray-400 text-center">Select or add a customer to continue</p>
          )}
        </div>
      </div>
    </div>
  );
}

export default CreateOrderPage;
