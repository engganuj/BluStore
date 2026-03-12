import { useState } from 'react';
import { useWPPages, useCreateWPPage, useUpdateWPPage, useTrashWPPage, wpAdminUrl } from '../hooks/useAPI';
import { PageHeader, Card, EmptyState, LoadingSpinner, Button, Modal } from '../components/shared';
import toast from 'react-hot-toast';

const statusColors = {
  publish: { bg: 'bg-success-50', text: 'text-success-700', dot: 'bg-success-500', label: 'Published' },
  draft: { bg: 'bg-gray-50', text: 'text-gray-600', dot: 'bg-gray-400', label: 'Draft' },
  future: { bg: 'bg-primary-50', text: 'text-primary-700', dot: 'bg-primary-500', label: 'Scheduled' },
  private: { bg: 'bg-warning-50', text: 'text-warning-700', dot: 'bg-warning-500', label: 'Private' },
  pending: { bg: 'bg-primary-50', text: 'text-primary-700', dot: 'bg-primary-500', label: 'Pending' },
};

// WooCommerce pages that are template-driven.
const wooTemplatePages = {
  'shop':           'archive-product',
  'cart':           'page-cart',
  'checkout':       'page-checkout',
  'my-account':     'page-my-account',
};

const siteEditorUrl = (templateSlug) => {
  const theme = window.bluSettings?.theme || 'blu-theme';
  const templatePath = encodeURIComponent(`/wp_template/${theme}//${templateSlug}`);
  return wpAdminUrl(`site-editor.php?p=${templatePath}&canvas=edit`);
};

const getEditUrl = (page) => {
  const slug = (page.slug || '').toLowerCase();
  const templateSlug = wooTemplatePages[slug];
  if (templateSlug) return siteEditorUrl(templateSlug);
  return wpAdminUrl(`post.php?post=${page.id}&action=edit`);
};

