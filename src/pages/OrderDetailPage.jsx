import { useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  useOrder,
  useOrderEvents,
  useUpdateOrderStatus,
  useUpdateOrderTracking,
  useAddOrderNote,
  useRefundOrder,
} from '../hooks/useAPI';
import {
  PageHeader,
  Card,
  CardHeader,
  CardBody,
  CardFooter,
  Button,
  Select,
  Input,
  Modal,
  StatusBadge,
  LoadingSpinner,
  EmptyState,
  Badge,
} from '../components/shared';
import { formatCents, formatDateTime, formatDate } from '../utils/helpers';
import {
  ArrowLeftIcon,
  PrinterIcon,
  TruckIcon,
  ChatBubbleLeftEllipsisIcon,
  CurrencyDollarIcon,
  ClockIcon,
  CheckCircleIcon,
  XCircleIcon,
  ArrowPathIcon,
  DocumentTextIcon,
  MapPinIcon,
  UserIcon,
  EnvelopeIcon,
  InformationCircleIcon,
} from '@heroicons/react/24/outline';
import { customersAPI } from '../api/client';
import toast from 'react-hot-toast';

// ── Constants ─────────────────────────────────────────────────
const CARRIER_OPTIONS = [
  { value: '', label: 'Select carrier...' },
  { value: 'usps', label: 'USPS' },
  { value: 'ups', label: 'UPS' },
  { value: 'fedex', label: 'FedEx' },
  { value: 'dhl', label: 'DHL' },
  { value: 'other', label: 'Other' },
];

const STATUS_OPTIONS = [
  { value: 'pending', label: 'Pending' },
  { value: 'paid', label: 'Paid' },
  { value: 'processing', label: 'Processing' },
  { value: 'shipped', label: 'Shipped' },
  { value: 'fulfilled', label: 'Fulfilled' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'refunded', label: 'Refunded' },
];

const STATUS_FLOW = {
  pending: ['paid', 'cancelled'],
  paid: ['processing', 'shipped', 'fulfilled', 'refunded', 'cancelled'],
  processing: ['shipped', 'fulfilled', 'cancelled'],
  shipped: ['fulfilled'],
  fulfilled: [],
  cancelled: [],
  refunded: [],
};

const EVENT_ICONS = {
  status_change: ClockIcon,
  tracking_updated: TruckIcon,
  note: ChatBubbleLeftEllipsisIcon,
  refund: CurrencyDollarIcon,
  order_created: CheckCircleIcon,
};

const EVENT_COLORS = {
  status_change: 'bg-primary-100 text-primary-700',
  tracking_updated: 'bg-navy-100 text-navy-700',
  note: 'bg-gray-100 text-gray-600',
  refund: 'bg-warning-100 text-warning-700',
  order_created: 'bg-success-100 text-success-700',
};

