import { SEARCH_ICON_CLASS } from './SearchBar';

export const Input = ({
  label,
  error,
  helperText,
  icon,
  className = '',
  ...props
}) => {
  return (
    <div className="w-full">
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-1.5">
          {label}
          {props.required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      <div className="relative">
        {icon && (
          <div className={SEARCH_ICON_CLASS}>
            <span className="text-gray-400">{icon}</span>
          </div>
        )}
        <input
          className={`
            w-full px-4 py-2.5 border rounded-lg transition-all duration-150 ease-in-out
            placeholder-gray-400 text-sm
            focus:ring-2 focus:ring-primary-500 focus:border-transparent
            ${error ? 'border-red-300 focus:ring-red-500' : 'border-gray-300'}
            ${icon ? '!pl-12' : ''}
            ${className}
          `}
          {...props}
        />
      </div>
      {helperText && !error && (
        <p className="mt-1.5 text-xs text-gray-500">{helperText}</p>
      )}
      {error && (
        <p className="mt-1.5 text-xs text-red-600">{error}</p>
      )}
    </div>
  );
};

export default Input;
