import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  useStore,
  useStripeStatus,
  useShippingOptions,
  useProducts,
  useWPPages,
  useTaxSettings,
} from '../hooks/useAPI';
import {
  CheckCircleIcon,
  ChevronDownIcon,
} from '@heroicons/react/24/solid';
import {
  CreditCardIcon,
  TruckIcon,
  CubeIcon,
  DocumentTextIcon,
  PaintBrushIcon,
  BuildingStorefrontIcon,
  CalculatorIcon,
  RocketLaunchIcon,
  ArrowTopRightOnSquareIcon,
} from '@heroicons/react/24/outline';

// ── Progress Ring ────────────────────────────────────────────
const ProgressRing = ({ completed, total, size = 48 }) => {
  const strokeWidth = 3.5;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = total > 0 ? completed / total : 0;
  const offset = circumference - progress * circumference;
  const allDone = completed === total;

  return (
    <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="#e5e7eb"
          strokeWidth={strokeWidth}
          fill="none"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={allDone ? 'var(--color-success-600, #16a34a)' : 'var(--color-primary-600, #2563eb)'}
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-500"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className={`text-xs font-bold ${allDone ? 'text-success-600' : 'text-gray-700'}`}>
          {completed}/{total}
        </span>
      </div>
    </div>
  );
};

// ── Accordion Step ───────────────────────────────────────────
const StepItem = ({ step, isCompleted, isActive, isLast, onToggle }) => (
  <div className={!isLast ? 'border-b border-gray-100' : ''}>
    {/* Step header */}
    <button
      onClick={onToggle}
      className={`flex items-center gap-3 w-full px-5 py-3.5 text-left transition-colors ${
        isActive && !isCompleted ? 'bg-primary-50/40' : 'hover:bg-gray-50'
      }`}
    >
      {/* Completion circle */}
      <div
        className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 transition-all ${
          isCompleted
            ? 'bg-success-500 text-white'
            : 'border-2 border-gray-300'
        }`}
      >
        {isCompleted && (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        )}
      </div>

      {/* Icon */}
      <div
        className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 transition-all ${
          isCompleted
            ? 'bg-success-50 text-success-600'
            : isActive
            ? 'bg-primary-50 text-primary-600'
            : 'bg-gray-50 text-gray-500'
        }`}
      >
        <step.icon className="w-[18px] h-[18px]" />
      </div>

      {/* Title */}
      <span
        className={`flex-1 text-sm font-medium transition-colors ${
          isCompleted ? 'text-gray-400 line-through' : 'text-gray-900'
        }`}
      >
        {isCompleted ? step.completedLabel : step.title}
      </span>

      {/* Expand chevron */}
      {!isCompleted && (
        <ChevronDownIcon
          className={`w-4 h-4 text-gray-400 transition-transform ${
            isActive ? 'rotate-180' : ''
          }`}
        />
      )}
    </button>

    {/* Expanded content */}
    {isActive && !isCompleted && (
      <div className="pb-4 pl-[92px] pr-5 animate-fadeIn">
        <p className="text-sm text-gray-500 leading-relaxed mb-3 max-w-md">
          {step.description}
        </p>
        <div className="flex items-center gap-2.5">
          <Link
            to={step.to}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-gray-900 rounded-lg hover:bg-gray-800 transition-colors"
          >
            {step.actionLabel}
          </Link>
          {step.secondaryAction && (
            <Link
              to={step.secondaryAction.to}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 hover:border-gray-300 transition-colors"
            >
              {step.secondaryAction.label}
            </Link>
          )}
        </div>
      </div>
    )}
  </div>
);