const recommendedPages = [
  {
    title: 'About Us',
    slug: 'about',
    icon: '👋',
    matchKeywords: ['about'],
    description: 'Tell your story and build trust with customers',
    content: `<!-- wp:heading -->\n<h2>Our Story</h2>\n<!-- /wp:heading -->\n\n<!-- wp:paragraph -->\n<p>Share your brand's story here — how you started, what drives you, and why customers should choose you.</p>\n<!-- /wp:paragraph -->\n\n<!-- wp:heading -->\n<h2>Our Mission</h2>\n<!-- /wp:heading -->\n\n<!-- wp:paragraph -->\n<p>Describe your mission and the values that guide your business.</p>\n<!-- /wp:paragraph -->`,
  },
  {
    title: 'Contact Us',
    slug: 'contact',
    icon: '✉️',
    matchKeywords: ['contact'],
    description: 'Let customers reach you easily',
    content: `<!-- wp:heading -->\n<h2>Get in Touch</h2>\n<!-- /wp:heading -->\n\n<!-- wp:paragraph -->\n<p>We'd love to hear from you. Reach out with any questions, feedback, or inquiries.</p>\n<!-- /wp:paragraph -->\n\n<!-- wp:columns -->\n<div class="wp-block-columns"><!-- wp:column -->\n<div class="wp-block-column"><!-- wp:heading {"level":3} -->\n<h3>Email</h3>\n<!-- /wp:heading -->\n\n<!-- wp:paragraph -->\n<p>support@yourstore.com</p>\n<!-- /wp:paragraph --></div>\n<!-- /wp:column -->\n\n<!-- wp:column -->\n<div class="wp-block-column"><!-- wp:heading {"level":3} -->\n<h3>Phone</h3>\n<!-- /wp:heading -->\n\n<!-- wp:paragraph -->\n<p>(555) 000-0000</p>\n<!-- /wp:paragraph --></div>\n<!-- /wp:column -->\n\n<!-- wp:column -->\n<div class="wp-block-column"><!-- wp:heading {"level":3} -->\n<h3>Hours</h3>\n<!-- /wp:heading -->\n\n<!-- wp:paragraph -->\n<p>Mon–Fri: 9am – 5pm</p>\n<!-- /wp:paragraph --></div>\n<!-- /wp:column --></div>\n<!-- /wp:columns -->`,
  },
  {
    title: 'FAQ',
    slug: 'faq',
    icon: '❓',
    matchKeywords: ['faq', 'frequently-asked', 'questions'],
    description: 'Answer common customer questions',
    content: `<!-- wp:heading -->\n<h2>Frequently Asked Questions</h2>\n<!-- /wp:heading -->\n\n<!-- wp:heading {"level":3} -->\n<h3>How long does shipping take?</h3>\n<!-- /wp:heading -->\n\n<!-- wp:paragraph -->\n<p>Standard shipping takes 5–7 business days. Expedited options are available at checkout.</p>\n<!-- /wp:paragraph -->\n\n<!-- wp:heading {"level":3} -->\n<h3>What is your return policy?</h3>\n<!-- /wp:heading -->\n\n<!-- wp:paragraph -->\n<p>We accept returns within 30 days of purchase. Items must be in original condition.</p>\n<!-- /wp:paragraph -->\n\n<!-- wp:heading {"level":3} -->\n<h3>Do you ship internationally?</h3>\n<!-- /wp:heading -->\n\n<!-- wp:paragraph -->\n<p>Yes! We ship to most countries. International shipping times vary by destination.</p>\n<!-- /wp:paragraph -->`,
  },
  {
    title: 'Shipping Policy',
    slug: 'shipping-policy',
    icon: '🚚',
    matchKeywords: ['shipping'],
    description: 'Set clear expectations for delivery',
    content: `<!-- wp:heading -->\n<h2>Shipping Policy</h2>\n<!-- /wp:heading -->\n\n<!-- wp:paragraph -->\n<p>We want to get your order to you as quickly as possible. Here's what to expect.</p>\n<!-- /wp:paragraph -->\n\n<!-- wp:heading {"level":3} -->\n<h3>Processing Time</h3>\n<!-- /wp:heading -->\n\n<!-- wp:paragraph -->\n<p>Orders are processed within 1–2 business days.</p>\n<!-- /wp:paragraph -->\n\n<!-- wp:heading {"level":3} -->\n<h3>Shipping Rates</h3>\n<!-- /wp:heading -->\n\n<!-- wp:paragraph -->\n<p>Free standard shipping on orders over $50. Flat rate $5.99 for all other orders.</p>\n<!-- /wp:paragraph -->`,
  },
  {
    title: 'Return & Refund Policy',
    slug: 'returns',
    icon: '↩️',
    matchKeywords: ['return', 'refund', 'exchange'],
    description: 'Build confidence with a clear return policy',
    content: `<!-- wp:heading -->\n<h2>Return & Refund Policy</h2>\n<!-- /wp:heading -->\n\n<!-- wp:paragraph -->\n<p>Your satisfaction is our priority. If you're not happy with your purchase, we're here to help.</p>\n<!-- /wp:paragraph -->\n\n<!-- wp:heading {"level":3} -->\n<h3>Returns</h3>\n<!-- /wp:heading -->\n\n<!-- wp:paragraph -->\n<p>Items may be returned within 30 days of delivery in their original, unused condition.</p>\n<!-- /wp:paragraph -->\n\n<!-- wp:heading {"level":3} -->\n<h3>Refunds</h3>\n<!-- /wp:heading -->\n\n<!-- wp:paragraph -->\n<p>Refunds are processed within 5–7 business days after we receive the returned item.</p>\n<!-- /wp:paragraph -->`,
  },
  {
    title: 'Privacy Policy',
    slug: 'privacy-policy',
    icon: '🔒',
    matchKeywords: ['privacy'],
    description: 'Required for most stores — explain data handling',
    content: `<!-- wp:heading -->\n<h2>Privacy Policy</h2>\n<!-- /wp:heading -->\n\n<!-- wp:paragraph -->\n<p>This Privacy Policy describes how your personal information is collected, used, and shared when you visit or make a purchase from our store.</p>\n<!-- /wp:paragraph -->\n\n<!-- wp:heading {"level":3} -->\n<h3>Information We Collect</h3>\n<!-- /wp:heading -->\n\n<!-- wp:paragraph -->\n<p>When you visit the site, we automatically collect certain information about your device. When you make a purchase, we collect your name, billing address, shipping address, payment information, and email address.</p>\n<!-- /wp:paragraph -->\n\n<!-- wp:heading {"level":3} -->\n<h3>How We Use Your Information</h3>\n<!-- /wp:heading -->\n\n<!-- wp:paragraph -->\n<p>We use the information we collect to fulfill orders, communicate with you, and improve our store.</p>\n<!-- /wp:paragraph -->`,
  },
  {
    title: 'Terms of Service',
    slug: 'terms',
    icon: '📋',
    matchKeywords: ['terms', 'tos', 'conditions'],
    description: 'Protect your business with clear terms',
    content: `<!-- wp:heading -->\n<h2>Terms of Service</h2>\n<!-- /wp:heading -->\n\n<!-- wp:paragraph -->\n<p>By accessing or using our store, you agree to be bound by these Terms of Service.</p>\n<!-- /wp:paragraph -->\n\n<!-- wp:heading {"level":3} -->\n<h3>Online Store Terms</h3>\n<!-- /wp:heading -->\n\n<!-- wp:paragraph -->\n<p>By agreeing to these Terms of Service, you represent that you are at least the age of majority in your state or province of residence.</p>\n<!-- /wp:paragraph -->\n\n<!-- wp:heading {"level":3} -->\n<h3>Accuracy of Information</h3>\n<!-- /wp:heading -->\n\n<!-- wp:paragraph -->\n<p>We are not responsible if information made available on this site is not accurate, complete, or current.</p>\n<!-- /wp:paragraph -->`,
  },
  {
    title: 'Store Locator',
    slug: 'store-locator',
    icon: '📍',
    matchKeywords: ['store-locator', 'locations', 'find-a-store', 'find-us'],
    description: 'Help customers find your physical locations',
    content: `<!-- wp:heading -->\n<h2>Find a Store</h2>\n<!-- /wp:heading -->\n\n<!-- wp:paragraph -->\n<p>Visit us in person at one of our locations.</p>\n<!-- /wp:paragraph -->\n\n<!-- wp:columns -->\n<div class="wp-block-columns"><!-- wp:column -->\n<div class="wp-block-column"><!-- wp:heading {"level":3} -->\n<h3>Main Store</h3>\n<!-- /wp:heading -->\n\n<!-- wp:paragraph -->\n<p>123 Main Street<br>Your City, ST 12345<br>Mon–Sat: 10am – 7pm<br>Sun: 11am – 5pm</p>\n<!-- /wp:paragraph --></div>\n<!-- /wp:column -->\n\n<!-- wp:column -->\n<div class="wp-block-column"><!-- wp:heading {"level":3} -->\n<h3>Downtown Location</h3>\n<!-- /wp:heading -->\n\n<!-- wp:paragraph -->\n<p>456 Commerce Ave<br>Your City, ST 12345<br>Mon–Fri: 9am – 6pm<br>Sat: 10am – 4pm</p>\n<!-- /wp:paragraph --></div>\n<!-- /wp:column --></div>\n<!-- /wp:columns -->`,
  },
];