// ── Timeline Item ─────────────────────────────────────────────
const TimelineItem = ({ event, isLast }) => {
  const Icon = EVENT_ICONS[event.event_type] || InformationCircleIcon;
  const colorClass = EVENT_COLORS[event.event_type] || 'bg-gray-100 text-gray-600';

  return (
    <div className="flex gap-3">
      <div className="flex flex-col items-center">
        <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${colorClass}`}>
          <Icon className="w-4 h-4" />
        </div>
        {!isLast && <div className="w-px flex-1 bg-gray-200 my-1" />}
      </div>
      <div className={`flex-1 ${isLast ? '' : 'pb-5'}`}>
        <p className="text-sm font-medium text-gray-900">{event.title}</p>
        {event.detail && (
          <p className="text-sm text-gray-600 mt-0.5 whitespace-pre-line">{event.detail}</p>
        )}
        <p className="text-xs text-gray-400 mt-1">
          {formatDateTime(event.created_at)}
          {event.actor && event.actor !== 'System' && ` · ${event.actor}`}
        </p>
      </div>
    </div>
  );
};

// ── Refund Modal ──────────────────────────────────────────────
const RefundModal = ({ order, onClose }) => {
  const [amountDollars, setAmountDollars] = useState(
    ((order.total_cents || 0) / 100).toFixed(2)
  );
  const [reason, setReason] = useState('');
  const refund = useRefundOrder();

  const maxDollars = (order.total_cents || 0) / 100;
  const amountCents = Math.round(parseFloat(amountDollars || 0) * 100);
  const isValid = amountCents > 0 && amountCents <= order.total_cents;
  const isFull = amountCents === order.total_cents;

  const handleSubmit = () => {
    if (!isValid) return;
    refund.mutate(
      { id: order.id, amount_cents: amountCents, reason },
      { onSuccess: () => onClose() }
    );
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="Issue Refund"
      subtitle={`Order ${order.order_number} · Total ${formatCents(order.total_cents)}`}
      size="sm"
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button
            variant="danger"
            onClick={handleSubmit}
            loading={refund.isPending}
            disabled={!isValid}
          >
            {isFull ? 'Refund Full Amount' : `Refund ${formatCents(amountCents)}`}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <Input
          label="Refund Amount"
          type="number"
          step="0.01"
          min="0.01"
          max={maxDollars}
          value={amountDollars}
          onChange={(e) => setAmountDollars(e.target.value)}
          helperText={`Maximum refundable: ${formatCents(order.total_cents)}`}
          error={amountDollars && !isValid ? 'Amount must be between $0.01 and the order total' : undefined}
          icon={<CurrencyDollarIcon className="w-4 h-4" />}
        />
        <Input
          label="Reason (optional)"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="e.g. Customer requested, item damaged..."
        />
        {isFull && (
          <div className="flex items-start gap-2 p-3 bg-warning-50 border border-warning-200 rounded-lg">
            <InformationCircleIcon className="w-5 h-5 text-warning-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-warning-800">
              This will refund the full order amount and set the order status to <strong>Refunded</strong>.
            </p>
          </div>
        )}
      </div>
    </Modal>
  );
};

// ── Main Page ─────────────────────────────────────────────────
function OrderDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const printRef = useRef();

  const { data: order, isLoading } = useOrder(id);
  const { data: events = [], isLoading: eventsLoading } = useOrderEvents(id);

  const [showRefund, setShowRefund] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [trackingData, setTrackingData] = useState(null); // lazy init from order
  const [statusValue, setStatusValue] = useState(null);

  const updateStatus = useUpdateOrderStatus();
  const updateTracking = useUpdateOrderTracking();
  const addNote = useAddOrderNote();

  // Lazy-init tracking state when order loads
  if (order && trackingData === null) {
    setTrackingData({
      shipping_carrier: order.shipping_carrier || '',
      tracking_number: order.tracking_number || '',
    });
  }
  if (order && statusValue === null) {
    setStatusValue(order.status);
  }

  const handlePrint = () => {
    const printContent = printRef.current;
    if (!printContent) return;
    const win = window.open('', '_blank');
    win.document.write(`
      <html><head><title>Order ${order?.order_number || ''}</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 40px; color: #1a1a1a; }
        table { width: 100%; border-collapse: collapse; }
        th, td { padding: 8px 12px; text-align: left; border-bottom: 1px solid #e5e5e5; font-size: 14px; }
        th { font-weight: 600; color: #666; font-size: 12px; text-transform: uppercase; }
        .header { margin-bottom: 24px; }
        .header h1 { font-size: 20px; margin: 0; }
        .header p { color: #666; margin: 4px 0 0; font-size: 14px; }
        .section { margin-top: 24px; }
        .section-title { font-size: 14px; font-weight: 600; margin-bottom: 8px; }
        .totals { margin-top: 16px; text-align: right; }
        .totals .row { display: flex; justify-content: flex-end; gap: 40px; padding: 4px 0; font-size: 14px; }
        .totals .total-row { font-size: 18px; font-weight: 700; border-top: 2px solid #1a1a1a; padding-top: 8px; margin-top: 8px; }
        .address { font-size: 14px; line-height: 1.6; }
      </style></head><body>
      ${printContent.innerHTML}
      </body></html>
    `);
    win.document.close();
    win.print();
  };

  const handleStatusChange = () => {
    if (statusValue && statusValue !== order.status) {
      updateStatus.mutate({ id: order.id, status: statusValue });
    }
  };

  const handleTrackingSave = () => {
    if (!trackingData) return;
    updateTracking.mutate({ id: order.id, tracking: trackingData });
  };

  const handleAddNote = () => {
    if (!noteText.trim()) return;
    addNote.mutate(
      { id: order.id, note: noteText.trim() },
      { onSuccess: () => setNoteText('') }
    );
  };

  const hasTrackingChanges = order && trackingData && (
    trackingData.shipping_carrier !== (order.shipping_carrier || '') ||
    trackingData.tracking_number !== (order.tracking_number || '')
  );

  const addr = order?.shipping_address || {};
  const hasAddress = addr.line1 || addr.city || addr.name;
  const nextStatuses = order ? (STATUS_FLOW[order.status] || []) : [];
  const availableStatuses = STATUS_OPTIONS.filter(
    (o) => o.value === order?.status || nextStatuses.includes(o.value)
  );

  // ── Loading ───────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-4 sm:p-6">
        <Card>
          <div className="flex items-center justify-center py-20">
            <LoadingSpinner />
          </div>
        </Card>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-4 sm:p-6">
        <Card>
          <CardBody>
            <EmptyState
              icon={<DocumentTextIcon className="w-8 h-8 text-gray-400" />}
              title="Order not found"
              description="This order may have been deleted or doesn't exist."
            />
            <div className="flex justify-center mt-4">
              <Button variant="secondary" onClick={() => navigate('/orders')}>
                Back to Orders
              </Button>
            </div>
          </CardBody>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-4 sm:p-6">
      {/* Header */}
      <div className="mb-8">
        <button
          onClick={() => navigate('/orders')}
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors mb-4"
        >
          <ArrowLeftIcon className="w-4 h-4" />
          Orders
        </button>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">{order.order_number}</h1>
            <StatusBadge status={order.status} />
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              icon={<PrinterIcon className="w-4 h-4" />}
              onClick={handlePrint}
            >
              Print
            </Button>
            {['paid', 'processing', 'shipped', 'fulfilled'].includes(order.status) && (
              <Button
                variant="secondary"
                size="sm"
                icon={<ArrowPathIcon className="w-4 h-4" />}
                onClick={() => setShowRefund(true)}
              >
                Refund
              </Button>
            )}
          </div>
        </div>
        <p className="text-sm text-gray-500 mt-1">
          Placed on {formatDateTime(order.created_at)}
          {order.paid_at && ` · Paid ${formatDateTime(order.paid_at)}`}
        </p>
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* ── Left Column (2/3) ── */}
        <div className="lg:col-span-2 space-y-6">

          {/* Items */}
          <Card>
            <CardHeader>
              <h2 className="text-sm font-semibold text-gray-900">Items</h2>
            </CardHeader>
            <div className="divide-y divide-gray-100">
              {(order.items || []).map((item, idx) => (
                <div key={item.id || idx} className="px-6 py-4 flex items-center gap-4">
                  {item.product_image ? (
                    <img
                      src={item.product_image}
                      alt={item.product_name}
                      className="w-12 h-12 object-cover rounded-lg border border-gray-200"
                    />
                  ) : (
                    <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center border border-gray-200">
                      <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{item.product_name}</p>
                    {item.product_sku && (
                      <p className="text-xs text-gray-400">SKU: {item.product_sku}</p>
                    )}
                    <p className="text-sm text-gray-500">
                      {formatCents(item.unit_price_cents)} × {item.quantity}
                    </p>
                  </div>
                  <p className="text-sm font-semibold text-gray-900">{formatCents(item.total_cents)}</p>
                </div>
              ))}
            </div>

            {/* Totals */}
            <div className="px-6 py-4 border-t border-gray-200 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Subtotal</span>
                <span className="text-gray-900">{formatCents(order.subtotal_cents)}</span>
              </div>
              {order.shipping_cents > 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-500">
                    Shipping
                    {order.shipping_option_name && (
                      <span className="text-gray-400 ml-1">({order.shipping_option_name})</span>
                    )}
                  </span>
                  <span className="text-gray-900">{formatCents(order.shipping_cents)}</span>
                </div>
              )}
              {order.tax_cents > 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Tax</span>
                  <span className="text-gray-900">{formatCents(order.tax_cents)}</span>
                </div>
              )}
              <div className="flex justify-between text-base font-semibold pt-3 border-t border-gray-200">
                <span className="text-gray-900">Total</span>
                <span className="text-gray-900">{formatCents(order.total_cents)}</span>
              </div>
            </div>
          </Card>

          {/* Timeline */}
          <Card>
            <CardHeader>
              <h2 className="text-sm font-semibold text-gray-900">Activity</h2>
            </CardHeader>
            <CardBody>
              {eventsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <LoadingSpinner />
                </div>
              ) : events.length === 0 ? (
                <div className="text-center py-8">
                  <ClockIcon className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                  <p className="text-sm text-gray-500">No activity recorded yet</p>
                  <p className="text-xs text-gray-400 mt-1">Events will appear here as the order progresses</p>
                </div>
              ) : (
                <div>
                  {events.map((event, idx) => (
                    <TimelineItem
                      key={event.id}
                      event={event}
                      isLast={idx === events.length - 1}
                    />
                  ))}
                </div>
              )}
            </CardBody>
          </Card>
        </div>

        {/* ── Right Column (1/3) ── */}
        <div className="space-y-6">

          {/* Status & Quick Actions */}
          <Card>
            <CardHeader>
              <h2 className="text-sm font-semibold text-gray-900">Status</h2>
            </CardHeader>
            <CardBody>
              <div className="space-y-3">
                <Select
                  value={statusValue || order.status}
                  onChange={(e) => setStatusValue(e.target.value)}
                  options={availableStatuses.length > 0 ? availableStatuses : STATUS_OPTIONS}
                />
                {statusValue && statusValue !== order.status && (
                  <Button
                    onClick={handleStatusChange}
                    loading={updateStatus.isPending}
                    className="w-full"
                  >
                    Update to {statusValue}
                  </Button>
                )}
              </div>
              {nextStatuses.length === 0 && (
                <p className="text-xs text-gray-400 mt-3">
                  This order is in a final state and cannot be advanced further.
                </p>
              )}
            </CardBody>
          </Card>

          {/* Customer */}
          <Card>
            <CardHeader>
              <h2 className="text-sm font-semibold text-gray-900">Customer</h2>
            </CardHeader>
            <CardBody>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-primary-100 flex items-center justify-center">
                    <UserIcon className="w-4 h-4 text-primary-700" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {order.customer_name || 'Guest Customer'}
                    </p>
                    {order.customer_email && (
                      <button
                        onClick={async () => {
                          try {
                            const res = await customersAPI.getByEmail(order.customer_email);
                            navigate(`/customers/${res.data.customer_id}`);
                          } catch {
                            navigate('/customers');
                          }
                        }}
                        className="text-xs text-primary-600 hover:text-primary-700"
                      >
                        View profile
                      </button>
                    )}
                  </div>
                </div>
                {order.customer_email && (
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <EnvelopeIcon className="w-4 h-4 text-gray-400" />
                    <a
                      href={`mailto:${order.customer_email}`}
                      className="hover:text-primary-600 transition-colors"
                    >
                      {order.customer_email}
                    </a>
                  </div>
                )}
              </div>
            </CardBody>
          </Card>

          {/* Shipping Address */}
          {hasAddress && (
            <Card>
              <CardHeader>
                <h2 className="text-sm font-semibold text-gray-900">Shipping Address</h2>
              </CardHeader>
              <CardBody>
                <div className="flex items-start gap-2">
                  <MapPinIcon className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                  <div className="text-sm text-gray-700 leading-relaxed">
                    {addr.name && <p className="font-medium">{addr.name}</p>}
                    {addr.line1 && <p>{addr.line1}</p>}
                    {addr.line2 && <p>{addr.line2}</p>}
                    <p>{[addr.city, addr.state, addr.postal_code].filter(Boolean).join(', ')}</p>
                    {addr.country && <p>{addr.country}</p>}
                  </div>
                </div>
              </CardBody>
            </Card>
          )}

          {/* Fulfillment & Tracking */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <TruckIcon className="w-4 h-4 text-gray-500" />
                <h2 className="text-sm font-semibold text-gray-900">Fulfillment</h2>
              </div>
            </CardHeader>
            <CardBody>
              {trackingData && (
                <div className="space-y-3">
                  <Select
                    label="Carrier"
                    value={trackingData.shipping_carrier}
                    onChange={(e) =>
                      setTrackingData({ ...trackingData, shipping_carrier: e.target.value })
                    }
                    options={CARRIER_OPTIONS}
                  />
                  <Input
                    label="Tracking Number"
                    value={trackingData.tracking_number}
                    onChange={(e) =>
                      setTrackingData({ ...trackingData, tracking_number: e.target.value })
                    }
                    placeholder="Enter tracking number"
                  />
                  {hasTrackingChanges && (
                    <Button
                      onClick={handleTrackingSave}
                      loading={updateTracking.isPending}
                      className="w-full"
                      size="sm"
                    >
                      Save Tracking
                    </Button>
                  )}
                  {order.tracking_url && (
                    <a
                      href={order.tracking_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-sm text-primary-600 hover:text-primary-700"
                    >
                      Track package →
                    </a>
                  )}
                  {order.shipped_at && (
                    <p className="text-xs text-gray-400">
                      Shipped on {formatDateTime(order.shipped_at)}
                    </p>
                  )}
                </div>
              )}
            </CardBody>
          </Card>

          {/* Notes */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <ChatBubbleLeftEllipsisIcon className="w-4 h-4 text-gray-500" />
                <h2 className="text-sm font-semibold text-gray-900">Notes</h2>
              </div>
            </CardHeader>
            <CardBody>
              <div className="space-y-3">
                <textarea
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  placeholder="Add a note about this order..."
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
                />
                <Button
                  size="sm"
                  onClick={handleAddNote}
                  loading={addNote.isPending}
                  disabled={!noteText.trim()}
                  className="w-full"
                  variant="secondary"
                >
                  Add Note
                </Button>
              </div>
            </CardBody>
          </Card>
        </div>
      </div>

      {/* Refund Modal */}
      {showRefund && (
        <RefundModal order={order} onClose={() => setShowRefund(false)} />
      )}

      {/* Hidden print content */}
      <div className="hidden">
        <div ref={printRef}>
          <div className="header">
            <h1>{order.order_number}</h1>
            <p>Placed: {formatDateTime(order.created_at)} · Status: {order.status}</p>
            {order.customer_name && <p>Customer: {order.customer_name} ({order.customer_email})</p>}
          </div>

          {hasAddress && (
            <div className="section">
              <div className="section-title">Shipping Address</div>
              <div className="address">
                {addr.name && <div>{addr.name}</div>}
                {addr.line1 && <div>{addr.line1}</div>}
                {addr.line2 && <div>{addr.line2}</div>}
                <div>{[addr.city, addr.state, addr.postal_code].filter(Boolean).join(', ')}</div>
                {addr.country && <div>{addr.country}</div>}
              </div>
            </div>
          )}

          <div className="section">
            <div className="section-title">Items</div>
            <table>
              <thead>
                <tr>
                  <th>Product</th>
                  <th>SKU</th>
                  <th>Qty</th>
                  <th>Price</th>
                  <th style={{ textAlign: 'right' }}>Total</th>
                </tr>
              </thead>
              <tbody>
                {(order.items || []).map((item, idx) => (
                  <tr key={item.id || idx}>
                    <td>{item.product_name}</td>
                    <td>{item.product_sku || '—'}</td>
                    <td>{item.quantity}</td>
                    <td>{formatCents(item.unit_price_cents)}</td>
                    <td style={{ textAlign: 'right' }}>{formatCents(item.total_cents)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="totals">
            <div className="row"><span>Subtotal</span><span>{formatCents(order.subtotal_cents)}</span></div>
            {order.shipping_cents > 0 && (
              <div className="row"><span>Shipping</span><span>{formatCents(order.shipping_cents)}</span></div>
            )}
            {order.tax_cents > 0 && (
              <div className="row"><span>Tax</span><span>{formatCents(order.tax_cents)}</span></div>
            )}
            <div className="row total-row"><span>Total</span><span>{formatCents(order.total_cents)}</span></div>
          </div>

          {order.shipping_carrier && (
            <div className="section">
              <div className="section-title">Shipping</div>
              <p>Carrier: {order.shipping_carrier}</p>
              {order.tracking_number && <p>Tracking: {order.tracking_number}</p>}
              {order.shipped_at && <p>Shipped: {formatDateTime(order.shipped_at)}</p>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default OrderDetailPage;
