import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  useDesignCapabilities,
  useDesignSettings,
  useUpdateDesignSettings,
  useApplyDesignToTheme,
  useDesignVersions,
  useRestoreDesignVersion,
  useDesignFonts,
  useDesignMenus,
  useCreateDesignMenu,
  useUpdateDesignMenu,
  useDeleteDesignMenu,
  useStore,
  useUpdateStore,
} from '../hooks/useAPI';
import toast from 'react-hot-toast';
import { LoadingSpinner } from '../components/shared';

/* ═══════════════════════════════════════════════════════════════
   CURATED PALETTES — designer-quality, named for merchants
   ═══════════════════════════════════════════════════════════════ */
const PALETTES = [
  { name: 'Midnight',    colors: { brand: '#1e293b', accent: '#3b82f6', text: '#0f172a', background: '#ffffff', link: '#3b82f6', button: '#1e293b', button_text: '#ffffff' } },
  { name: 'Forest',      colors: { brand: '#166534', accent: '#a3e635', text: '#14532d', background: '#fafdf6', link: '#166534', button: '#166534', button_text: '#ffffff' } },
  { name: 'Terracotta',  colors: { brand: '#9a3412', accent: '#fb923c', text: '#1c1917', background: '#fffbeb', link: '#9a3412', button: '#9a3412', button_text: '#ffffff' } },
  { name: 'Ocean',       colors: { brand: '#0369a1', accent: '#06b6d4', text: '#0c4a6e', background: '#f0f9ff', link: '#0369a1', button: '#0369a1', button_text: '#ffffff' } },
  { name: 'Plum',        colors: { brand: '#7e22ce', accent: '#e879f9', text: '#3b0764', background: '#fdf4ff', link: '#7e22ce', button: '#7e22ce', button_text: '#ffffff' } },
  { name: 'Ink',         colors: { brand: '#171717', accent: '#525252', text: '#171717', background: '#ffffff', link: '#171717', button: '#171717', button_text: '#ffffff' } },
  { name: 'Rose',        colors: { brand: '#9f1239', accent: '#fb7185', text: '#1f2937', background: '#fff1f2', link: '#9f1239', button: '#9f1239', button_text: '#ffffff' } },
  { name: 'Sand',        colors: { brand: '#78716c', accent: '#d6d3d1', text: '#292524', background: '#fafaf9', link: '#78716c', button: '#292524', button_text: '#ffffff' } },
];

/* ═══════════════════════════════════════════════════════════════
   FONT LOADING
   ═══════════════════════════════════════════════════════════════ */
const GOOGLE_FONT_NAMES = new Set([
  'Inter','DM Sans','Poppins','Roboto','Open Sans','Lato','Montserrat',
  'Playfair Display','Merriweather','Lora','Source Serif Pro',
  'JetBrains Mono','Fira Code',
]);

const useFontLoader = (heading, body) => {
  useEffect(() => {
    const families = new Set();
    if (heading && GOOGLE_FONT_NAMES.has(heading)) families.add(heading);
    if (body && GOOGLE_FONT_NAMES.has(body)) families.add(body);
    if (families.size === 0) return;
    const id = 'blu-design-fonts';
    let link = document.getElementById(id);
    const href = `https://fonts.googleapis.com/css2?${[...families].map(f => `family=${f.replace(/ /g, '+')}:wght@300;400;500;600;700`).join('&')}&display=swap`;
    if (link) { link.href = href; } else {
      link = document.createElement('link');
      link.id = id; link.rel = 'stylesheet'; link.href = href;
      document.head.appendChild(link);
    }
  }, [heading, body]);
};

const ff = (name) =>
  !name || name === 'system-ui'
    ? 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    : `"${name}", system-ui, sans-serif`;


/* ═══════════════════════════════════════════════════════════════
   STOREFRONT PREVIEW — the centerpiece
   This needs to look like a real, aspirational storefront.
   ═══════════════════════════════════════════════════════════════ */
