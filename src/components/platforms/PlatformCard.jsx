import { TrashIcon, ArrowPathIcon, CheckCircleIcon } from '@heroicons/react/24/outline';
import Card from '../shared/Card';
import Badge from '../shared/Badge';
import Button from '../shared/Button';

export const PlatformCard = ({ platform, onSyncFrom, onDelete, isSyncing = false }) => {
  const getPlatformIcon = (type) => {
    switch (type) {
      case 'woo':
        return '🛒';
      case 'shopify':
        return '🛍️';
      default:
        return '🔗';
    }
  };
  
  const getPlatformName = () => {
    if (platform.platform_name && 
        platform.platform_name !== 'Blu Store' && 
        platform.platform_name !== 'woo') {
      return platform.platform_name;
    }
    return platform.platform_type === 'woo' ? 'WooCommerce' : platform.platform_type.toUpperCase();
  };
  
  return (
    <Card>
      <div className="p-6">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-3">
              <span className="text-3xl">{getPlatformIcon(platform.platform_type)}</span>
              <div>
                <h3 className="text-xl font-semibold text-gray-900">
                  {getPlatformName()}
                </h3>
                <p className="text-sm text-gray-500 mt-0.5">
                  {platform.config?.url || 'No URL configured'}
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-2 mb-4">
              <Badge variant="success" className="flex items-center gap-1">
                <CheckCircleIcon className="w-3.5 h-3.5" />
                {platform.status || 'connected'}
              </Badge>
              <span className="text-xs text-gray-500">
                Synced with Blu Store
              </span>
            </div>
            
            {platform.last_sync && (
              <p className="text-xs text-gray-500">
                Last synced: {new Date(platform.last_sync).toLocaleString()}
              </p>
            )}
          </div>
          
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="success"
              icon={<ArrowPathIcon className="w-4 h-4" />}
              onClick={onSyncFrom}
              loading={isSyncing}
            >
              Sync from Platform
            </Button>
            <Button
              size="sm"
              variant="danger"
              icon={<TrashIcon className="w-4 h-4" />}
              onClick={onDelete}
            >
              Disconnect
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
};

export default PlatformCard;