// ── Main Setup Checklist ─────────────────────────────────────
export default function SetupChecklist() {
  const { data: store, isLoading: storeLoading } = useStore();
  const { data: stripeStatus, isLoading: stripeLoading } = useStripeStatus();
  const { data: shippingOptions, isLoading: shippingLoading } = useShippingOptions();
  const { data: productsData, isLoading: productsLoading } = useProducts({ limit: 1, status: 'active' });
  const { data: pages, isLoading: pagesLoading } = useWPPages();
  const { data: taxSettings, isLoading: taxLoading } = useTaxSettings();

  const [activeStep, setActiveStep] = useState(null);
  const [showSteps, setShowSteps] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  const isLoading = storeLoading || stripeLoading || shippingLoading || productsLoading || pagesLoading || taxLoading;

  // ── Step definitions with live completion state ──
  const steps = [
    {
      id: 'store_details',
      complete: !!(store?.name && store?.name.trim()),
      icon: BuildingStorefrontIcon,
      title: 'Add store details',
      completedLabel: 'Store details added',
      description: 'Set your store name, tagline, and contact information so customers know who you are.',
      to: '/settings',
      actionLabel: 'Add details',
    },
    {
      id: 'branding',
      complete: !!(store?.logo_url),
      icon: PaintBrushIcon,
      title: 'Customize your storefront',
      completedLabel: 'Storefront customized',
      description: 'Upload your logo and set brand colors, fonts, and navigation to make the store yours.',
      to: '/design',
      actionLabel: 'Customize',
    },
    {
      id: 'product',
      complete: (productsData?.total || 0) > 0,
      icon: CubeIcon,
      title: 'Add your first product',
      completedLabel: `${productsData?.total || 0} product${(productsData?.total || 0) !== 1 ? 's' : ''} added`,
      description: 'Create a product with photos, pricing, and details so customers can start browsing.',
      to: '/products/new',
      actionLabel: 'Add product',
      secondaryAction: { label: 'Import', to: '/products' },
    },
    {
      id: 'payments',
      complete: !!(stripeStatus?.connected && stripeStatus?.account_details?.charges_enabled),
      icon: CreditCardIcon,
      title: 'Set up payments',
      completedLabel: 'Payments connected',
      description: 'Connect Stripe to accept credit cards, Apple Pay, and more at checkout.',
      to: '/payments',
      actionLabel: 'Connect Stripe',
    },
    {
      id: 'shipping',
      complete: Array.isArray(shippingOptions) && shippingOptions.length > 0,
      icon: TruckIcon,
      title: 'Configure shipping',
      completedLabel: `${shippingOptions?.length || 0} shipping option${(shippingOptions?.length || 0) !== 1 ? 's' : ''} set`,
      description: 'Define shipping zones and rates so customers know delivery costs at checkout.',
      to: '/shipping',
      actionLabel: 'Set up shipping',
    },
    {
      id: 'taxes',
      complete: !!(taxSettings?.tax_enabled),
      icon: CalculatorIcon,
      title: 'Review tax settings',
      completedLabel: 'Taxes configured',
      description: 'Confirm your tax configuration so orders are calculated correctly.',
      to: '/payments',
      actionLabel: 'Review taxes',
    },
    {
      id: 'pages',
      complete: Array.isArray(pages) && pages.length >= 2,
      icon: DocumentTextIcon,
      title: 'Create store pages',
      completedLabel: `${pages?.length || 0} pages created`,
      description: 'Add essential pages like About, Contact, and store policies.',
      to: '/pages',
      actionLabel: 'Create pages',
    },
  ];

  const completedCount = steps.filter((s) => s.complete).length;
  const totalCount = steps.length;
  const allDone = completedCount === totalCount;

  // Auto-open first incomplete step
  useEffect(() => {
    if (!isLoading && activeStep === null) {
      const firstIncomplete = steps.find((s) => !s.complete);
      if (firstIncomplete) setActiveStep(firstIncomplete.id);
    }
  }, [isLoading]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleToggle = (stepId) => {
    const step = steps.find((s) => s.id === stepId);
    if (step?.complete) return;
    setActiveStep(activeStep === stepId ? null : stepId);
  };

  if (isLoading || dismissed) return null;

  // Sort: incomplete first, completed last
  const sortedSteps = [...steps.filter((s) => !s.complete), ...steps.filter((s) => s.complete)];

  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm mb-6 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
        <div className="flex items-center gap-3.5">
          <ProgressRing completed={completedCount} total={totalCount} />
          <div>
            <h2 className="text-[15px] font-semibold text-gray-900">
              {allDone ? '🎉 Setup complete!' : 'Set up your store'}
            </h2>
            <p className="text-sm text-gray-500 mt-0.5">
              {allDone
                ? 'You\'re ready to start selling'
                : `${completedCount} of ${totalCount} steps complete`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {allDone && (
            <>
              <a
                href={(typeof window !== 'undefined' && window.bluSettings?.siteUrl) || '#'}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-semibold text-white bg-success-600 rounded-lg hover:bg-success-700 transition-colors"
              >
                View store
                <ArrowTopRightOnSquareIcon className="w-3.5 h-3.5" />
              </a>
              <button
                onClick={() => setDismissed(true)}
                className="text-xs text-gray-400 hover:text-gray-600 px-2 py-1 transition-colors"
              >
                Dismiss
              </button>
            </>
          )}
          {!allDone && (
            <button
              onClick={() => setShowSteps(!showSteps)}
              className="w-7 h-7 rounded-md border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-50 transition-all"
            >
              <ChevronDownIcon
                className={`w-4 h-4 transition-transform ${showSteps ? 'rotate-180' : ''}`}
              />
            </button>
          )}
        </div>
      </div>

      {/* Steps */}
      {showSteps && !allDone && (
        <div>
          {sortedSteps.map((step, i) => (
            <StepItem
              key={step.id}
              step={step}
              isCompleted={step.complete}
              isActive={activeStep === step.id}
              isLast={i === sortedSteps.length - 1}
              onToggle={() => handleToggle(step.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
