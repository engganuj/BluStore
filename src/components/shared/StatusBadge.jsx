import { ORDER_STATUS_STYLES } from '../../utils/helpers';

/**
 * Themed status pill for orders, products, shipping, etc.
 *
 * Usage:
 *   <StatusBadge status="paid" />
 *   <StatusBadge status="active" map={PRODUCT_STATUSES} />
 */

const DEFAULT_MAP = {
  ...ORDER_STATUS_STYLES,
  active:   { bg: 'bg-success-100',  text: 'text-success-800' },
  draft:    { bg: 'bg-warning-100', text: 'text-warning-800' },
  archived: { bg: 'bg-gray-100',   text: 'text-gray-800' },
  inactive: { bg: 'bg-gray-100',   text: 'text-gray-800' },
};

export const StatusBadge = ({ status, map, className = '' }) => {
  const lookup = map || DEFAULT_MAP;
  const style = lookup[status] || { bg: 'bg-gray-100', text: 'text-gray-800' };

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${style.bg} ${style.text} ${className}`}
    >
      {status}
    </span>
  );
};

export default StatusBadge;
