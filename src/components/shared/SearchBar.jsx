import { MagnifyingGlassIcon } from '@heroicons/react/24/outline';

/**
 * Shared search input with leading magnifying-glass icon.
 *
 * Single source of truth for every search field in the admin UI.
 * Icon container is a fixed w-12 (48 px) box; input has pl-12 (48 px)
 * so text always starts exactly where the icon container ends — no overlap.
 *
 * Also used by SearchDropdown (CreateOrderPage) via the exported constants
 * so combo-box inputs stay in sync.
 */

/* Reusable class strings — imported by SearchDropdown, Input, and anywhere
   else that needs an icon-prefixed search input. */
export const SEARCH_ICON_CLASS =
  'absolute inset-y-0 left-0 w-12 flex items-center justify-center pointer-events-none';
export const SEARCH_ICON_GLYPH_CLASS = 'w-4 h-4 text-gray-400';
export const SEARCH_INPUT_CLASS =
  'block w-full !pl-12 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all duration-150 ease-in-out';

export const SearchBar = ({ value, onChange, placeholder = 'Search...', className = '' }) => {
  return (
    <div className={`relative ${className}`}>
      <div className={SEARCH_ICON_CLASS}>
        <MagnifyingGlassIcon className={SEARCH_ICON_GLYPH_CLASS} />
      </div>
      <input
        type="text"
        className={SEARCH_INPUT_CLASS}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
};

export default SearchBar;
