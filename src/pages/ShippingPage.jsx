import { useState } from 'react';
import {
  useShippingOptions,
  useCreateShippingOption,
  useUpdateShippingOption,
  useDeleteShippingOption,
} from '../hooks/useAPI';
import {
  PageHeader,
  Card,
  CardBody,
  Modal,
  Button,
  Input,
  EmptyState,
  LoadingSpinner,
  Badge,
} from '../components/shared';
import { formatCents, dollarsToCents } from '../utils/helpers';
import { TruckIcon, PlusIcon } from '@heroicons/react/24/outline';

// ── Shipping Option Form Modal ────────────────────────────────
const ShippingOptionModal = ({ option, onClose, onSave, isLoading }) => {
  const [formData, setFormData] = useState({
    name: option?.name || '',
    description: option?.description || '',
    price: option ? (option.price_cents / 100).toFixed(2) : '0.00',
    min_days: option?.min_days || '',
    max_days: option?.max_days || '',
    free_threshold: option?.free_shipping_threshold_cents
      ? (option.free_shipping_threshold_cents / 100).toFixed(2)
      : '',
    is_default: option?.is_default || false,
    is_active: option?.is_active !== false,
  });

  const update = (key, value) => setFormData((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave({
      name: formData.name,
      description: formData.description || null,
      price_cents: dollarsToCents(formData.price),
      min_days: formData.min_days ? parseInt(formData.min_days) : null,
      max_days: formData.max_days ? parseInt(formData.max_days) : null,
      free_shipping_threshold_cents: formData.free_threshold
        ? dollarsToCents(formData.free_threshold)
        : null,
      is_default: formData.is_default,
      is_active: formData.is_active,
    });
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={option ? 'Edit Shipping Option' : 'Add Shipping Option'}
      size="md"
      footer={
        <div className="flex gap-3 justify-end">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button
            onClick={handleSubmit}
            loading={isLoading}
          >
            Save
          </Button>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Name"
          required
          value={formData.name}
          onChange={(e) => update('name', e.target.value)}
          placeholder="e.g., Standard Shipping"
        />

        <Input
          label="Description"
          value={formData.description}
          onChange={(e) => update('description', e.target.value)}
          placeholder="e.g., Delivered in 5-7 business days"
        />

        <Input
          label="Price ($)"
          type="number"
          step="0.01"
          min="0"
          value={formData.price}
          onChange={(e) => update('price', e.target.value)}
        />

        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Min Days"
            type="number"
            min="0"
            value={formData.min_days}
            onChange={(e) => update('min_days', e.target.value)}
            placeholder="e.g., 5"
          />
          <Input
            label="Max Days"
            type="number"
            min="0"
            value={formData.max_days}
            onChange={(e) => update('max_days', e.target.value)}
            placeholder="e.g., 7"
          />
        </div>

        <Input
          label="Free Shipping Threshold ($)"
          type="number"
          step="0.01"
          min="0"
          value={formData.free_threshold}
          onChange={(e) => update('free_threshold', e.target.value)}
          placeholder="Leave empty for no threshold"
          helperText="Orders above this amount get this shipping option for free"
        />

        <div className="flex items-center gap-6">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={formData.is_default}
              onChange={(e) => update('is_default', e.target.checked)}
              className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
            />
            <span className="text-sm text-gray-700">Default option</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={formData.is_active}
              onChange={(e) => update('is_active', e.target.checked)}
              className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
            />
            <span className="text-sm text-gray-700">Active</span>
          </label>
        </div>
      </form>
    </Modal>
  );
};

// ── Main Page ─────────────────────────────────────────────────
function ShippingPage() {
  const [editingOption, setEditingOption] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);

  const { data: options = [], isLoading } = useShippingOptions();
  const createOption = useCreateShippingOption();
  const updateOption = useUpdateShippingOption();
  const deleteOption = useDeleteShippingOption();

  const handleSave = (data) => {
    if (editingOption) {
      updateOption.mutate(
        { id: editingOption.id, data },
        { onSuccess: () => { setShowModal(false); setEditingOption(null); } }
      );
    } else {
      createOption.mutate(data, {
        onSuccess: () => setShowModal(false),
      });
    }
  };

  const handleEdit = (option) => {
    setEditingOption(option);
    setShowModal(true);
  };

  const handleDelete = (id) => {
    deleteOption.mutate(id, {
      onSuccess: () => setDeleteConfirmId(null),
    });
  };

  const handleAdd = () => {
    setEditingOption(null);
    setShowModal(true);
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-4 sm:p-6">
      <PageHeader
        title="Shipping"
        subtitle="Configure your shipping options and rates"
        action={{
          label: 'Add Shipping Option',
          onClick: handleAdd,
          icon: <PlusIcon className="w-5 h-5" />,
        }}
      />

      {/* Shipping Options List */}
      <Card>
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <LoadingSpinner />
          </div>
        ) : options.length === 0 ? (
          <CardBody>
            <EmptyState
              icon={<TruckIcon className="w-8 h-8 text-gray-400" />}
              title="No shipping options yet"
              description="Add a shipping option so customers can get their orders delivered."
              actionLabel="Add Shipping Option"
              onAction={handleAdd}
            />
          </CardBody>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Price
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Delivery
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {options.map((option) => (
                  <tr key={option.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <div>
                        <p className="font-medium text-gray-900">
                          {option.name}
                          {option.is_default && (
                            <Badge variant="info" size="sm" className="ml-2">
                              Default
                            </Badge>
                          )}
                        </p>
                        {option.description && (
                          <p className="text-sm text-gray-500">{option.description}</p>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="font-medium text-gray-900">
                        {option.price_cents === 0 ? 'Free' : formatCents(option.price_cents)}
                      </span>
                      {option.free_shipping_threshold_cents && (
                        <p className="text-xs text-gray-500">
                          Free over {formatCents(option.free_shipping_threshold_cents)}
                        </p>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {option.min_days && option.max_days
                        ? `${option.min_days}–${option.max_days} days`
                        : option.min_days
                        ? `${option.min_days}+ days`
                        : '—'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Badge variant={option.is_active ? 'success' : 'warning'} size="sm">
                        {option.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button size="sm" variant="ghost" onClick={() => handleEdit(option)}>
                          Edit
                        </Button>
                        {deleteConfirmId === option.id ? (
                          <div className="flex items-center gap-1">
                            <Button
                              size="sm"
                              variant="danger"
                              onClick={() => handleDelete(option.id)}
                              loading={deleteOption.isPending}
                            >
                              Confirm
                            </Button>
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => setDeleteConfirmId(null)}
                            >
                              Cancel
                            </Button>
                          </div>
                        ) : (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setDeleteConfirmId(option.id)}
                            className="!text-red-600 hover:!bg-red-50"
                          >
                            Delete
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Modal */}
      {showModal && (
        <ShippingOptionModal
          option={editingOption}
          onClose={() => { setShowModal(false); setEditingOption(null); }}
          onSave={handleSave}
          isLoading={createOption.isPending || updateOption.isPending}
        />
      )}
    </div>
  );
}

export default ShippingPage;
