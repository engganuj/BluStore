import { PlusIcon } from '@heroicons/react/24/outline';
import Button from './Button';

export const EmptyState = ({ 
  icon, 
  title, 
  description, 
  action,
  actionLabel,
  onAction 
}) => {
  return (
    <div className="text-center py-12">
      <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-100 mb-4">
        {icon || <PlusIcon className="w-8 h-8 text-gray-400" />}
      </div>
      <h3 className="text-lg font-semibold text-gray-900 mb-2">
        {title || 'No items yet'}
      </h3>
      <p className="text-sm text-gray-500 mb-6 max-w-sm mx-auto">
        {description || 'Get started by creating a new item.'}
      </p>
      {action || (onAction && actionLabel && (
        <Button onClick={onAction} icon={<PlusIcon className="w-4 h-4" />}>
          {actionLabel}
        </Button>
      ))}
    </div>
  );
};

export default EmptyState;
