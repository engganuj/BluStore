/**
 * Themed select input matching the Input component styling.
 *
 * Usage:
 *   <Select
 *     label="Status"
 *     value={status}
 *     onChange={(e) => setStatus(e.target.value)}
 *     options={[{ value: '', label: 'All' }, { value: 'paid', label: 'Paid' }]}
 *   />
 */
export const Select = ({
  label,
  options = [],
  helperText,
  error,
  className = '',
  ...props
}) => {
  return (
    <div className={className || 'w-full'}>
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-1.5">
          {label}
          {props.required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      <select
        className={`
          w-full px-4 py-2.5 border rounded-lg transition-all duration-150 ease-in-out
          text-sm bg-white
          focus:ring-2 focus:ring-primary-500 focus:border-transparent
          ${error ? 'border-red-300 focus:ring-red-500' : 'border-gray-300'}
        `}
        {...props}
      >
        {options.map((opt) =>
          typeof opt === 'string' ? (
            <option key={opt} value={opt}>{opt}</option>
          ) : (
            <option key={opt.value} value={opt.value} disabled={opt.disabled}>
              {opt.label}
            </option>
          )
        )}
      </select>
      {helperText && !error && (
        <p className="mt-1.5 text-xs text-gray-500">{helperText}</p>
      )}
      {error && (
        <p className="mt-1.5 text-xs text-red-600">{error}</p>
      )}
    </div>
  );
};

export default Select;
