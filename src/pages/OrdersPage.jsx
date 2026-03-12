import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useOrders, useOrderStats } from '../hooks/useAPI';
import {
  PageHeader,
  Card,
  CardBody,
  Button,
  Select,
  SearchBar,
  StatusBadge,
  EmptyState,
  LoadingSpinner,
  StatCard,
  Pagination,
} from '../components/shared';
import { formatCents, formatDateTime } from '../utils/helpers';
import {
  ClipboardDocumentListIcon,
  CurrencyDollarIcon,
  CalendarDaysIcon,
  TruckIcon,
  PlusIcon,
} from '@heroicons/react/24/outline';

const STATUS_OPTIONS = [
  { value: '', label: 'All Orders' },
  { value: 'pending', label: 'Pending' },
  { value: 'paid', label: 'Paid' },
  { value: 'processing', label: 'Processing' },
  { value: 'shipped', label: 'Shipped' },
  { value: 'fulfilled', label: 'Fulfilled' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'refunded', label: 'Refunded' },
];

const PER_PAGE = 25;

function OrdersPage() {
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);

  const apiParams = {
    limit: PER_PAGE,
    offset: (page - 1) * PER_PAGE,
  };
  if (statusFilter) apiParams.status = statusFilter;

  const { data: ordersData, isLoading: ordersLoading } = useOrders(apiParams);
  const { data: stats, isLoading: statsLoading } = useOrderStats();

  const orders = ordersData?.orders || [];
  const total = ordersData?.total || 0;
  const totalPages = Math.ceil(total / PER_PAGE);

  // Client-side search within current page (name, email, order number)
  const filteredOrders = searchQuery
    ? orders.filter((o) => {
        const q = searchQuery.toLowerCase();
        return (
          o.order_number?.toLowerCase().includes(q) ||
          o.customer_name?.toLowerCase().includes(q) ||
          o.customer_email?.toLowerCase().includes(q)
        );
      })
    : orders;

  const handleStatusChange = (value) => {
    setStatusFilter(value);
    setPage(1);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-4 sm:p-6">
      <PageHeader
        title="Orders"
        subtitle="Manage and fulfill customer orders"
        action={{
          label: 'Create Order',
          onClick: () => navigate('/orders/new'),
          icon: <PlusIcon className="w-5 h-5" />,
        }}
      />

      {/* Stats */}
      {!statsLoading && stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <StatCard
            title="Total Orders"
            value={stats.total_orders}
            icon={<ClipboardDocumentListIcon className="w-6 h-6" />}
            color="blue"
          />
          <StatCard
            title="Total Revenue"
            value={formatCents(stats.total_revenue_cents || 0)}
            icon={<CurrencyDollarIcon className="w-6 h-6" />}
            color="green"
          />
          <StatCard
            title="Orders Today"
            value={stats.orders_today}
            trendLabel={`${formatCents(stats.revenue_today_cents || 0)} revenue`}
            icon={<CalendarDaysIcon className="w-6 h-6" />}
            color="primary"
          />
          <StatCard
            title="Pending Fulfillment"
            value={stats.paid_orders}
            icon={<TruckIcon className="w-6 h-6" />}
            color="yellow"
          />
        </div>
      )}

      {/* Filters */}
      <Card className="mb-6">
        <CardBody className="!py-3">
          <div className="flex flex-col sm:flex-row gap-3">
            <SearchBar
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder="Search by order #, customer name, or email..."
              className="flex-1"
            />
            <Select
              value={statusFilter}
              onChange={(e) => handleStatusChange(e.target.value)}
              options={STATUS_OPTIONS}
              className="w-48"
            />
          </div>
        </CardBody>
      </Card>

      {/* Orders Table */}
      <Card>
        {ordersLoading ? (
          <div className="flex items-center justify-center py-20">
            <LoadingSpinner />
          </div>
        ) : filteredOrders.length === 0 ? (
          <CardBody>
            <EmptyState
              icon={<ClipboardDocumentListIcon className="w-8 h-8 text-gray-400" />}
              title={searchQuery || statusFilter ? 'No orders found' : 'No orders yet'}
              description={
                searchQuery || statusFilter
                  ? 'Try adjusting your search or filters to find what you\'re looking for.'
                  : 'Orders will appear here after customers complete checkout.'
              }
            />
          </CardBody>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Order</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Customer</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Items</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Total</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredOrders.map((order) => (
                    <tr
                      key={order.id}
                      onClick={() => navigate(`/orders/${order.id}`)}
                      className="hover:bg-gray-50 cursor-pointer transition-colors"
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="font-medium text-primary-600">{order.order_number}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <p className="text-sm font-medium text-gray-900">{order.customer_name || 'Guest'}</p>
                        <p className="text-sm text-gray-500">{order.customer_email}</p>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <StatusBadge status={order.status} />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {order.items?.length || 0} item{order.items?.length !== 1 ? 's' : ''}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 text-right">
                        {formatCents(order.total_cents)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-right">
                        {formatDateTime(order.created_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {/* Pagination */}
            {totalPages > 1 && (
              <div className="border-t border-gray-200 px-4">
                <Pagination
                  page={page}
                  totalPages={totalPages}
                  total={total}
                  perPage={PER_PAGE}
                  onPageChange={setPage}
                  noun="orders"
                />
              </div>
            )}
          </>
        )}
      </Card>
    </div>
  );
}

export default OrdersPage;