function PagesPage() {
  const { data: pages, isLoading } = useWPPages();
  const createPage = useCreateWPPage();
  const updatePage = useUpdateWPPage();
  const trashPage = useTrashWPPage();
  const [trashConfirm, setTrashConfirm] = useState(null);
  const [creatingSlug, setCreatingSlug] = useState(null);
  const [selected, setSelected] = useState(new Set());
  const [bulkAction, setBulkAction] = useState('');
  const [bulkConfirm, setBulkConfirm] = useState(false);
  const [bulkProcessing, setBulkProcessing] = useState(false);
  const [scheduleModal, setScheduleModal] = useState(null);
  const [scheduleDate, setScheduleDate] = useState('');
  const [scheduleTime, setScheduleTime] = useState('09:00');
  const [actionMenu, setActionMenu] = useState(null);

  const handleCreateBlank = async () => {
    try {
      const result = await createPage.mutateAsync({
        title: 'Untitled Page',
        status: 'draft',
        content: '',
      });
      const newPageId = result?.data?.id;
      if (newPageId) {
        window.location.href = wpAdminUrl(`post.php?post=${newPageId}&action=edit`);
      }
    } catch (e) {
      // handled by hook
    }
  };

  const handleCreateRecommended = async (template) => {
    setCreatingSlug(template.slug);
    try {
      const result = await createPage.mutateAsync({
        title: template.title,
        slug: template.slug,
        status: 'draft',
        content: template.content,
      });
      const newPageId = result?.data?.id;
      if (newPageId) {
        toast.success(`"${template.title}" created — opening editor`);
        window.location.href = wpAdminUrl(`post.php?post=${newPageId}&action=edit`);
      }
    } catch (e) {
      // handled by hook
    } finally {
      setCreatingSlug(null);
    }
  };

  const handleTrash = (id) => {
    trashPage.mutate(id);
    setTrashConfirm(null);
  };

  const handlePublish = async (id) => {
    try {
      await updatePage.mutateAsync({ id, data: { status: 'publish' } });
      toast.success('Page published!');
    } catch (e) { /* handled by hook */ }
    setActionMenu(null);
  };

  const handleRevertDraft = async (id) => {
    try {
      await updatePage.mutateAsync({ id, data: { status: 'draft' } });
      toast.success('Page reverted to draft');
    } catch (e) { /* handled by hook */ }
    setActionMenu(null);
  };

  const handleScheduleOpen = (page) => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    setScheduleDate(tomorrow.toISOString().split('T')[0]);
    setScheduleTime('09:00');
    setScheduleModal(page.id);
    setActionMenu(null);
  };

  const handleScheduleConfirm = async () => {
    if (!scheduleDate || !scheduleTime || !scheduleModal) return;
    const dateTime = `${scheduleDate}T${scheduleTime}:00`;
    try {
      await updatePage.mutateAsync({ id: scheduleModal, data: { status: 'future', date: dateTime } });
      toast.success('Page scheduled!');
    } catch (e) { /* handled by hook */ }
    setScheduleModal(null);
  };

  const toggleSelect = (id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (!pages) return;
    if (selected.size === pages.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(pages.map((p) => p.id)));
    }
  };

  const handleBulkApply = () => {
    if (!bulkAction || selected.size === 0) return;
    setBulkConfirm(true);
  };

  const handleBulkConfirm = async () => {
    setBulkConfirm(false);
    setBulkProcessing(true);

    const ids = [...selected];

    if (bulkAction === 'trash') {
      let trashed = 0;
      for (const id of ids) {
        try { await trashPage.mutateAsync(id); trashed++; } catch (e) { /* continue */ }
      }
      if (trashed > 0) toast.success(`${trashed} page${trashed > 1 ? 's' : ''} moved to trash`);
    } else if (bulkAction === 'publish') {
      let published = 0;
      for (const id of ids) {
        try { await updatePage.mutateAsync({ id, data: { status: 'publish' } }); published++; } catch (e) { /* continue */ }
      }
      if (published > 0) toast.success(`${published} page${published > 1 ? 's' : ''} published`);
    } else if (bulkAction === 'draft') {
      let drafted = 0;
      for (const id of ids) {
        try { await updatePage.mutateAsync({ id, data: { status: 'draft' } }); drafted++; } catch (e) { /* continue */ }
      }
      if (drafted > 0) toast.success(`${drafted} page${drafted > 1 ? 's' : ''} reverted to draft`);
    }

    setSelected(new Set());
    setBulkAction('');
    setBulkProcessing(false);
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const existingPages = pages || [];
  const existingSlugs = existingPages.map((p) => (p.slug || '').toLowerCase());
  const existingTitles = existingPages.map((p) => (p.title?.rendered || '').toLowerCase());

  const pageAlreadyExists = (template) => {
    const keywords = template.matchKeywords || [template.slug];
    return keywords.some((kw) => {
      const k = kw.toLowerCase();
      return (
        existingSlugs.some((s) => s && (s.includes(k) || k.includes(s))) ||
        existingTitles.some((t) => t && t.includes(k))
      );
    });
  };

  const missingRecommended = recommendedPages.filter((r) => !pageAlreadyExists(r));
  const allSelected = pages && pages.length > 0 && selected.size === pages.length;

  return (
    <div className="max-w-5xl mx-auto px-4 py-4 sm:p-6">
      <PageHeader
        title="Pages"
        subtitle="Manage your store pages"
        action={{
          label: createPage.isPending && !creatingSlug ? 'Creating...' : 'New Page',
          onClick: handleCreateBlank,
          icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>,
        }}
      />

      {/* Recommended Pages */}
      {missingRecommended.length > 0 && (
        <div className="mb-8">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Recommended Store Pages</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {missingRecommended.map((template) => (
              <button
                key={template.slug}
                onClick={() => handleCreateRecommended(template)}
                disabled={creatingSlug === template.slug}
                className="flex items-start gap-3 p-4 bg-white rounded-xl border border-gray-200 hover:border-primary-300 hover:shadow-sm text-left transition-all disabled:opacity-50 group"
              >
                <span className="text-2xl flex-shrink-0 mt-0.5">{template.icon}</span>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900 group-hover:text-primary-700 transition-colors">
                    {creatingSlug === template.slug ? 'Creating...' : template.title}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{template.description}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Existing Pages */}
      {isLoading ? (
        <Card>
          <div className="flex items-center justify-center py-20">
            <LoadingSpinner />
          </div>
        </Card>
      ) : !pages || pages.length === 0 ? (
        <Card>
          <div className="py-8">
            <EmptyState
              icon={
                <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
              }
              title="No pages yet"
              description="Create pages for your store using the recommended templates above, or start from a blank page."
            />
          </div>
        </Card>
      ) : (
        <Card>
          {/* Bulk Actions Bar */}
          {selected.size > 0 && (
            <div className="flex items-center gap-3 px-6 py-3 bg-primary-50 border-b border-primary-100">
              <span className="text-sm font-medium text-primary-700">
                {selected.size} selected
              </span>
              <select
                value={bulkAction}
                onChange={(e) => setBulkAction(e.target.value)}
                className="text-sm border border-primary-200 rounded-lg px-3 py-1.5 bg-white text-gray-700 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              >
                <option value="">Bulk Actions</option>
                <option value="publish">Publish</option>
                <option value="draft">Revert to Draft</option>
                <option value="trash">Move to Trash</option>
              </select>
              <button
                onClick={handleBulkApply}
                disabled={!bulkAction || bulkProcessing}
                className="px-3 py-1.5 text-sm font-medium text-primary-700 bg-white border border-primary-200 rounded-lg hover:bg-primary-100 disabled:opacity-50 transition-colors"
              >
                {bulkProcessing ? 'Processing...' : 'Apply'}
              </button>
              <button
                onClick={() => { setSelected(new Set()); setBulkAction(''); }}
                className="ml-auto text-sm text-primary-600 hover:text-primary-800 font-medium"
              >
                Clear selection
              </button>
            </div>
          )}

          {/* Bulk Confirm Modal */}
          {bulkConfirm && (
            <Modal
              open
              onClose={() => setBulkConfirm(false)}
              title="Confirm Bulk Action"
              size="sm"
              footer={
                <div className="flex justify-end gap-3">
                  <Button variant="secondary" onClick={() => setBulkConfirm(false)}>
                    Cancel
                  </Button>
                  <Button
                    variant={bulkAction === 'trash' ? 'danger' : 'primary'}
                    onClick={handleBulkConfirm}
                  >
                    {bulkAction === 'trash' ? 'Move to Trash' : bulkAction === 'publish' ? 'Publish' : 'Revert to Draft'}
                  </Button>
                </div>
              }
            >
              <p className="text-sm text-gray-600">
                {bulkAction === 'trash' && `Are you sure you want to move ${selected.size} page${selected.size > 1 ? 's' : ''} to the trash?`}
                {bulkAction === 'publish' && `Publish ${selected.size} page${selected.size > 1 ? 's' : ''}?`}
                {bulkAction === 'draft' && `Revert ${selected.size} page${selected.size > 1 ? 's' : ''} to draft?`}
              </p>
            </Modal>
          )}

          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="w-10 px-4 py-3">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleSelectAll}
                    className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  />
                </th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">Page</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">Status</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">Modified</th>
                <th className="text-right text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {pages.map((page) => {
                const status = statusColors[page.status] || statusColors.draft;
                const title = page.title?.rendered || 'Untitled';
                const editUrl = getEditUrl(page);
                const isTemplatePage = !!wooTemplatePages[(page.slug || '').toLowerCase()];
                const viewUrl = page.link;
                const isSelected = selected.has(page.id);

                return (
                  <tr
                    key={page.id}
                    className={`transition-colors group ${isSelected ? 'bg-primary-50/50' : 'hover:bg-gray-50'}`}
                  >
                    <td className="w-10 px-4 py-4">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelect(page.id)}
                        className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                      />
                    </td>
                    <td className="px-4 py-4">
                      <a
                        href={editUrl}
                        className="text-sm font-medium text-gray-900 hover:text-primary-600 transition-colors"
                        dangerouslySetInnerHTML={{ __html: title }}
                      />
                      {page.slug && (
                        <p className="text-xs text-gray-400 mt-0.5">/{page.slug}</p>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${status.bg} ${status.text}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${status.dot}`} />
                        {status.label}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-sm text-gray-500">
                      {formatDate(page.modified)}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {(page.status === 'draft' || page.status === 'pending') && (
                          <button
                            onClick={() => handlePublish(page.id)}
                            className="px-3 py-1.5 text-xs font-medium text-primary-700 bg-primary-50 rounded-lg hover:bg-primary-100 transition-colors"
                          >
                            Publish
                          </button>
                        )}
                        {page.status === 'publish' && viewUrl && (
                          <a
                            href={viewUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-3 py-1.5 text-xs font-medium text-primary-700 bg-primary-50 rounded-lg hover:bg-primary-100 transition-colors"
                          >
                            View
                          </a>
                        )}
                        {page.status === 'future' && (
                          <span className="px-3 py-1.5 text-xs font-medium text-primary-600 bg-primary-50 rounded-lg">
                            {formatDate(page.date)}
                          </span>
                        )}

                        <a
                          href={editUrl}
                          className="p-2 text-gray-400 hover:text-primary-600 rounded-lg hover:bg-primary-50 transition-colors"
                          title={isTemplatePage ? 'Edit template in Site Editor' : 'Edit in WordPress'}
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </a>

                        <div className="relative">
                          <button
                            onClick={() => setActionMenu(actionMenu === page.id ? null : page.id)}
                            className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
                          >
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                              <circle cx="12" cy="5" r="1.5" />
                              <circle cx="12" cy="12" r="1.5" />
                              <circle cx="12" cy="19" r="1.5" />
                            </svg>
                          </button>
                          {actionMenu === page.id && (
                            <>
                              <div className="fixed inset-0 z-40" onClick={() => setActionMenu(null)} />
                              <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-xl shadow-lg border border-gray-200 py-1 z-50">
                                {page.status !== 'publish' && (
                                  <a
                                    href={`${viewUrl || '#'}${viewUrl?.includes('?') ? '&' : '?'}preview=true`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-2.5 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                                    onClick={() => setActionMenu(null)}
                                  >
                                    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                    </svg>
                                    Preview
                                  </a>
                                )}
                                {page.status === 'publish' && viewUrl && (
                                  <a
                                    href={viewUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-2.5 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                                    onClick={() => setActionMenu(null)}
                                  >
                                    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                    </svg>
                                    View Live
                                  </a>
                                )}
                                {page.status !== 'publish' && page.status !== 'future' && (
                                  <button
                                    onClick={() => handlePublish(page.id)}
                                    className="flex items-center gap-2.5 w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                                  >
                                    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    Publish Now
                                  </button>
                                )}
                                {(page.status === 'publish' || page.status === 'future') && (
                                  <button
                                    onClick={() => handleRevertDraft(page.id)}
                                    className="flex items-center gap-2.5 w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                                  >
                                    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                    </svg>
                                    Revert to Draft
                                  </button>
                                )}
                                {page.status !== 'publish' && (
                                  <button
                                    onClick={() => handleScheduleOpen(page)}
                                    className="flex items-center gap-2.5 w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                                  >
                                    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                    </svg>
                                    {page.status === 'future' ? 'Reschedule' : 'Schedule'}
                                  </button>
                                )}
                                <div className="border-t border-gray-100 my-1" />
                                <button
                                  onClick={() => { setTrashConfirm(page.id); setActionMenu(null); }}
                                  className="flex items-center gap-2.5 w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                  </svg>
                                  Move to Trash
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      </div>

                      {trashConfirm === page.id && (
                        <div className="flex items-center justify-end gap-1 mt-2">
                          <button
                            onClick={() => handleTrash(page.id)}
                            className="px-2 py-1 text-xs font-medium text-red-600 bg-red-50 rounded hover:bg-red-100 transition-colors"
                          >
                            Confirm
                          </button>
                          <button
                            onClick={() => setTrashConfirm(null)}
                            className="px-2 py-1 text-xs font-medium text-gray-500 bg-gray-50 rounded hover:bg-gray-100 transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}

      {/* Schedule Modal */}
      {scheduleModal && (
        <Modal
          open
          onClose={() => setScheduleModal(null)}
          title="Schedule Page"
          subtitle="Choose when this page should go live."
          size="sm"
          footer={
            <div className="flex justify-end gap-3">
              <Button variant="secondary" onClick={() => setScheduleModal(null)}>
                Cancel
              </Button>
              <Button
                onClick={handleScheduleConfirm}
                disabled={!scheduleDate || !scheduleTime}
              >
                Schedule
              </Button>
            </div>
          }
        >
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
              <input
                type="date"
                value={scheduleDate}
                onChange={(e) => setScheduleDate(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Time</label>
              <input
                type="time"
                value={scheduleTime}
                onChange={(e) => setScheduleTime(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

export default PagesPage;
