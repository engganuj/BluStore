import Button from './Button';

/**
 * Consistent page header used at the top of every section.
 *
 * Usage:
 *   <PageHeader
 *     title="Orders"
 *     subtitle="Manage and fulfil customer orders"
 *     action={{ label: 'Create Order', onClick: () => … }}
 *   />
 */
export const PageHeader = ({
  title,
  subtitle,
  action,        // { label, onClick, icon?, variant? }
  secondaryAction,
  children,      // extra slot (e.g. filter bar)
}) => {
  return (
    <div className="mb-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
          {subtitle && <p className="text-gray-500 mt-1">{subtitle}</p>}
        </div>

        {(action || secondaryAction) && (
          <div className="flex items-center gap-3">
            {secondaryAction && (
              <Button
                variant="secondary"
                onClick={secondaryAction.onClick}
                icon={secondaryAction.icon}
              >
                {secondaryAction.label}
              </Button>
            )}
            {action && (
              <Button
                variant={action.variant || 'primary'}
                onClick={action.onClick}
                icon={action.icon}
              >
                {action.label}
              </Button>
            )}
          </div>
        )}
      </div>

      {children}
    </div>
  );
};

export default PageHeader;
