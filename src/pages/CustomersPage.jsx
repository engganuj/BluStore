import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCustomers } from '../hooks/useAPI';
import {
  PageHeader,
  Card,
  CardBody,
  Button,
  SearchBar,
  EmptyState,
  LoadingSpinner,
  StatCard,
  Pagination,
  Badge,
} from '../components/shared';
import { formatCents, timeAgo } from '../utils/helpers';
import {
  UserGroupIcon,
  CurrencyDollarIcon,
  ShoppingBagIcon,
  ChartBarIcon,
  PlusIcon,
  StarIcon,
  ArrowPathIcon,
  SparklesIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';

const PER_PAGE = 25;

const SEGMENTS = [
  { key: 'all', label: 'All', icon: UserGroupIcon },
  { key: 'vip', label: 'VIP', icon: StarIcon },
  { key: 'repeat', label: 'Repeat', icon: ArrowPathIcon },
  { key: 'new', label: 'New', icon: SparklesIcon },
  { key: 'at_risk', label: 'At Risk', icon: ExclamationTriangleIcon },
];

// ── Main Page ────────────────────────────────────────────
function CustomersPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [debounceTimer, setDebounceTimer] = useState(null);
  const [page, setPage] = useState(1);
  const [segment, setSegment] = useState('all');

  const handleSearchChange = useCallback((value) => {
    setSearch(value);
    if (debounceTimer) clearTimeout(debounceTimer);
    const timer = setTimeout(() => {
      setDebouncedSearch(value);
      setPage(1);
    }, 300);
    setDebounceTimer(timer);
  }, [debounceTimer]);

  const apiParams = {
    limit: PER_PAGE,
    offset: (page - 1) * PER_PAGE,
    segment,
  };
  if (debouncedSearch) apiParams.search = debouncedSearch;

  const { data, isLoading } = useCustomers(apiParams);

  const customers = data?.customers || [];
  const total = data?.total || 0;
  const totalPages = Math.ceil(total / PER_PAGE);
  const stats = data?.stats || {};
  const segmentCounts = data?.segment_counts || {};

  const handleSegmentChange = (key) => {
    setSegment(key);
    setPage(1);
  };

  const avgLTV = stats.total_customers > 0
    ? Math.round((stats.total_revenue_cents || 0) / stats.total_customers)
    : 0;

  return (
    <div className="max-w-7xl mx-auto px-4 py-4 sm:p-6">
      <PageHeader
        title="Customers"
        subtitle="Manage and grow your customer relationships"
        action={{
          label: 'Add Customer',
          icon: <PlusIcon className="w-4 h-4" />,
          onClick: () => navigate('/customers/new'),
        }}
      />

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <StatCard
          title="Total Customers"
          value={stats.total_customers || 0}
          icon={<UserGroupIcon className="w-6 h-6" />}
          color="primary"
        />
        <StatCard
          title="Total Orders"
          value={stats.total_orders || 0}
          icon={<ShoppingBagIcon className="w-6 h-6" />}
          color="blue"
        />
        <StatCard
          title="Lifetime Revenue"
          value={formatCents(stats.total_revenue_cents || 0)}
          icon={<CurrencyDollarIcon className="w-6 h-6" />}
          color="green"
        />
        <StatCard
          title="Avg. Customer Value"
          value={formatCents(avgLTV)}
          icon={<ChartBarIcon className="w-6 h-6" />}
          color="purple"
        />
      </div>

      {/* Segment Tabs */}
      <div className="flex items-center gap-1 mb-6 bg-white rounded-lg border border-gray-200 p-1 w-fit">
        {SEGMENTS.map((seg) => {
          const count = seg.key === 'all'
            ? segmentCounts.all_count
            : segmentCounts[`${seg.key}_count`];
          const isActive = segment === seg.key;
          return (
            <button
              key={seg.key}
              onClick={() => handleSegmentChange(seg.key)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                isActive
                  ? 'bg-primary-50 text-primary-700 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}
            >
              <seg.icon className="w-4 h-4" />
              {seg.label}
              {count > 0 && (
                <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                  isActive ? 'bg-primary-100 text-primary-700' : 'bg-gray-100 text-gray-500'
                }`}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Search */}
      <div className="mb-6">
        <SearchBar
          value={search}
          onChange={handleSearchChange}
          placeholder="Search by name or email..."
          className="max-w-md"
        />
      </div>

      {/* Customer Table */}
      <Card>
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <LoadingSpinner />
          </div>
        ) : customers.length === 0 ? (
          <CardBody>
            <EmptyState
              icon={<UserGroupIcon className="w-8 h-8 text-gray-400" />}
              title={search || segment !== 'all' ? 'No customers found' : 'No customers yet'}
              description={
                search
                  ? "Try adjusting your search to find who you're looking for."
                  : segment !== 'all'
                  ? `No customers match the "${segment}" segment.`
                  : 'Customers will appear here after their first order.'
              }
              action={
                !search && segment === 'all'
                  ? <Button onClick={() => navigate('/customers/new')} icon={<PlusIcon className="w-4 h-4" />}>Add Customer</Button>
                  : null
              }
            />
          </CardBody>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Customer
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Location
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Orders
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Total Spent
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Last Order
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {customers.map((customer) => {
                    const name = [customer.first_name, customer.last_name]
                      .filter(Boolean).join(' ') || 'Unknown';
                    const initial = (name !== 'Unknown' ? name : customer.email)[0].toUpperCase();
                    const location = [customer.city, customer.state].filter(Boolean).join(', ');
                    const tags = customer.tags || [];

                    return (
                      <tr
                        key={customer.id}
                        onClick={() => navigate(`/customers/${customer.id}`)}
                        className="hover:bg-gray-50 cursor-pointer transition-colors"
                      >
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 font-medium flex-shrink-0">
                              {initial}
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <p className="font-medium text-gray-900 truncate">{name}</p>
                                {tags.length > 0 && (
                                  <div className="hidden sm:flex gap-1">
                                    {tags.slice(0, 2).map(tag => (
                                      <Badge key={tag} variant="info" size="sm">{tag}</Badge>
                                    ))}
                                    {tags.length > 2 && (
                                      <span className="text-xs text-gray-400">+{tags.length - 2}</span>
                                    )}
                                  </div>
                                )}
                              </div>
                              <p className="text-sm text-gray-500 truncate">{customer.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {location || '\u2014'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right">
                          <span className="text-gray-900 font-medium">{customer.order_count}</span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right font-medium text-gray-900">
                          {formatCents(customer.total_spent_cents)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-500">
                          {customer.last_order_at ? timeAgo(customer.last_order_at) : '\u2014'}
                        </td>
                      </tr>
                    );
                  })}
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
                  noun="customers"
                />
              </div>
            )}
          </>
        )}
      </Card>

    </div>
  );
}

export default CustomersPage;
