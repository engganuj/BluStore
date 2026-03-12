export const StatCard = ({ title, value, icon, trend, trendLabel, subtext, color = 'primary' }) => {
  const colorClasses = {
    primary: 'bg-primary-50 text-primary-600',
    green: 'bg-success-50 text-success-600',
    success: 'bg-success-50 text-success-600',
    yellow: 'bg-warning-50 text-warning-600',
    warning: 'bg-warning-50 text-warning-600',
    red: 'bg-red-50 text-red-600',
    blue: 'bg-primary-50 text-primary-600',
    info: 'bg-info-50 text-info-600',
    purple: 'bg-navy-50 text-navy-600',
    orange: 'bg-warning-50 text-warning-600',
  };
  
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-xs sm:text-sm font-medium text-gray-500 mb-1">{title}</p>
          <p className="text-2xl sm:text-3xl font-bold text-gray-900 truncate">{value}</p>
          {subtext && (
            <p className="mt-1 text-sm text-gray-500">{subtext}</p>
          )}
          {(trend !== undefined || trendLabel) && (
            <div className="mt-2 flex items-center text-sm">
              {trend !== undefined && (
                <span className={`${trend > 0 ? 'text-success-600' : trend < 0 ? 'text-red-600' : 'text-gray-500'} font-medium`}>
                  {trend > 0 ? '↑' : trend < 0 ? '↓' : '–'} {Math.abs(trend)}%
                </span>
              )}
              {trendLabel && (
                <span className="text-gray-500 ml-2">{trendLabel}</span>
              )}
            </div>
          )}
        </div>
        {icon && (
          <div className={`p-3 rounded-lg ${colorClasses[color] || colorClasses.primary}`}>
            {icon}
          </div>
        )}
      </div>
    </div>
  );
};

export default StatCard;
