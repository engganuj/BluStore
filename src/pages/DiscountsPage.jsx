import { useState, useEffect } from 'react';
import {
  useDiscounts,
  useCreateDiscount,
  useUpdateDiscount,
  useDeleteDiscount,
} from '../hooks/useAPI';
import {
  PageHeader,
  Card,
  CardBody,
  Button,
  Input,
  Select,
  Modal,
  EmptyState,
  Badge,
  LoadingSpinner,
  SearchBar,
} from '../components/shared';
import { TagIcon, PlusIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

// ── Discount type labels & colors ─────────────────────────────
const TYPE_CONFIG = {
  percentage:    { label: 'Percentage',    variant: 'info' },
  fixed_amount:  { label: 'Fixed Amount',  variant: 'success' },
  free_shipping: { label: 'Free Shipping', variant: 'purple' },
};

const STATUS_CONFIG = {
  active:   { label: 'Active',   variant: 'success' },
  disabled: { label: 'Disabled', variant: 'default' },
  expired:  { label: 'Expired',  variant: 'danger' },
};

// ── Format helpers ────────────────────────────────────────────
const formatValue = (type, value) => {
  if (type === 'percentage') return `${value}%`;
  if (type === 'fixed_amount') return `$${parseFloat(value).toFixed(2)}`;
  if (type === 'free_shipping') return 'Free';
  return value;
};

const formatDate = (dateStr) => {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

const getEffectiveStatus = (discount) => {
  if (discount.status === 'disabled') return 'disabled';
  if (discount.expires_at && new Date(discount.expires_at) < new Date()) return 'expired';
  if (discount.usage_limit && discount.usage_count >= discount.usage_limit) return 'expired';
  return discount.status;
};

// ── Empty form state ──────────────────────────────────────────
const EMPTY_FORM = {
  code: '',
  description: '',
  type: 'percentage',
  value: '',
  minimum_order_amount: '',
  maximum_discount_amount: '',
  usage_limit: '',
  usage_limit_per_customer: '',
  expires_at: '',
  status: 'active',
};

// ── Discount Form Modal ───────────────────────────────────────
const DiscountFormModal = ({ open, onClose, discount, onSave, isSaving }) => {
  const [form, setForm] = useState(EMPTY_FORM);
  const isEditing = !!discount;

  // Reset form when modal opens
  useEffect(() => {
    if (open && discount) {
      setForm({
        code: discount.code || '',
        description: discount.description || '',
        type: discount.type || 'percentage',
        value: discount.value || '',
        minimum_order_amount: discount.minimum_order_amount || '',
        maximum_discount_amount: discount.maximum_discount_amount || '',
        usage_limit: discount.usage_limit || '',
        usage_limit_per_customer: discount.usage_limit_per_customer || '',
        expires_at: discount.expires_at ? discount.expires_at.slice(0, 16) : '',
        status: discount.status || 'active',
      });
    } else if (open) {
      setForm(EMPTY_FORM);
    }
  }, [open, discount]);

  const update = (key, val) => setForm((prev) => ({ ...prev, [key]: val }));

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.code.trim()) return toast.error('Discount code is required');
    if (form.type !== 'free_shipping' && (!form.value || parseFloat(form.value) <= 0)) {
      return toast.error('Discount value is required');
    }

    const payload = {
      ...form,
      value: parseFloat(form.value) || 0,
      minimum_order_amount: form.minimum_order_amount ? parseFloat(form.minimum_order_amount) : null,
      maximum_discount_amount: form.maximum_discount_amount ? parseFloat(form.maximum_discount_amount) : null,
      usage_limit: form.usage_limit ? parseInt(form.usage_limit) : null,
      usage_limit_per_customer: form.usage_limit_per_customer ? parseInt(form.usage_limit_per_customer) : null,
      expires_at: form.expires_at || null,
    };

    onSave(payload);
  };

  return (
    <Modal open={open} onClose={onClose} title={isEditing ? 'Edit Discount' : 'Create Discount'}>
      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Code & Type */}
        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Discount Code"
            required
            value={form.code}
            onChange={(e) => update('code', e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, ''))}
            placeholder="SAVE20"
          />
          <Select
            label="Type"
            value={form.type}
            onChange={(e) => update('type', e.target.value)}
            options={[
              { value: 'percentage', label: 'Percentage (%)' },
              { value: 'fixed_amount', label: 'Fixed Amount ($)' },
              { value: 'free_shipping', label: 'Free Shipping' },
            ]}
          />
        </div>

        {/* Value */}
        {form.type !== 'free_shipping' && (
          <div className="grid grid-cols-2 gap-4">
            <Input
              label={form.type === 'percentage' ? 'Discount (%)' : 'Discount ($)'}
              type="number"
              step={form.type === 'percentage' ? '1' : '0.01'}
              min="0"
              max={form.type === 'percentage' ? '100' : undefined}
              required
              value={form.value}
              onChange={(e) => update('value', e.target.value)}
              placeholder={form.type === 'percentage' ? '20' : '10.00'}
            />
            {form.type === 'percentage' && (
              <Input
                label="Max Discount ($)"
                type="number"
                step="0.01"
                min="0"
                value={form.maximum_discount_amount}
                onChange={(e) => update('maximum_discount_amount', e.target.value)}
                placeholder="Optional"
              />
            )}
          </div>
        )}

        {/* Description */}
        <Input
          label="Description"
          value={form.description}
          onChange={(e) => update('description', e.target.value)}
          placeholder="e.g. 20% off your order"
        />

        {/* Minimum order */}
        <Input
          label="Minimum Order Amount ($)"
          type="number"
          step="0.01"
          min="0"
          value={form.minimum_order_amount}
          onChange={(e) => update('minimum_order_amount', e.target.value)}
          placeholder="Optional"
        />

        {/* Usage limits */}
        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Total Usage Limit"
            type="number"
            min="0"
            value={form.usage_limit}
            onChange={(e) => update('usage_limit', e.target.value)}
            placeholder="Unlimited"
          />
          <Input
            label="Per Customer Limit"
            type="number"
            min="0"
            value={form.usage_limit_per_customer}
            onChange={(e) => update('usage_limit_per_customer', e.target.value)}
            placeholder="Unlimited"
          />
        </div>

        {/* Expiry */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Expires At
            </label>
            <input
              type="datetime-local"
              value={form.expires_at}
              onChange={(e) => update('expires_at', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
          </div>
          {isEditing && (
            <Select
              label="Status"
              value={form.status}
              onChange={(e) => update('status', e.target.value)}
              options={[
                { value: 'active', label: 'Active' },
                { value: 'disabled', label: 'Disabled' },
              ]}
            />
          )}
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-2">
          <Button variant="secondary" type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={isSaving}>
            {isEditing ? 'Save Changes' : 'Create Discount'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};

// ── Main Page ─────────────────────────────────────────────────
function DiscountsPage() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingDiscount, setEditingDiscount] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  const params = {};
  if (statusFilter) params.status = statusFilter;
  const { data: discounts, isLoading } = useDiscounts(params);
  const createDiscount = useCreateDiscount();
  const updateDiscount = useUpdateDiscount();
  const deleteDiscount = useDeleteDiscount();

  const filteredDiscounts = (discounts || []).filter((d) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      d.code.toLowerCase().includes(q) ||
      (d.description && d.description.toLowerCase().includes(q))
    );
  });

  const handleOpenCreate = () => {
    setEditingDiscount(null);
    setModalOpen(true);
  };

  const handleOpenEdit = (discount) => {
    setEditingDiscount(discount);
    setModalOpen(true);
  };

  const handleSave = (payload) => {
    if (editingDiscount) {
      updateDiscount.mutate(
        { id: editingDiscount.id, data: payload },
        { onSuccess: () => setModalOpen(false) }
      );
    } else {
      createDiscount.mutate(payload, {
        onSuccess: () => setModalOpen(false),
      });
    }
  };

  const handleDelete = (id) => {
    deleteDiscount.mutate(id, {
      onSuccess: () => setDeleteConfirm(null),
    });
  };

  const handleCopyCode = (code) => {
    navigator.clipboard.writeText(code).then(() => toast.success(`Copied "${code}"`));
  };

  if (isLoading) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-4 sm:p-6">
        <PageHeader title="Discounts" subtitle="Manage promo codes and coupons" />
        <div className="flex items-center justify-center py-20">
          <LoadingSpinner />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-4 sm:p-6">
      <PageHeader
        title="Discounts"
        subtitle="Create and manage promo codes. Changes sync to WooCommerce coupons automatically."
        action={{ label: 'Create Discount', onClick: handleOpenCreate }}
      />

      {/* Filters */}
      <div className="flex items-center gap-3 mb-6">
        <div className="flex-1">
          <SearchBar
            value={search}
            onChange={setSearch}
            placeholder="Search by code or description..."
          />
        </div>
        <Select
          className="w-48"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          options={[
            { value: '', label: 'All Statuses' },
            { value: 'active', label: 'Active' },
            { value: 'disabled', label: 'Disabled' },
          ]}
        />
      </div>

      {/* Discounts List */}
      {filteredDiscounts.length === 0 ? (
        <EmptyState
          icon={<TagIcon className="w-12 h-12" />}
          title="No discounts yet"
          description="Create your first promo code to drive sales and reward customers."
          action={
            <Button onClick={handleOpenCreate}>
              <PlusIcon className="w-4 h-4 mr-1.5" />
              Create Discount
            </Button>
          }
        />
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Code</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Value</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Min. Order</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Usage</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Expires</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filteredDiscounts.map((discount) => {
                  const effectiveStatus = getEffectiveStatus(discount);
                  const statusConf = STATUS_CONFIG[effectiveStatus] || STATUS_CONFIG.active;
                  const typeConf = TYPE_CONFIG[discount.type] || TYPE_CONFIG.percentage;

                  return (
                    <tr key={discount.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3">
                        <button
                          onClick={() => handleCopyCode(discount.code)}
                          className="inline-flex items-center gap-1.5 font-mono text-sm font-semibold text-gray-900 bg-gray-100 px-2.5 py-1 rounded-md hover:bg-gray-200 transition-colors"
                          title="Click to copy"
                        >
                          {discount.code}
                          <svg className="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                        </button>
                        {discount.description && (
                          <p className="text-xs text-gray-500 mt-1">{discount.description}</p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={typeConf.variant}>{typeConf.label}</Badge>
                      </td>
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">
                        {formatValue(discount.type, discount.value)}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {discount.minimum_order_amount
                          ? `$${parseFloat(discount.minimum_order_amount).toFixed(2)}`
                          : '—'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {discount.usage_count || 0}
                        {discount.usage_limit ? ` / ${discount.usage_limit}` : ''}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {formatDate(discount.expires_at)}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={statusConf.variant}>{statusConf.label}</Badge>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleOpenEdit(discount)}
                            className="text-sm text-primary-600 hover:text-primary-700 font-medium"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => setDeleteConfirm(discount)}
                            className="text-sm text-red-600 hover:text-red-700 font-medium"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Create/Edit Modal */}
      <DiscountFormModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        discount={editingDiscount}
        onSave={handleSave}
        isSaving={createDiscount.isPending || updateDiscount.isPending}
      />

      {/* Delete Confirmation Modal */}
      <Modal
        open={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        title="Delete Discount"
      >
        <p className="text-sm text-gray-600 mb-2">
          Are you sure you want to delete <span className="font-mono font-semibold">{deleteConfirm?.code}</span>?
        </p>
        <p className="text-sm text-gray-500 mb-6">
          This will also remove the corresponding WooCommerce coupon.
        </p>
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={() => setDeleteConfirm(null)}>
            Cancel
          </Button>
          <Button
            variant="danger"
            onClick={() => handleDelete(deleteConfirm.id)}
            loading={deleteDiscount.isPending}
          >
            Delete
          </Button>
        </div>
      </Modal>
    </div>
  );
}

export default DiscountsPage;
