import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  useCustomer,
  useUpdateCustomer,
  useDeleteCustomer,
  useAddCustomerNote,
  useDeleteCustomerNote,
} from '../hooks/useAPI';
import {
  Card,
  CardHeader,
  CardBody,
  Button,
  Input,
  Modal,
  StatusBadge,
  LoadingSpinner,
  Badge,
} from '../components/shared';
import { formatCents, formatDate, timeAgo } from '../utils/helpers';
import {
  ArrowLeftIcon,
  EnvelopeIcon,
  PhoneIcon,
  MapPinIcon,
  TrashIcon,
  PlusIcon,
  XMarkIcon,
  ShoppingBagIcon,
  CurrencyDollarIcon,
  ChartBarIcon,
  ClockIcon,
} from '@heroicons/react/24/outline';

const STAT_COLORS = {
  primary: { bg: 'bg-primary-50', icon: 'text-primary-600' },
  green:   { bg: 'bg-success-50',   icon: 'text-success-600' },
  blue:    { bg: 'bg-primary-50',    icon: 'text-primary-600' },
  purple:  { bg: 'bg-navy-50',  icon: 'text-navy-600' },
};

function CustomerDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: customer, isLoading } = useCustomer(id);
  const updateCustomer = useUpdateCustomer();
  const deleteCustomer = useDeleteCustomer();
  const addNote = useAddCustomerNote();
  const deleteNote = useDeleteCustomerNote();

  const [editingContact, setEditingContact] = useState(false);
  const [contactForm, setContactForm] = useState({});
  const [newTag, setNewTag] = useState('');
  const [noteText, setNoteText] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <LoadingSpinner />
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-4 sm:p-6">
        <p className="text-gray-500">Customer not found.</p>
        <Button variant="secondary" onClick={() => navigate('/customers')} className="mt-4">
          Back to Customers
        </Button>
      </div>
    );
  }

  const name = [customer.first_name, customer.last_name].filter(Boolean).join(' ') || 'Unknown';
  const initial = (name !== 'Unknown' ? name : customer.email)[0].toUpperCase();
  const location = [customer.city, customer.state, customer.postal_code, customer.country]
    .filter(Boolean).join(', ');
  const tags = customer.tags || [];
  const notes = customer.notes || [];
  const orders = customer.orders || [];
  const topProducts = customer.top_products || [];

  // ── Contact edit ───────────────────────────────────────
  const startEditContact = () => {
    setContactForm({
      first_name: customer.first_name || '',
      last_name: customer.last_name || '',
      email: customer.email || '',
      phone: customer.phone || '',
      address_line1: customer.address_line1 || '',
      address_line2: customer.address_line2 || '',
      city: customer.city || '',
      state: customer.state || '',
      postal_code: customer.postal_code || '',
      country: customer.country || 'US',
    });
    setEditingContact(true);
  };

  const saveContact = () => {
    updateCustomer.mutate({ id, data: contactForm }, {
      onSuccess: () => setEditingContact(false),
    });
  };

  // ── Tags ───────────────────────────────────────────────
  const addTag = () => {
    const tag = newTag.trim().toLowerCase();
    if (!tag || tags.includes(tag)) return;
    updateCustomer.mutate({ id, data: { tags: [...tags, tag] } });
    setNewTag('');
  };

  const removeTag = (tagToRemove) => {
    updateCustomer.mutate({ id, data: { tags: tags.filter(t => t !== tagToRemove) } });
  };

  // ── Notes ──────────────────────────────────────────────
  const handleAddNote = () => {
    if (!noteText.trim()) return;
    addNote.mutate({ id, text: noteText.trim() }, {
      onSuccess: () => setNoteText(''),
    });
  };

  // ── Delete ─────────────────────────────────────────────
  const handleDelete = () => {
    deleteCustomer.mutate(id, {
      onSuccess: () => navigate('/customers'),
    });
  };

  // ── Stat definitions ───────────────────────────────────
  const statItems = [
    { label: 'Orders',      value: customer.order_count,                      icon: ShoppingBagIcon,   color: 'primary' },
    { label: 'Total Spent', value: formatCents(customer.total_spent_cents),   icon: CurrencyDollarIcon, color: 'green' },
    { label: 'Avg Order',   value: formatCents(customer.avg_order_cents),     icon: ChartBarIcon,      color: 'blue' },
    { label: 'Last Active', value: customer.last_order_at ? timeAgo(customer.last_order_at) : 'Never', icon: ClockIcon, color: 'purple' },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 py-4 sm:p-6">
      {/* Back nav */}
      <button
        onClick={() => navigate('/customers')}
        className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-6 transition-colors"
      >
        <ArrowLeftIcon className="w-4 h-4" />
        Customers
      </button>

      {/* ── Header ───────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-8">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 font-bold text-2xl flex-shrink-0">
            {initial}
          </div>
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-bold text-gray-900">{name}</h1>
              {tags.map(tag => (
                <Badge key={tag} variant="info" size="sm">{tag}</Badge>
              ))}
            </div>
            <p className="text-gray-500">{customer.email}</p>
            {customer.first_order_at && (
              <p className="text-sm text-gray-400 mt-0.5">
                Customer since {formatDate(customer.first_order_at)}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          {customer.email && (
            <a href={`mailto:${customer.email}`}>
              <Button variant="secondary" icon={<EnvelopeIcon className="w-4 h-4" />}>
                Email
              </Button>
            </a>
          )}
          <Link to={`/orders/new?customer=${encodeURIComponent(customer.email)}`}>
            <Button variant="secondary" icon={<ShoppingBagIcon className="w-4 h-4" />}>
              Create Order
            </Button>
          </Link>
        </div>
      </div>

      {/* ── Quick Stats ──────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {statItems.map(stat => {
          const colors = STAT_COLORS[stat.color];
          return (
            <div key={stat.label} className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-lg ${colors.bg} flex items-center justify-center`}>
                  <stat.icon className={`w-5 h-5 ${colors.icon}`} />
                </div>
                <div>
                  <p className="text-xl font-bold text-gray-900">{stat.value}</p>
                  <p className="text-xs text-gray-500">{stat.label}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Two Column Layout ────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Left Column (2/3) */}
        <div className="lg:col-span-2 space-y-6">

          {/* Order History */}
          <Card>
            <CardHeader>
              <h2 className="text-sm font-semibold text-gray-900">Order History</h2>
            </CardHeader>
            {orders.length === 0 ? (
              <CardBody>
                <p className="text-sm text-gray-500 text-center py-6">No orders yet</p>
              </CardBody>
            ) : (
              <div className="divide-y divide-gray-200">
                {orders.map(order => (
                  <Link
                    key={order.id}
                    to={`/orders/${order.id}`}
                    className="flex items-center justify-between px-6 py-3.5 hover:bg-gray-50 transition-colors"
                  >
                    <div>
                      <p className="text-sm font-medium text-gray-900">{order.order_number}</p>
                      <p className="text-xs text-gray-500">{formatDate(order.created_at)}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-medium text-gray-900">
                        {formatCents(order.total_cents)}
                      </span>
                      <StatusBadge status={order.status} />
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </Card>

          {/* Top Products */}
          {topProducts.length > 0 && (
            <Card>
              <CardHeader>
                <h2 className="text-sm font-semibold text-gray-900">Top Products</h2>
              </CardHeader>
              <div className="divide-y divide-gray-200">
                {topProducts.map((product, i) => (
                  <div key={i} className="flex items-center justify-between px-6 py-3">
                    <span className="text-sm text-gray-900">{product.product_name}</span>
                    <span className="text-sm text-gray-500">
                      {product.total_quantity}&times; across {product.order_count} order{product.order_count > 1 ? 's' : ''}
                    </span>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>

        {/* Right Column (1/3) */}
        <div className="space-y-6">

          {/* ── Contact Info ──────────────────────────────── */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-gray-900">Contact Info</h2>
                {!editingContact && (
                  <button
                    onClick={startEditContact}
                    className="text-sm text-primary-600 hover:text-primary-700 font-medium"
                  >
                    Edit
                  </button>
                )}
              </div>
            </CardHeader>
            <CardBody>
              {editingContact ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <Input
                      label="First Name"
                      value={contactForm.first_name}
                      onChange={(e) => setContactForm({ ...contactForm, first_name: e.target.value })}
                    />
                    <Input
                      label="Last Name"
                      value={contactForm.last_name}
                      onChange={(e) => setContactForm({ ...contactForm, last_name: e.target.value })}
                    />
                  </div>
                  <Input
                    label="Email"
                    type="email"
                    value={contactForm.email}
                    onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })}
                  />
                  <Input
                    label="Phone"
                    value={contactForm.phone}
                    onChange={(e) => setContactForm({ ...contactForm, phone: e.target.value })}
                  />
                  <Input
                    label="Address"
                    value={contactForm.address_line1}
                    onChange={(e) => setContactForm({ ...contactForm, address_line1: e.target.value })}
                  />
                  <div className="grid grid-cols-2 gap-3">
                    <Input
                      label="City"
                      value={contactForm.city}
                      onChange={(e) => setContactForm({ ...contactForm, city: e.target.value })}
                    />
                    <Input
                      label="State"
                      value={contactForm.state}
                      onChange={(e) => setContactForm({ ...contactForm, state: e.target.value })}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <Input
                      label="ZIP"
                      value={contactForm.postal_code}
                      onChange={(e) => setContactForm({ ...contactForm, postal_code: e.target.value })}
                    />
                    <Input
                      label="Country"
                      value={contactForm.country}
                      onChange={(e) => setContactForm({ ...contactForm, country: e.target.value })}
                    />
                  </div>
                  <div className="flex justify-end gap-2 pt-2">
                    <Button variant="secondary" size="sm" onClick={() => setEditingContact(false)}>
                      Cancel
                    </Button>
                    <Button size="sm" onClick={saveContact} loading={updateCustomer.isPending}>
                      Save
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {customer.email && (
                    <div className="flex items-center gap-2 text-sm">
                      <EnvelopeIcon className="w-4 h-4 text-gray-400 flex-shrink-0" />
                      <a href={`mailto:${customer.email}`} className="text-gray-700 hover:text-primary-600">
                        {customer.email}
                      </a>
                    </div>
                  )}
                  {customer.phone && (
                    <div className="flex items-center gap-2 text-sm">
                      <PhoneIcon className="w-4 h-4 text-gray-400 flex-shrink-0" />
                      <span className="text-gray-700">{customer.phone}</span>
                    </div>
                  )}
                  {location && (
                    <div className="flex items-center gap-2 text-sm">
                      <MapPinIcon className="w-4 h-4 text-gray-400 flex-shrink-0" />
                      <span className="text-gray-700">{location}</span>
                    </div>
                  )}
                  {!customer.phone && !location && (
                    <p className="text-sm text-gray-400">No additional contact info</p>
                  )}
                </div>
              )}
            </CardBody>
          </Card>

          {/* ── Tags ─────────────────────────────────────── */}
          <Card>
            <CardHeader>
              <h2 className="text-sm font-semibold text-gray-900">Tags</h2>
            </CardHeader>
            <CardBody>
              <div className="flex flex-wrap gap-2 mb-3">
                {tags.length === 0 && (
                  <p className="text-sm text-gray-400">No tags</p>
                )}
                {tags.map(tag => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-primary-50 text-primary-700"
                  >
                    {tag}
                    <button onClick={() => removeTag(tag)} className="hover:text-primary-900">
                      <XMarkIcon className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addTag()}
                  placeholder="Add tag..."
                  className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
                <Button size="sm" variant="secondary" onClick={addTag} disabled={!newTag.trim()}>
                  Add
                </Button>
              </div>
            </CardBody>
          </Card>

          {/* ── Notes ────────────────────────────────────── */}
          <Card>
            <CardHeader>
              <h2 className="text-sm font-semibold text-gray-900">Notes</h2>
            </CardHeader>
            <CardBody>
              <div className="mb-3">
                <textarea
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleAddNote();
                    }
                  }}
                  placeholder="Add a note..."
                  rows={2}
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
                />
              </div>
              <div className="flex justify-end mb-4">
                <Button
                  size="sm"
                  onClick={handleAddNote}
                  loading={addNote.isPending}
                  disabled={!noteText.trim()}
                >
                  Add Note
                </Button>
              </div>
              {notes.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-2">No notes yet</p>
              ) : (
                <div className="space-y-3">
                  {notes.map(note => (
                    <div key={note.id} className="bg-gray-50 rounded-lg px-3 py-2.5 group relative">
                      <p className="text-sm text-gray-700 whitespace-pre-wrap pr-6">{note.text}</p>
                      <p className="text-xs text-gray-400 mt-1">{timeAgo(note.created_at)}</p>
                      <button
                        onClick={() => deleteNote.mutate({ id, noteId: note.id })}
                        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity text-gray-400 hover:text-red-500"
                      >
                        <TrashIcon className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </CardBody>
          </Card>

          {/* ── Danger Zone ──────────────────────────────── */}
          <Card>
            <CardBody>
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="text-sm text-red-500 hover:text-red-700 font-medium"
              >
                Delete customer
              </button>
            </CardBody>
          </Card>
        </div>
      </div>

      {/* Delete Confirmation */}
      {showDeleteConfirm && (
        <Modal
          open
          onClose={() => setShowDeleteConfirm(false)}
          title="Delete Customer"
          size="sm"
          footer={
            <div className="flex justify-end gap-3">
              <Button variant="secondary" onClick={() => setShowDeleteConfirm(false)}>
                Cancel
              </Button>
              <Button variant="danger" onClick={handleDelete} loading={deleteCustomer.isPending}>
                Delete
              </Button>
            </div>
          }
        >
          <p className="text-sm text-gray-600">
            Are you sure you want to delete <strong>{name}</strong>? This removes their profile,
            notes, and tags. Order history will not be affected.
          </p>
        </Modal>
      )}
    </div>
  );
}

export default CustomerDetailPage;