const StorefrontPreview = ({ draft, storeName, logoUrl, tagline, menuItems }) => {
  const c = draft.colors;
  const hf = ff(draft.fonts.heading);
  const bf = ff(draft.fonts.body);

  const navLinks = menuItems?.length > 0
    ? menuItems.slice(0, 6).map(i => i.label)
    : ['Shop', 'Collections', 'About'];

  // Blend a hex color with alpha
  const blend = (hex, alpha) => {
    const r = parseInt(hex.slice(1,3), 16);
    const g = parseInt(hex.slice(3,5), 16);
    const b = parseInt(hex.slice(5,7), 16);
    return `rgba(${r},${g},${b},${alpha})`;
  };

  return (
    <div
      className="overflow-hidden flex flex-col text-left"
      style={{ backgroundColor: c.background, color: c.text, fontFamily: bf, fontSize: '13px', lineHeight: 1.5 }}
    >
      {/* ── HEADER ── */}
      <header
        className="flex items-center justify-between px-5 py-3.5"
        style={{ borderBottom: `1px solid ${blend(c.text, 0.08)}` }}
      >
        <div className="flex items-center gap-2.5">
          {logoUrl ? (
            <img src={logoUrl} alt="" className="h-7 w-auto object-contain" />
          ) : (
            <div
              className="w-7 h-7 rounded-md flex items-center justify-center text-xs font-bold tracking-tight"
              style={{ backgroundColor: c.brand, color: c.button_text }}
            >
              {(storeName || 'S')[0]}
            </div>
          )}
          <span className="font-semibold text-[13px] tracking-tight" style={{ fontFamily: hf }}>
            {storeName || 'Your Store'}
          </span>
        </div>
        <nav className="flex items-center gap-4">
          {navLinks.map((link) => (
            <span key={link} className="text-[11px] font-medium" style={{ color: blend(c.text, 0.6) }}>
              {link}
            </span>
          ))}
          <svg className="w-4 h-4 ml-1" style={{ color: blend(c.text, 0.45) }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
          </svg>
        </nav>
      </header>

      {/* ── HERO ── */}
      <div
        className="px-8 py-14 text-center relative overflow-hidden"
        style={{
          background: `linear-gradient(135deg, ${blend(c.brand, 0.06)} 0%, ${blend(c.accent, 0.08)} 50%, ${blend(c.brand, 0.03)} 100%)`,
        }}
      >
        {/* Subtle decorative elements */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden>
          <div
            className="absolute -top-20 -right-20 w-64 h-64 rounded-full opacity-[0.04]"
            style={{ backgroundColor: c.brand }}
          />
          <div
            className="absolute -bottom-16 -left-16 w-48 h-48 rounded-full opacity-[0.03]"
            style={{ backgroundColor: c.accent }}
          />
        </div>

        <div className="relative">
          {/* Subtle chip above headline */}
          <span
            className="inline-block px-3 py-1 rounded-full text-[10px] font-semibold tracking-wide uppercase mb-4"
            style={{ backgroundColor: blend(c.brand, 0.08), color: c.brand }}
          >
            New Season
          </span>
          <h1
            className="text-[28px] font-bold leading-[1.15] mb-3 tracking-tight max-w-sm mx-auto"
            style={{ fontFamily: hf, color: c.text }}
          >
            {tagline || `Welcome to ${storeName || 'Your Store'}`}
          </h1>
          <p className="text-[12px] mb-6 max-w-xs mx-auto leading-relaxed" style={{ color: blend(c.text, 0.55) }}>
            Thoughtfully crafted products for people who care about the details
          </p>
          <span
            className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-lg text-[12px] font-semibold tracking-wide cursor-default"
            style={{
              backgroundColor: c.button,
              color: c.button_text,
              boxShadow: `0 1px 3px ${blend(c.button, 0.25)}`,
            }}
          >
            Shop Now
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
            </svg>
          </span>
        </div>
      </div>

      {/* ── PRODUCT GRID ── */}
      <div className="px-5 py-8">
        <div className="flex items-baseline justify-between mb-5">
          <h2 className="text-[15px] font-bold tracking-tight" style={{ fontFamily: hf }}>
            Bestsellers
          </h2>
          <span className="text-[11px] font-medium cursor-default" style={{ color: c.link }}>
            View all →
          </span>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {[
            { name: 'Artisan Candle', price: '$34', tag: 'Best Seller', gradient: ['#fde68a','#fbbf24'] },
            { name: 'Linen Throw', price: '$68', tag: null, gradient: ['#c7d2fe','#a5b4fc'] },
            { name: 'Stoneware Set', price: '$52', tag: 'New', gradient: ['#fecaca','#fca5a5'] },
          ].map((p) => (
            <div key={p.name} className="cursor-default group">
              <div
                className="aspect-[3/4] rounded-xl mb-2.5 relative overflow-hidden"
                style={{
                  background: `linear-gradient(145deg, ${p.gradient[0]}, ${p.gradient[1]})`,
                }}
              >
                {p.tag && (
                  <span
                    className="absolute top-2 left-2 px-2 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wider"
                    style={{
                      backgroundColor: c.background,
                      color: c.text,
                      boxShadow: `0 1px 4px ${blend(c.text, 0.1)}`,
                    }}
                  >
                    {p.tag}
                  </span>
                )}
              </div>
              <p className="text-[12px] font-semibold leading-tight" style={{ fontFamily: hf }}>{p.name}</p>
              <p className="text-[11px] mt-0.5" style={{ color: blend(c.text, 0.5) }}>{p.price}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── ANNOUNCEMENT BAR ── */}
      <div
        className="px-5 py-2.5 text-center text-[10px] font-semibold tracking-wide uppercase"
        style={{ backgroundColor: blend(c.accent, 0.1), color: c.accent }}
      >
        Free shipping on orders over $75
      </div>

      {/* ── FOOTER ── */}
      <footer
        className="px-5 py-4 flex items-center justify-between"
        style={{ borderTop: `1px solid ${blend(c.text, 0.06)}`, backgroundColor: blend(c.text, 0.02) }}
      >
        <span className="text-[10px]" style={{ color: blend(c.text, 0.35) }}>
          © 2026 {storeName || 'Your Store'}
        </span>
        <div className="flex gap-3">
          {['Privacy', 'Terms'].map((l) => (
            <span key={l} className="text-[10px]" style={{ color: c.link }}>{l}</span>
          ))}
        </div>
      </footer>
    </div>
  );
};


/* ═══════════════════════════════════════════════════════════════
   COLOR SWATCH
   ═══════════════════════════════════════════════════════════════ */
const ColorSwatch = ({ label, value, onChange }) => (
  <div className="flex items-center gap-2.5">
    <label className="relative w-8 h-8 rounded-lg overflow-hidden cursor-pointer ring-1 ring-gray-200 hover:ring-gray-300 transition-all hover:scale-110 shadow-sm">
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="absolute inset-0 w-[200%] h-[200%] -top-1/2 -left-1/2 cursor-pointer"
      />
      <span className="block w-full h-full" style={{ backgroundColor: value }} />
    </label>
    <div className="flex-1 min-w-0">
      <p className="text-[12px] font-medium text-gray-700 leading-tight">{label}</p>
      <input
        type="text"
        value={value.toUpperCase()}
        onChange={(e) => {
          const v = e.target.value;
          if (/^#[0-9a-fA-F]{0,6}$/.test(v)) onChange(v);
        }}
        className="text-[10px] text-gray-400 font-mono bg-transparent border-none p-0 focus:ring-0 focus:outline-none w-16 uppercase"
      />
    </div>
  </div>
);


/* ═══════════════════════════════════════════════════════════════
   FONT PICKER
   ═══════════════════════════════════════════════════════════════ */
const FontPicker = ({ label, description, value, fonts, onChange }) => {
  const cats = { 'sans-serif': 'Sans Serif', serif: 'Serif', monospace: 'Monospace' };
  const grouped = {};
  (fonts || []).forEach((f) => {
    const c = f.category || 'other';
    if (!grouped[c]) grouped[c] = [];
    grouped[c].push(f);
  });

  return (
    <div>
      <label className="block text-[12px] font-semibold text-gray-800 mb-0.5">{label}</label>
      {description && <p className="text-[11px] text-gray-400 mb-2 leading-relaxed">{description}</p>}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-[13px] focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
        style={{ fontFamily: ff(value) }}
      >
        {Object.entries(grouped).map(([cat, items]) => (
          <optgroup key={cat} label={cats[cat] || cat}>
            {items.map((f) => (
              <option key={f.name} value={f.name}>{f.label}</option>
            ))}
          </optgroup>
        ))}
      </select>
      <div
        className="mt-2.5 p-3 rounded-lg border border-gray-100 bg-gray-50/50"
        style={{ fontFamily: ff(value) }}
      >
        <p className="text-[15px] font-semibold text-gray-800 mb-1" style={{ fontFamily: ff(value) }}>
          Almost before we knew it
        </p>
        <p className="text-[12px] text-gray-500 leading-relaxed" style={{ fontFamily: ff(value) }}>
          The quick brown fox jumps over the lazy dog. Pack my box with five dozen liquor jugs. 0123456789
        </p>
      </div>
    </div>
  );
};


/* ═══════════════════════════════════════════════════════════════
   MENU EDITOR
   ═══════════════════════════════════════════════════════════════ */
const MenuEditor = ({ menu, registeredLocations, onSave, onDelete }) => {
  const [expanded, setExpanded] = useState(false);
  const [name, setName] = useState(menu.name);
  const [location, setLocation] = useState(menu.location || '');
  const [items, setItems] = useState(
    menu.items.map((it, i) => ({ label: it.label, url: it.url, temp_id: `e-${i}`, parent_temp_id: null }))
  );
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const addItem = () => setItems(p => [...p, { label: '', url: '/', temp_id: `n-${Date.now()}`, parent_temp_id: null }]);
  const handleSave = async () => {
    setSaving(true);
    try { await onSave(menu.id, { name, location, items }); }
    finally { setSaving(false); }
  };

  const locationLabel = registeredLocations?.[location];

  return (
    <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50/50 transition-colors text-left"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-7 h-7 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
            <svg className="w-3.5 h-3.5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </div>
          <div className="min-w-0">
            <p className="text-[13px] font-semibold text-gray-900 truncate">{menu.name}</p>
            <p className="text-[11px] text-gray-400">
              {menu.items.length} item{menu.items.length !== 1 ? 's' : ''}
              {locationLabel && <span className="text-primary-500"> · {locationLabel}</span>}
            </p>
          </div>
        </div>
        <svg
          className={`w-4 h-4 text-gray-400 transition-transform flex-shrink-0 ${expanded ? 'rotate-180' : ''}`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {expanded && (
        <div className="border-t border-gray-100">
          <div className="p-4 space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">Name</label>
                <input type="text" value={name} onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 px-2.5 py-1.5 text-[13px] focus:ring-2 focus:ring-primary-500 focus:border-transparent" />
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">Location</label>
                <select value={location} onChange={(e) => setLocation(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 px-2.5 py-1.5 text-[13px] focus:ring-2 focus:ring-primary-500 focus:border-transparent">
                  <option value="">None</option>
                  {Object.entries(registeredLocations || {}).map(([slug, label]) => (
                    <option key={slug} value={slug}>{label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Items</label>
              <div className="space-y-1.5">
                {items.map((item, idx) => (
                  <div key={item.temp_id} className="flex items-center gap-1.5">
                    <div className="w-5 flex justify-center flex-shrink-0">
                      <svg className="w-3 h-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
                      </svg>
                    </div>
                    <input type="text" value={item.label}
                      onChange={(e) => setItems(p => p.map((it, i) => i === idx ? { ...it, label: e.target.value } : it))}
                      placeholder="Label"
                      className="flex-1 rounded-lg border border-gray-200 px-2.5 py-1.5 text-[13px] focus:ring-2 focus:ring-primary-500 focus:border-transparent min-w-0" />
                    <input type="text" value={item.url}
                      onChange={(e) => setItems(p => p.map((it, i) => i === idx ? { ...it, url: e.target.value } : it))}
                      placeholder="/path"
                      className="flex-1 rounded-lg border border-gray-200 px-2.5 py-1.5 text-[13px] text-gray-500 focus:ring-2 focus:ring-primary-500 focus:border-transparent min-w-0" />
                    <button onClick={() => setItems(p => p.filter((_, i) => i !== idx))}
                      className="w-6 h-6 flex items-center justify-center rounded-md text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors flex-shrink-0">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
                {items.length === 0 && (
                  <p className="text-[11px] text-gray-400 text-center py-3 bg-gray-50 rounded-lg">No items yet — add your first link</p>
                )}
              </div>
              <button onClick={addItem}
                className="mt-2 flex items-center gap-1 text-[12px] text-primary-600 hover:text-primary-700 font-semibold">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Add item
              </button>
            </div>
          </div>

          <div className="px-4 py-2.5 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
            {confirmDelete ? (
              <div className="flex items-center gap-2">
                <button onClick={() => onDelete(menu.id)}
                  className="text-[11px] px-2.5 py-1 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium transition-colors">
                  Delete permanently
                </button>
                <button onClick={() => setConfirmDelete(false)} className="text-[11px] text-gray-500 hover:text-gray-700">Cancel</button>
              </div>
            ) : (
              <button onClick={() => setConfirmDelete(true)} className="text-[11px] text-gray-400 hover:text-red-500 font-medium transition-colors">
                Delete
              </button>
            )}
            <button onClick={handleSave} disabled={saving}
              className="px-4 py-1.5 bg-primary-600 text-white text-[12px] font-semibold rounded-lg hover:bg-primary-700 disabled:opacity-50 transition-colors shadow-sm">
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};


/* ═══════════════════════════════════════════════════════════════
   VERSION HISTORY
   ═══════════════════════════════════════════════════════════════ */
const VersionTimeline = ({ versions, onRestore }) => {
  const [restoring, setRestoring] = useState(null);

  if (!versions?.length) return (
    <div className="text-center py-12">
      <div className="w-12 h-12 mx-auto rounded-2xl bg-gray-100 flex items-center justify-center mb-3">
        <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>
      <p className="text-[13px] font-medium text-gray-500">No versions yet</p>
      <p className="text-[11px] text-gray-400 mt-1">A snapshot is saved each time you publish</p>
    </div>
  );

  return (
    <div className="space-y-1.5 max-h-[500px] overflow-y-auto">
      {versions.map((v, idx) => (
        <div key={idx} className="flex items-center gap-3 p-3 rounded-xl hover:bg-white transition-colors group">
          <div className="flex -space-x-1">
            {Object.values(v.settings?.colors || {}).slice(0, 4).map((c, ci) => (
              <span key={ci} className="w-5 h-5 rounded-full ring-2 ring-gray-50" style={{ backgroundColor: c }} />
            ))}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[12px] font-medium text-gray-700">
              {new Date(v.created_at + 'Z').toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
            </p>
            <p className="text-[10px] text-gray-400">{v.user}</p>
          </div>
          <button
            onClick={async () => { setRestoring(idx); try { await onRestore(idx); } finally { setRestoring(null); } }}
            disabled={restoring === idx}
            className="opacity-0 group-hover:opacity-100 text-[11px] font-semibold text-primary-600 hover:text-primary-700 disabled:opacity-50 px-2.5 py-1 rounded-lg hover:bg-primary-50 transition-all">
            {restoring === idx ? 'Restoring…' : 'Restore'}
          </button>
        </div>
      ))}
    </div>
  );
};


/* ═══════════════════════════════════════════════════════════════
   SECTION TABS
   ═══════════════════════════════════════════════════════════════ */
const SECTIONS = [
  { id: 'brand',      label: 'Brand',      icon: 'M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z' },
  { id: 'style',      label: 'Colors',     icon: 'M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01' },
  { id: 'typography', label: 'Fonts',      icon: 'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z' },
  { id: 'navigation', label: 'Menus',      icon: 'M4 6h16M4 12h16M4 18h7' },
  { id: 'history',    label: 'History',    icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z' },
];


/* ═══════════════════════════════════════════════════════════════
   MAIN PAGE
   ═══════════════════════════════════════════════════════════════ */
export default function DesignPage() {
  const [activeSection, setActiveSection] = useState('brand');
  const [showNewMenu, setShowNewMenu] = useState(false);
  const [newMenuName, setNewMenuName] = useState('');

  const { data: capabilities, isLoading: capLoading } = useDesignCapabilities();
  const { data: settings, isLoading: settingsLoading } = useDesignSettings();
  const { data: fonts } = useDesignFonts();
  const { data: menuData, isLoading: menusLoading } = useDesignMenus();
  const { data: versions } = useDesignVersions();
  const { data: store, isLoading: storeLoading } = useStore();

  const updateSettings = useUpdateDesignSettings();
  const applyToTheme = useApplyDesignToTheme();
  const restoreVersion = useRestoreDesignVersion();
  const createMenu = useCreateDesignMenu();
  const updateMenu = useUpdateDesignMenu();
  const deleteMenu = useDeleteDesignMenu();
  const updateStore = useUpdateStore();

  const [draft, setDraft] = useState(null);
  const [brandDraft, setBrandDraft] = useState(null);
  const savedDesignRef = useRef(null);
  const savedBrandRef = useRef(null);

  useEffect(() => {
    if (settings) {
      const snap = { colors: { ...settings.colors }, fonts: { ...settings.fonts } };
      setDraft(snap);
      savedDesignRef.current = JSON.stringify(snap);
    }
  }, [settings]);

  useEffect(() => {
    if (store) {
      const snap = { name: store.name || '', logo_url: store.logo_url || '', tagline: store.tagline || '' };
      setBrandDraft(snap);
      savedBrandRef.current = JSON.stringify(snap);
    }
  }, [store]);

  useFontLoader(draft?.fonts?.heading, draft?.fonts?.body);

  const designDirty = draft && savedDesignRef.current && JSON.stringify({ colors: draft.colors, fonts: draft.fonts }) !== savedDesignRef.current;
  const brandDirty = brandDraft && savedBrandRef.current && JSON.stringify(brandDraft) !== savedBrandRef.current;
  const isDirty = designDirty || brandDirty;

  const setColor = useCallback((k, v) => setDraft(p => p ? { ...p, colors: { ...p.colors, [k]: v } } : p), []);
  const setFont = useCallback((k, v) => setDraft(p => p ? { ...p, fonts: { ...p.fonts, [k]: v } } : p), []);
  const applyPalette = useCallback((colors) => setDraft(p => p ? { ...p, colors: { ...colors } } : p), []);
  const setBrand = useCallback((k, v) => setBrandDraft(p => p ? { ...p, [k]: v } : p), []);

  const handleSave = async () => {
    const promises = [];
    if (designDirty && draft)
      promises.push(new Promise((res, rej) => updateSettings.mutate({ colors: draft.colors, fonts: draft.fonts }, {
        onSuccess: () => { savedDesignRef.current = JSON.stringify({ colors: draft.colors, fonts: draft.fonts }); res(); }, onError: rej })));
    if (brandDirty && brandDraft)
      promises.push(new Promise((res, rej) => updateStore.mutate(brandDraft, {
        onSuccess: () => { savedBrandRef.current = JSON.stringify(brandDraft); res(); }, onError: rej })));
    await Promise.all(promises);
  };

  const handlePublish = async () => {
    if (isDirty) await handleSave();
    applyToTheme.mutate();
  };

  const handleCreateMenu = () => {
    if (!newMenuName.trim()) return;
    createMenu.mutate({ name: newMenuName.trim() });
    setNewMenuName(''); setShowNewMenu(false);
  };

  const handleLogoUpload = () => {
    if (window.wp?.media) {
      const frame = window.wp.media({ title: 'Choose Logo', multiple: false, library: { type: 'image' } });
      frame.on('select', () => { setBrand('logo_url', frame.state().get('selection').first().toJSON().url); });
      frame.open();
    } else {
      const url = prompt('Logo URL:', brandDraft?.logo_url || '');
      if (url !== null) setBrand('logo_url', url);
    }
  };

  const canPublish = capabilities?.is_block_theme;
  const isSaving = updateSettings.isPending || updateStore.isPending;
  const isPublishing = applyToTheme.isPending;
  const isLoading = capLoading || settingsLoading || storeLoading;

  const previewMenuItems = useMemo(() => {
    const hm = (menuData?.menus || []).find(m => m.location?.includes('header'));
    return hm?.items || [];
  }, [menuData]);

  if (isLoading) return <div className="flex items-center justify-center h-[80vh]"><LoadingSpinner /></div>;

  return (
    <div className="flex flex-col h-[calc(100vh-0px)] overflow-hidden bg-white">

      {/* ═══ TOP BAR ═══ */}
      <div className="flex items-center justify-between px-5 py-2.5 border-b border-gray-200 flex-shrink-0 z-10 bg-white">
        <div className="flex items-center gap-3">
          <h1 className="text-[15px] font-bold text-gray-900">Design</h1>
          {!capabilities?.is_block_theme && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-warning-50 border border-warning-200/80 rounded-md text-[10px] text-warning-700 font-semibold">
              ⚠ Classic theme — preview only
            </span>
          )}
          {settings?.applied_at && (
            <span className="text-[10px] text-gray-400 font-medium">
              Published {new Date(settings.applied_at + 'Z').toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {isDirty && (
            <span className="flex items-center gap-1.5 text-[11px] text-primary-600 font-semibold mr-1">
              <span className="w-1.5 h-1.5 rounded-full bg-primary-500 animate-pulse" />
              Unsaved
            </span>
          )}
          <button onClick={handleSave} disabled={!isDirty || isSaving}
            className="px-3.5 py-1.5 bg-white border border-gray-300 text-gray-700 text-[12px] font-semibold rounded-lg hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-sm">
            {isSaving ? 'Saving…' : 'Save Draft'}
          </button>
          <button onClick={handlePublish} disabled={!canPublish || isPublishing}
            className="px-4 py-1.5 bg-primary-600 text-white text-[12px] font-semibold rounded-lg hover:bg-primary-700 disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-sm flex items-center gap-1.5"
            title={!canPublish ? 'Requires a block theme' : undefined}>
            {isPublishing ? (
              <><svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"/></svg> Publishing…</>
            ) : (
              <><svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path d="M5 3l14 9-14 9V3z"/></svg> Publish to Store</>
            )}
          </button>
        </div>
      </div>

      {/* ═══ SPLIT LAYOUT ═══ */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── LEFT PANEL ── */}
        <div className="w-[360px] flex-shrink-0 border-r border-gray-100 bg-gray-50/40 flex flex-col overflow-hidden">

          {/* Tabs */}
          <div className="flex border-b border-gray-200 bg-white flex-shrink-0 overflow-x-auto">
            {SECTIONS.map((s) => (
              <button key={s.id} onClick={() => setActiveSection(s.id)}
                className={`flex items-center gap-1.5 px-3 py-2.5 text-[11px] font-semibold whitespace-nowrap border-b-2 transition-all ${
                  activeSection === s.id
                    ? 'border-primary-600 text-primary-700 bg-primary-50/30'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                }`}>
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={s.icon} />
                </svg>
                {s.label}
              </button>
            ))}
          </div>

          {/* Scrollable controls */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">

            {/* ═══ BRAND ═══ */}
            {activeSection === 'brand' && brandDraft && (
              <>
                <div className="mb-1">
                  <h2 className="text-[13px] font-bold text-gray-900">Brand Identity</h2>
                  <p className="text-[11px] text-gray-400 mt-0.5">How your store looks to customers</p>
                </div>

                {/* Logo */}
                <div className="bg-white rounded-xl border border-gray-200 p-4">
                  <p className="text-[12px] font-semibold text-gray-700 mb-3">Logo</p>
                  {brandDraft.logo_url ? (
                    <div className="flex items-center gap-3">
                      <div className="w-14 h-14 rounded-xl bg-gray-50 border border-gray-200 flex items-center justify-center overflow-hidden">
                        <img src={brandDraft.logo_url} alt="" className="max-w-full max-h-full object-contain" />
                      </div>
                      <div className="space-y-1">
                        <button onClick={handleLogoUpload} className="block text-[11px] text-primary-600 hover:text-primary-700 font-semibold">Replace</button>
                        <button onClick={() => setBrand('logo_url', '')} className="block text-[11px] text-gray-400 hover:text-red-500 font-medium">Remove</button>
                      </div>
                    </div>
                  ) : (
                    <button onClick={handleLogoUpload}
                      className="w-full flex flex-col items-center gap-2 py-6 border-2 border-dashed border-gray-200 rounded-xl hover:border-primary-300 hover:bg-primary-50/30 transition-all group">
                      <div className="w-9 h-9 rounded-xl bg-gray-100 group-hover:bg-primary-100 flex items-center justify-center transition-colors">
                        <svg className="w-4 h-4 text-gray-400 group-hover:text-primary-600 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
                        </svg>
                      </div>
                      <span className="text-[11px] font-semibold text-gray-400 group-hover:text-primary-600 transition-colors">Upload logo</span>
                    </button>
                  )}
                </div>

                <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
                  <div>
                    <label className="block text-[12px] font-semibold text-gray-700 mb-1">Store Name</label>
                    <input type="text" value={brandDraft.name} onChange={(e) => setBrand('name', e.target.value)}
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-[13px] focus:ring-2 focus:ring-primary-500 focus:border-transparent" placeholder="Your Store Name" />
                  </div>
                  <div>
                    <label className="block text-[12px] font-semibold text-gray-700 mb-1">Tagline</label>
                    <input type="text" value={brandDraft.tagline} onChange={(e) => setBrand('tagline', e.target.value)}
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-[13px] focus:ring-2 focus:ring-primary-500 focus:border-transparent" placeholder="Short description or slogan" />
                    <p className="text-[10px] text-gray-400 mt-1">Displayed in your store header and search results</p>
                  </div>
                </div>
              </>
            )}

            {/* ═══ COLORS ═══ */}
            {activeSection === 'style' && draft && (
              <>
                <div className="mb-1">
                  <h2 className="text-[13px] font-bold text-gray-900">Color Palette</h2>
                  <p className="text-[11px] text-gray-400 mt-0.5">Start with a preset, then customize</p>
                </div>

                {/* Palette grid */}
                <div className="bg-white rounded-xl border border-gray-200 p-3">
                  <div className="grid grid-cols-4 gap-1.5">
                    {PALETTES.map((p) => {
                      const active = p.colors.brand === draft.colors.brand && p.colors.accent === draft.colors.accent && p.colors.background === draft.colors.background;
                      return (
                        <button key={p.name} onClick={() => applyPalette(p.colors)}
                          className={`flex flex-col items-center gap-1.5 p-2 rounded-xl transition-all ${
                            active ? 'ring-2 ring-primary-500 bg-primary-50/50' : 'hover:bg-gray-50'
                          }`}>
                          <div className="flex -space-x-0.5">
                            <span className="w-5 h-5 rounded-full ring-1 ring-white shadow-sm" style={{ backgroundColor: p.colors.brand }} />
                            <span className="w-5 h-5 rounded-full ring-1 ring-white shadow-sm" style={{ backgroundColor: p.colors.accent }} />
                            <span className="w-5 h-5 rounded-full ring-1 ring-white shadow-sm" style={{ backgroundColor: p.colors.background, border: '1px solid #e5e7eb' }} />
                          </div>
                          <span className="text-[10px] font-semibold text-gray-500">{p.name}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="bg-white rounded-xl border border-gray-200 p-4">
                  <p className="text-[12px] font-semibold text-gray-700 mb-3">Fine-tune</p>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                    <ColorSwatch label="Brand" value={draft.colors.brand} onChange={(v) => setColor('brand', v)} />
                    <ColorSwatch label="Accent" value={draft.colors.accent} onChange={(v) => setColor('accent', v)} />
                    <ColorSwatch label="Text" value={draft.colors.text} onChange={(v) => setColor('text', v)} />
                    <ColorSwatch label="Background" value={draft.colors.background} onChange={(v) => setColor('background', v)} />
                    <ColorSwatch label="Links" value={draft.colors.link} onChange={(v) => setColor('link', v)} />
                    <ColorSwatch label="Buttons" value={draft.colors.button} onChange={(v) => setColor('button', v)} />
                    <ColorSwatch label="Button Text" value={draft.colors.button_text} onChange={(v) => setColor('button_text', v)} />
                  </div>
                </div>
              </>
            )}

            {/* ═══ TYPOGRAPHY ═══ */}
            {activeSection === 'typography' && draft && (
              <>
                <div className="mb-1">
                  <h2 className="text-[13px] font-bold text-gray-900">Typography</h2>
                  <p className="text-[11px] text-gray-400 mt-0.5">Fonts that define your brand's voice</p>
                </div>

                <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-5">
                  <FontPicker label="Headings" description="Product names, page titles, section headers"
                    value={draft.fonts.heading} fonts={fonts} onChange={(v) => setFont('heading', v)} />
                  <div className="border-t border-gray-100" />
                  <FontPicker label="Body" description="Descriptions, paragraphs, labels"
                    value={draft.fonts.body} fonts={fonts} onChange={(v) => setFont('body', v)} />
                </div>

                <div className="rounded-xl bg-gradient-to-br from-primary-50 to-primary-50 border border-primary-100 p-3.5">
                  <p className="text-[11px] text-primary-800 font-semibold mb-1">💡 Pairing tip</p>
                  <p className="text-[11px] text-primary-600/80 leading-relaxed">
                    Serif headings + sans-serif body is a timeless combination. Try Playfair Display with DM Sans for a modern editorial feel.
                  </p>
                </div>
              </>
            )}

            {/* ═══ NAVIGATION ═══ */}
            {activeSection === 'navigation' && (
              <>
                <div className="flex items-start justify-between mb-1">
                  <div>
                    <h2 className="text-[13px] font-bold text-gray-900">Navigation</h2>
                    <p className="text-[11px] text-gray-400 mt-0.5">Your store header and footer menus</p>
                  </div>
                  <button onClick={() => setShowNewMenu(true)}
                    className="px-2.5 py-1 bg-primary-600 text-white text-[11px] font-semibold rounded-lg hover:bg-primary-700 transition-colors flex items-center gap-1 shadow-sm">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                    </svg>
                    New Menu
                  </button>
                </div>

                {showNewMenu && (
                  <div className="bg-white rounded-xl border-2 border-primary-200 p-3 flex items-center gap-2">
                    <input type="text" value={newMenuName} onChange={(e) => setNewMenuName(e.target.value)}
                      placeholder="Menu name" autoFocus onKeyDown={(e) => e.key === 'Enter' && handleCreateMenu()}
                      className="flex-1 rounded-lg border border-gray-200 px-3 py-1.5 text-[13px] focus:ring-2 focus:ring-primary-500 focus:border-transparent" />
                    <button onClick={handleCreateMenu} disabled={!newMenuName.trim()}
                      className="px-3 py-1.5 bg-primary-600 text-white text-[11px] font-semibold rounded-lg hover:bg-primary-700 disabled:opacity-50">Create</button>
                    <button onClick={() => { setShowNewMenu(false); setNewMenuName(''); }}
                      className="text-[11px] text-gray-500 hover:text-gray-700 px-1">Cancel</button>
                  </div>
                )}

                {menusLoading ? (
                  <div className="flex justify-center py-8"><LoadingSpinner /></div>
                ) : (menuData?.menus || []).length === 0 ? (
                  <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
                    <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center mx-auto mb-3">
                      <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 12h16M4 18h7" />
                      </svg>
                    </div>
                    <p className="text-[13px] font-medium text-gray-500">No menus yet</p>
                    <p className="text-[11px] text-gray-400 mt-0.5">Create one to add links to your store header or footer</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {(menuData.menus || []).map((menu) => (
                      <MenuEditor key={menu.id} menu={menu} registeredLocations={menuData.registered_locations}
                        onSave={(id, data) => updateMenu.mutateAsync({ id, data })}
                        onDelete={(id) => deleteMenu.mutate(id)} />
                    ))}
                  </div>
                )}

                <div className="bg-gray-100/60 rounded-xl p-3">
                  <p className="text-[11px] text-gray-500 leading-relaxed">
                    Assign menus to a <strong>Header</strong> or <strong>Footer</strong> location, then publish to update your live store.
                  </p>
                </div>
              </>
            )}

            {/* ═══ HISTORY ═══ */}
            {activeSection === 'history' && (
              <>
                <div className="mb-1">
                  <h2 className="text-[13px] font-bold text-gray-900">Version History</h2>
                  <p className="text-[11px] text-gray-400 mt-0.5">Every publish saves a snapshot you can restore</p>
                </div>
                <VersionTimeline versions={versions} onRestore={(idx) => restoreVersion.mutateAsync(idx)} />
              </>
            )}
          </div>
        </div>

        {/* ── RIGHT: PREVIEW ── */}
        <div className="flex-1 bg-gray-100 flex flex-col overflow-hidden">

          {/* Preview toolbar */}
          <div className="flex items-center justify-between px-4 py-2 bg-white border-b border-gray-200 flex-shrink-0">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Preview</span>
              <span className="text-[10px] text-gray-300">·</span>
              <span className="text-[11px] text-gray-400 font-mono">
                {(typeof window !== 'undefined' && window.bluSettings?.siteUrl?.replace(/^https?:\/\//, '')) || 'yourstore.com'}
              </span>
            </div>
            {(typeof window !== 'undefined' && window.bluSettings?.siteUrl) && (
              <a href={window.bluSettings.siteUrl} target="_blank" rel="noopener noreferrer"
                className="text-[11px] text-gray-400 hover:text-primary-600 transition-colors flex items-center gap-1 font-medium">
                Open live store
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>
            )}
          </div>

          {/* Preview content */}
          <div className="flex-1 overflow-y-auto p-6">
            <div className="max-w-xl mx-auto">
              {draft && (
                <div className="rounded-xl overflow-hidden shadow-xl ring-1 ring-gray-200/50">
                  <StorefrontPreview
                    draft={draft}
                    storeName={brandDraft?.name}
                    logoUrl={brandDraft?.logo_url}
                    tagline={brandDraft?.tagline}
                    menuItems={previewMenuItems}
                  />
                </div>
              )}
              <p className="text-center text-[10px] text-gray-400 mt-4">
                Changes update in real time · Publish to apply to your live store
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
