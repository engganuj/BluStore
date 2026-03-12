import { useState, useEffect, useRef, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  useAnalyticsOverview,
  useAnalyticsRevenue,
  useAnalyticsOrders,
  useAnalyticsProducts,
  useAnalyticsCustomers,
} from '../hooks/useAPI';
import { formatCents, formatDate } from '../utils/helpers';
import { Card, CardBody, LoadingSpinner, PageHeader } from '../components/shared';
import {
  CurrencyDollarIcon,
  ShoppingCartIcon,
  UserGroupIcon,
  CubeIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  ArrowPathIcon,
  ChartBarIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  SparklesIcon,
  BoltIcon,
  FireIcon,
  GlobeAltIcon,
  ArrowRightIcon,
  InformationCircleIcon,
  CheckCircleIcon,
  XCircleIcon,
} from '@heroicons/react/24/outline';
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  ComposedChart, ReferenceLine,
} from 'recharts';

// ══════════════════════════════════════════════════════════════════
// DESIGN SYSTEM
// ══════════════════════════════════════════════════════════════════

// Raw palette — synced with the Blu design system
const COLORS = {
  primary:    '#196CDF',   // blue-600
  primaryHov: '#3782E7',   // primary hover
  primaryAct: '#0C4A9C',   // primary active
  focus:      '#84C1FC',   // blue-400
  navy:       '#012957',   // navy-1000  (text / dark bg)
  slate:      '#465D77',   // slate-800  (muted text)
  success:    '#19A27E',   // green-700
  successDk:  '#108265',
  warning:    '#F4C652',   // gold-600
  warningDk:  '#D3A95C',
  info:       '#29C9E0',   // aqua-600
  infoDk:     '#26A2BA',
  surface:    '#FFFFFF',
  surfaceMut: '#E8EDF3',
  bg:         '#F4F8FC',
  border:     '#C3C9D6',
  neutral:    '#1E293A',
  red:        '#E04545',   // error / cancel
  redDk:      '#C23030',
};

const STATUS_COLORS = {
  paid:       COLORS.success,
  pending:    COLORS.warning,
  processing: COLORS.info,
  shipped:    COLORS.primary,
  fulfilled:  COLORS.slate,
  cancelled:  COLORS.red,
  refunded:   COLORS.warningDk,
};

const PIE_FILLS = [COLORS.primary, COLORS.success, COLORS.info, COLORS.warning, COLORS.navy, COLORS.slate, COLORS.red];

// ══════════════════════════════════════════════════════════════════
// ANIMATED NUMBER COUNTER
// ══════════════════════════════════════════════════════════════════

const useAnimatedNumber = (target, duration = 800) => {
  const [value, setValue] = useState(0);
  const ref = useRef(null);

  useEffect(() => {
    if (target === undefined || target === null) return;
    const num = typeof target === 'number' ? target : parseFloat(target) || 0;
    const start = 0;
    const startTime = performance.now();

    const animate = (now) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(start + (num - start) * eased));
      if (progress < 1) {
        ref.current = requestAnimationFrame(animate);
      }
    };

    ref.current = requestAnimationFrame(animate);
    return () => ref.current && cancelAnimationFrame(ref.current);
  }, [target, duration]);

  return value;
};

// ══════════════════════════════════════════════════════════════════
// MINI SPARKLINE (for stat cards)
// ══════════════════════════════════════════════════════════════════

const Sparkline = ({ data = [], color = COLORS.primary, height = 40, width = 120 }) => {
  if (!data.length) return null;
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const points = data.map((v, i) => {
    const x = (i / Math.max(data.length - 1, 1)) * width;
    const y = height - ((v - min) / range) * (height - 4) - 2;
    return `${x},${y}`;
  }).join(' ');

  const areaPoints = `0,${height} ${points} ${width},${height}`;

  return (
    <svg width={width} height={height} className="overflow-visible">
      <defs>
        <linearGradient id={`spark-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.25} />
          <stop offset="100%" stopColor={color} stopOpacity={0.02} />
        </linearGradient>
      </defs>
      <polygon points={areaPoints} fill={`url(#spark-${color.replace('#', '')})`} />
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
};

// ══════════════════════════════════════════════════════════════════
// HERO STAT CARD (gradient background + sparkline)
// ══════════════════════════════════════════════════════════════════

const HeroStat = ({ title, value, formattedValue, trend, trendLabel, sparkData, icon: Icon, gradient, sparkColor }) => {
  const animatedVal = useAnimatedNumber(value);
  const displayVal = formattedValue
    ? formattedValue
    : typeof value === 'number' ? animatedVal.toLocaleString() : value;

  return (
    <div className={`relative rounded-2xl p-5 overflow-hidden ${gradient}`}>
      {/* Decorative circle */}
      <div className="absolute -right-4 -top-4 w-24 h-24 rounded-full bg-white/10" />
      <div className="absolute -right-2 -bottom-6 w-16 h-16 rounded-full bg-white/5" />

      <div className="relative z-10">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Icon className="w-5 h-5 text-white/80" />
            <span className="text-sm font-medium text-white/80">{title}</span>
          </div>
          {trend !== null && trend !== undefined && (
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold ${
              trend > 0
                ? 'bg-white/20 text-white'
                : trend < 0
                  ? 'bg-red-500/30 text-white'
                  : 'bg-white/10 text-white/70'
            }`}>
              {trend > 0 ? '+' : ''}{trend}%
            </span>
          )}
        </div>

        <div className="flex items-end justify-between">
          <div>
            <p className="text-3xl font-extrabold text-white tracking-tight">{displayVal}</p>
            {trendLabel && (
              <p className="text-xs text-white/60 mt-1">{trendLabel}</p>
            )}
          </div>
          {sparkData?.length > 0 && (
            <div className="opacity-80">
              <Sparkline data={sparkData} color={sparkColor || '#ffffff'} height={36} width={100} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ══════════════════════════════════════════════════════════════════
// INSIGHT STRIP
// ══════════════════════════════════════════════════════════════════

const InsightIcon = ({ type }) => {
  const cls = 'w-4 h-4 flex-shrink-0';
  switch (type) {
    case 'positive': return <ArrowTrendingUpIcon className={`${cls} text-success-500`} />;
    case 'negative': return <ArrowTrendingDownIcon className={`${cls} text-red-500`} />;
    case 'warning':  return <ExclamationTriangleIcon className={`${cls} text-warning-400`} />;
    default:         return <InformationCircleIcon className={`${cls} text-info-400`} />;
  }
};

const InsightStrip = ({ insights = [] }) => {
  if (!insights.length) return null;
  return (
    <Card>
      <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-2">
        <SparklesIcon className="w-4 h-4 text-warning-300" />
        <span className="text-sm font-semibold text-gray-900">Insights</span>
      </div>
      <div className="divide-y divide-gray-50">
        {insights.map((ins, i) => (
          <div key={i} className="flex items-center gap-3 px-5 py-2.5">
            <InsightIcon type={ins.type} />
            <span className="text-sm text-gray-700">{ins.text}</span>
          </div>
        ))}
      </div>
    </Card>
  );
};

// ══════════════════════════════════════════════════════════════════
// CUSTOM CHART TOOLTIP
// ══════════════════════════════════════════════════════════════════

const ChartTip = ({ active, payload, label, isCurrency }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg shadow-xl px-4 py-3 text-sm border text-white" style={{ backgroundColor: COLORS.navy, borderColor: COLORS.slate }}>
      <p className="font-medium text-gray-300 mb-1.5 text-xs uppercase tracking-wider">{label}</p>
      {payload.map((entry, i) => (
        <div key={i} className="flex items-center gap-2 py-0.5">
          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: entry.color }} />
          <span className="text-gray-400">{entry.name}:</span>
          <span className="font-semibold">
            {isCurrency ? `$${(entry.value || 0).toLocaleString()}` : (entry.value || 0).toLocaleString()}
          </span>
        </div>
      ))}
    </div>
  );
};

// ══════════════════════════════════════════════════════════════════
// SECTION HEADER
// ══════════════════════════════════════════════════════════════════

const SectionTitle = ({ icon: Icon, title, subtitle, action }) => (
  <div className="flex items-center justify-between mb-4">
    <div className="flex items-center gap-3">
      {Icon && (
        <div className="p-2 rounded-xl bg-gray-100">
          <Icon className="w-5 h-5 text-gray-600" />
        </div>
      )}
      <div>
        <h3 className="font-semibold text-gray-900">{title}</h3>
        {subtitle && <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>}
      </div>
    </div>
    {action}
  </div>
);

// ══════════════════════════════════════════════════════════════════
// PERIOD SELECTOR
// ══════════════════════════════════════════════════════════════════

const PERIODS = [
  { value: '7d',  label: '7D' },
  { value: '30d', label: '30D' },
  { value: '90d', label: '90D' },
  { value: '12m', label: '12M' },
  { value: 'ytd', label: 'YTD' },
];

const PeriodSelector = ({ value, onChange }) => (
  <div className="inline-flex items-center bg-gray-100 rounded-xl p-1 gap-0.5">
    {PERIODS.map((p) => (
      <button
        key={p.value}
        onClick={() => onChange(p.value)}
        className={`px-4 py-2 text-sm font-semibold rounded-lg transition-all ${
          value === p.value
            ? 'bg-white text-gray-900 shadow-sm'
            : 'text-gray-500 hover:text-gray-700'
        }`}
      >
        {p.label}
      </button>
    ))}
  </div>
);

// ══════════════════════════════════════════════════════════════════
// TAB NAVIGATION
// ══════════════════════════════════════════════════════════════════

const TABS = [
  { id: 'overview',  label: 'Overview',  icon: ChartBarIcon },
  { id: 'revenue',   label: 'Revenue',   icon: CurrencyDollarIcon },
  { id: 'orders',    label: 'Orders',    icon: ShoppingCartIcon },
  { id: 'products',  label: 'Products',  icon: CubeIcon },
  { id: 'customers', label: 'Customers', icon: UserGroupIcon },
];

const TabNav = ({ active, onChange }) => (
  <div className="flex items-center gap-1 mb-8 overflow-x-auto pb-px">
    {TABS.map((tab) => (
      <button
        key={tab.id}
        onClick={() => onChange(tab.id)}
        className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-xl transition-all whitespace-nowrap ${
          active === tab.id
            ? 'bg-primary-900 text-white shadow-sm'
            : 'text-navy-500 hover:text-navy-900 hover:bg-surface-muted'
        }`}
      >
        <tab.icon className="w-4 h-4" />
        {tab.label}
      </button>
    ))}
  </div>
);

// ══════════════════════════════════════════════════════════════════
// HEATMAP COMPONENT (for order activity)
// ══════════════════════════════════════════════════════════════════

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const HOURS = Array.from({ length: 24 }, (_, i) => i);

const OrderHeatmap = ({ data = [] }) => {
  // Build grid: data is array of { day, hour, count }
  const grid = {};
  let maxCount = 0;
  data.forEach(({ day, hour, count }) => {
    const key = `${day}-${hour}`;
    grid[key] = count;
    if (count > maxCount) maxCount = count;
  });

  const getColor = (count) => {
    if (!count || !maxCount) return 'bg-surface-muted';
    const intensity = count / maxCount;
    if (intensity > 0.75) return 'bg-primary-700';
    if (intensity > 0.5)  return 'bg-primary-500';
    if (intensity > 0.25) return 'bg-primary-300';
    return 'bg-primary-100';
  };

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[640px]">
        {/* Hour labels */}
        <div className="flex items-center gap-px ml-12 mb-1">
          {HOURS.filter((h) => h % 3 === 0).map((h) => (
            <div key={h} className="text-[10px] text-gray-400 font-medium" style={{ width: `${100/8}%`, textAlign: 'center' }}>
              {h === 0 ? '12a' : h < 12 ? `${h}a` : h === 12 ? '12p' : `${h - 12}p`}
            </div>
          ))}
        </div>

        {/* Grid */}
        {DAYS.map((day, dayIdx) => (
          <div key={day} className="flex items-center gap-px mb-px">
            <span className="w-10 text-[11px] text-gray-500 font-medium text-right pr-2 flex-shrink-0">
              {day}
            </span>
            <div className="flex-1 flex gap-px">
              {HOURS.map((hour) => {
                const count = grid[`${dayIdx}-${hour}`] || 0;
                return (
                  <div
                    key={hour}
                    className={`flex-1 aspect-square rounded-sm ${getColor(count)} transition-colors cursor-default group relative`}
                    title={`${day} ${hour}:00 — ${count} orders`}
                  />
                );
              })}
            </div>
          </div>
        ))}

        {/* Legend */}
        <div className="flex items-center gap-2 mt-3 ml-12">
          <span className="text-[10px] text-gray-400">Less</span>
          {['bg-surface-muted', 'bg-primary-100', 'bg-primary-300', 'bg-primary-500', 'bg-primary-700'].map((c) => (
            <div key={c} className={`w-3 h-3 rounded-sm ${c}`} />
          ))}
          <span className="text-[10px] text-gray-400">More</span>
        </div>
      </div>
    </div>
  );
};

// ══════════════════════════════════════════════════════════════════
// METRIC CARD (small inline metric)
// ══════════════════════════════════════════════════════════════════

const MetricCard = ({ label, value, sublabel, icon: Icon, color = 'gray' }) => {
  const bgMap = {
    green:  'bg-success-50 text-success-600',
    red:    'bg-red-50 text-red-500',
    blue:   'bg-primary-100 text-primary-600',
    purple: 'bg-primary-100 text-primary-900',
    orange: 'bg-warning-50 text-warning-600',
    gray:   'bg-surface-muted text-navy-500',
  };
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <div className="flex items-center gap-2 mb-2">
        {Icon && <div className={`p-1.5 rounded-lg ${bgMap[color]}`}><Icon className="w-4 h-4" /></div>}
        <span className="text-xs font-medium text-gray-500">{label}</span>
      </div>
      <p className="text-xl font-bold text-gray-900">{value}</p>
      {sublabel && <p className="text-xs text-gray-400 mt-0.5">{sublabel}</p>}
    </div>
  );
};

// ══════════════════════════════════════════════════════════════════
// EMPTY CHART STATE
// ══════════════════════════════════════════════════════════════════

const EmptyChart = ({ message = 'No data for this period' }) => (
  <div className="flex flex-col items-center justify-center py-16 text-gray-400">
    <ChartBarIcon className="w-12 h-12 mb-3 text-gray-200" />
    <p className="text-sm">{message}</p>
  </div>
);

// ══════════════════════════════════════════════════════════════════
//  OVERVIEW TAB
// ══════════════════════════════════════════════════════════════════

const OverviewTab = ({ period }) => {
  const { data: overview, isLoading: oLoading } = useAnalyticsOverview({ period });
  const { data: revenue, isLoading: rLoading } = useAnalyticsRevenue({ period });

  if (oLoading || rLoading) return <LoadingSpinner />;
  if (!overview) return null;

  const { current: c, trends, sparklines, insights } = overview;

  // Revenue chart with previous period overlay
  const currTimeline = (revenue?.timeline || []).map((d) => ({ ...d, revenue: d.revenue_cents / 100 }));
  const prevTimeline = revenue?.prev_timeline || [];

  // Merge previous period data aligned by index
  const chartData = currTimeline.map((d, i) => ({
    ...d,
    previous: prevTimeline[i] ? prevTimeline[i].revenue_cents / 100 : null,
  }));

  return (
    <div className="space-y-6">
      {/* Hero KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <HeroStat
          title="Revenue"
          value={c.revenue_cents}
          formattedValue={formatCents(c.revenue_cents)}
          trend={trends.revenue}
          trendLabel="vs previous period"
          sparkData={sparklines?.revenue}
          icon={CurrencyDollarIcon}
          gradient="bg-gradient-to-br from-success-500 to-success-700"
          sparkColor="#ffffff"
        />
        <HeroStat
          title="Orders"
          value={c.total_orders}
          trend={trends.orders}
          trendLabel="vs previous period"
          sparkData={sparklines?.orders}
          icon={ShoppingCartIcon}
          gradient="bg-gradient-to-br from-primary-600 to-primary-900"
          sparkColor="#ffffff"
        />
        <HeroStat
          title="Avg Order Value"
          value={c.avg_order_cents}
          formattedValue={formatCents(c.avg_order_cents)}
          trend={trends.avg_order}
          trendLabel="vs previous period"
          icon={ChartBarIcon}
          gradient="bg-gradient-to-br from-navy-800 to-navy-900"
        />
        <HeroStat
          title="New Customers"
          value={c.new_customers}
          trend={trends.customers}
          trendLabel="vs previous period"
          icon={UserGroupIcon}
          gradient="bg-gradient-to-br from-info-400 to-info-700"
        />
      </div>

      {/* Smart Insights */}
      {insights?.length > 0 && <InsightStrip insights={insights} />}

      {/* Revenue comparison chart */}
      <Card>
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-gray-900">Revenue Trend</h3>
            <p className="text-xs text-gray-500 mt-0.5">Current period vs previous period</p>
          </div>
          <div className="flex items-center gap-4 text-xs">
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-1.5 rounded-full bg-primary-600" />
              Current
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-1.5 rounded-full bg-gray-300" />
              Previous
            </span>
          </div>
        </div>
        <CardBody>
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={340}>
              <ComposedChart data={chartData}>
                <defs>
                  <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={COLORS.primary} stopOpacity={0.12} />
                    <stop offset="100%" stopColor={COLORS.primary} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#E8EDF3" vertical={false} />
                <XAxis dataKey="period" tick={{ fontSize: 11, fill: '#465D77' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#465D77' }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${v >= 1000 ? `${(v/1000).toFixed(0)}k` : v}`} />
                <Tooltip content={<ChartTip isCurrency />} />
                {/* Previous period ghost line */}
                <Line type="monotone" dataKey="previous" name="Previous" stroke="#C3C9D6" strokeWidth={2} strokeDasharray="6 4" dot={false} />
                {/* Current period area */}
                <Area type="monotone" dataKey="revenue" name="Revenue" stroke={COLORS.primary} strokeWidth={2.5} fill="url(#revGrad)" dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChart />
          )}
        </CardBody>
      </Card>

      {/* Secondary metrics grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <MetricCard label="Refunds" value={formatCents(c.refunds_cents)} icon={ArrowPathIcon} color="red" />
        <MetricCard label="Shipping" value={formatCents(c.shipping_cents)} icon={ShoppingCartIcon} color="blue" />
        <MetricCard label="Tax Collected" value={formatCents(c.tax_cents)} icon={CurrencyDollarIcon} color="gray" />
        <MetricCard label="Active Products" value={c.active_products} icon={CubeIcon} color="purple" />
        <MetricCard label="Items per Order" value={c.avg_items_per_order} icon={ShoppingCartIcon} color="orange" />
        <MetricCard label="Repeat Rate" value={`${c.repeat_rate}%`} icon={ArrowPathIcon} color="green" />
      </div>

      {/* Gross profit */}
      {c.gross_profit_cents > 0 && (
        <Card>
          <CardBody>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-success-50">
                  <BoltIcon className="w-5 h-5 text-success-500" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Estimated Gross Profit</p>
                  <p className="text-2xl font-bold text-gray-900">{formatCents(c.gross_profit_cents)}</p>
                </div>
              </div>
              {c.revenue_cents > 0 && (
                <div className="text-right">
                  <p className="text-sm text-gray-500">Margin</p>
                  <p className="text-2xl font-bold text-success-500">
                    {Math.round(c.gross_profit_cents / c.revenue_cents * 100)}%
                  </p>
                </div>
              )}
            </div>
          </CardBody>
        </Card>
      )}
    </div>
  );
};

// ══════════════════════════════════════════════════════════════════
//  REVENUE TAB
// ══════════════════════════════════════════════════════════════════

const RevenueTab = ({ period }) => {
  const { data, isLoading } = useAnalyticsRevenue({ period });
  if (isLoading) return <LoadingSpinner />;
  if (!data) return null;

  const { summary: s, timeline, by_day_of_week: byDow, profit_timeline } = data;

  const chartData = timeline.map((d) => ({
    ...d,
    revenue: d.revenue_cents / 100,
    refunds: d.refunds_cents / 100,
    shipping: d.shipping_cents / 100,
    net: (d.revenue_cents - d.refunds_cents) / 100,
  }));

  const profitData = (profit_timeline || []).map((d) => ({
    period: d.period,
    revenue: d.revenue_cents / 100,
    cost: d.cost_cents / 100,
    profit: d.profit_cents / 100,
  }));

  const dowData = (byDow || []).map((d) => ({
    ...d,
    day: d.day_name?.substring(0, 3),
    revenue: d.revenue_cents / 100,
  }));

  return (
    <div className="space-y-6">
      {/* Revenue summary strip */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <Card className="!bg-gradient-to-br from-navy-900 to-navy-800">
          <CardBody className="!py-4">
            <p className="text-xs font-medium text-gray-400 mb-1">Gross Revenue</p>
            <p className="text-xl font-bold text-white">{formatCents(s.gross_cents)}</p>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="!py-4">
            <p className="text-xs font-medium text-gray-500 mb-1">Net Revenue</p>
            <p className="text-xl font-bold text-success-500">{formatCents(s.net_cents)}</p>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="!py-4">
            <p className="text-xs font-medium text-gray-500 mb-1">Refunds</p>
            <p className="text-xl font-bold text-red-500">{formatCents(s.refunds_cents)}</p>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="!py-4">
            <p className="text-xs font-medium text-gray-500 mb-1">Shipping</p>
            <p className="text-xl font-bold text-gray-900">{formatCents(s.shipping_cents)}</p>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="!py-4">
            <p className="text-xs font-medium text-gray-500 mb-1">Tax Collected</p>
            <p className="text-xl font-bold text-gray-900">{formatCents(s.tax_cents)}</p>
          </CardBody>
        </Card>
      </div>

      {/* Revenue + refunds bar chart */}
      <Card>
        <div className="px-6 py-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-900">Revenue vs Refunds</h3>
        </div>
        <CardBody>
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={360}>
              <BarChart data={chartData} barCategoryGap="20%">
                <CartesianGrid strokeDasharray="3 3" stroke="#E8EDF3" vertical={false} />
                <XAxis dataKey="period" tick={{ fontSize: 11, fill: '#465D77' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#465D77' }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${v >= 1000 ? `${(v/1000).toFixed(0)}k` : v}`} />
                <Tooltip content={<ChartTip isCurrency />} />
                <Legend />
                <Bar dataKey="revenue" name="Revenue" fill={COLORS.primary} radius={[6, 6, 0, 0]} />
                <Bar dataKey="refunds" name="Refunds" fill={COLORS.red} radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChart />
          )}
        </CardBody>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Day of week breakdown */}
        {dowData.length > 0 && (
          <Card>
            <div className="px-6 py-4 border-b border-gray-100">
              <h3 className="font-semibold text-gray-900">Revenue by Day of Week</h3>
              <p className="text-xs text-gray-500 mt-0.5">Find your busiest selling days</p>
            </div>
            <CardBody>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={dowData} barCategoryGap="25%">
                  <CartesianGrid strokeDasharray="3 3" stroke="#E8EDF3" vertical={false} />
                  <XAxis dataKey="day" tick={{ fontSize: 12, fill: '#465D77' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#465D77' }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${v >= 1000 ? `${(v/1000).toFixed(0)}k` : v}`} />
                  <Tooltip content={<ChartTip isCurrency />} />
                  <Bar dataKey="revenue" name="Revenue" fill={COLORS.primary} radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardBody>
          </Card>
        )}

        {/* Profit timeline */}
        {profitData.length > 0 && (
          <Card>
            <div className="px-6 py-4 border-b border-gray-100">
              <h3 className="font-semibold text-gray-900">Profit Analysis</h3>
              <p className="text-xs text-gray-500 mt-0.5">Revenue minus product costs</p>
            </div>
            <CardBody>
              <ResponsiveContainer width="100%" height={240}>
                <AreaChart data={profitData}>
                  <defs>
                    <linearGradient id="profitGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={COLORS.success} stopOpacity={0.15} />
                      <stop offset="100%" stopColor={COLORS.success} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E8EDF3" vertical={false} />
                  <XAxis dataKey="period" tick={{ fontSize: 11, fill: '#465D77' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#465D77' }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${v >= 1000 ? `${(v/1000).toFixed(0)}k` : v}`} />
                  <Tooltip content={<ChartTip isCurrency />} />
                  <Area type="monotone" dataKey="profit" name="Profit" stroke={COLORS.success} strokeWidth={2} fill="url(#profitGrad)" dot={false} />
                  <Line type="monotone" dataKey="cost" name="Cost" stroke={COLORS.red} strokeWidth={1.5} strokeDasharray="4 4" dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </CardBody>
          </Card>
        )}
      </div>
    </div>
  );
};

// ══════════════════════════════════════════════════════════════════
//  ORDERS TAB
// ══════════════════════════════════════════════════════════════════

const OrdersTab = ({ period }) => {
  const { data, isLoading } = useAnalyticsOrders({ period });
  if (isLoading) return <LoadingSpinner />;
  if (!data) return null;

  const { timeline, status_breakdown: breakdown, heatmap, avg_fulfillment_hours, avg_orders_per_day, items_timeline } = data;
  const totalOrders = (breakdown || []).reduce((s, b) => s + b.count, 0);

  const pieData = (breakdown || []).map((b) => ({
    name: b.status.charAt(0).toUpperCase() + b.status.slice(1),
    value: b.count,
    fill: STATUS_COLORS[b.status] || COLORS.gray,
  }));

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MetricCard label="Total Orders" value={totalOrders} icon={ShoppingCartIcon} color="blue" />
        <MetricCard label="Orders / Day" value={avg_orders_per_day} icon={ChartBarIcon} color="purple" sublabel="Average this period" />
        <MetricCard
          label="Fulfillment Speed"
          value={avg_fulfillment_hours
            ? avg_fulfillment_hours < 24
              ? `${avg_fulfillment_hours}h`
              : `${(avg_fulfillment_hours / 24).toFixed(1)}d`
            : 'N/A'}
          icon={ClockIcon}
          color="green"
          sublabel="Avg time to ship"
        />
        <MetricCard
          label="Cancelled"
          value={breakdown?.find((b) => b.status === 'cancelled')?.count || 0}
          icon={XCircleIcon}
          color="red"
        />
      </div>

      {/* Orders stacked bar */}
      <Card>
        <div className="px-6 py-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-900">Orders Over Time</h3>
        </div>
        <CardBody>
          {timeline?.length > 0 ? (
            <ResponsiveContainer width="100%" height={340}>
              <BarChart data={timeline} barCategoryGap="15%">
                <CartesianGrid strokeDasharray="3 3" stroke="#E8EDF3" vertical={false} />
                <XAxis dataKey="period" tick={{ fontSize: 11, fill: '#465D77' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#465D77' }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip content={<ChartTip />} />
                <Legend />
                <Bar dataKey="paid" name="Paid" stackId="s" fill={COLORS.success} />
                <Bar dataKey="processing" name="Processing" stackId="s" fill={COLORS.info} />
                <Bar dataKey="shipped" name="Shipped" stackId="s" fill={COLORS.navy} />
                <Bar dataKey="fulfilled" name="Fulfilled" stackId="s" fill={COLORS.slate} />
                <Bar dataKey="pending" name="Pending" stackId="s" fill={COLORS.warning} />
                <Bar dataKey="cancelled" name="Cancelled" stackId="s" fill={COLORS.red} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChart />
          )}
        </CardBody>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Status donut */}
        {pieData.length > 0 && (
          <Card>
            <div className="px-6 py-4 border-b border-gray-100">
              <h3 className="font-semibold text-gray-900">Order Status</h3>
            </div>
            <CardBody>
              <div className="flex items-center gap-8">
                <ResponsiveContainer width={200} height={200}>
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={3} dataKey="value">
                      {pieData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex-1 space-y-2">
                  {breakdown.map((b) => (
                    <div key={b.status} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: STATUS_COLORS[b.status] || COLORS.gray }} />
                        <span className="text-sm text-gray-700 capitalize">{b.status}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-gray-900">{b.count}</span>
                        <span className="text-xs text-gray-400 w-8 text-right">
                          {totalOrders > 0 ? Math.round(b.count / totalOrders * 100) : 0}%
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </CardBody>
          </Card>
        )}

        {/* Heatmap */}
        {heatmap?.length > 0 && (
          <Card>
            <div className="px-6 py-4 border-b border-gray-100">
              <h3 className="font-semibold text-gray-900">Busiest Hours</h3>
              <p className="text-xs text-gray-500 mt-0.5">When your customers are ordering</p>
            </div>
            <CardBody>
              <OrderHeatmap data={heatmap} />
            </CardBody>
          </Card>
        )}
      </div>

      {/* Items per order trend */}
      {items_timeline?.length > 0 && (
        <Card>
          <div className="px-6 py-4 border-b border-gray-100">
            <h3 className="font-semibold text-gray-900">Average Items per Order</h3>
          </div>
          <CardBody>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={items_timeline}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E8EDF3" vertical={false} />
                <XAxis dataKey="period" tick={{ fontSize: 11, fill: '#465D77' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#465D77' }} axisLine={false} tickLine={false} />
                <Tooltip content={<ChartTip />} />
                <Line type="monotone" dataKey="avg_items" name="Items/Order" stroke={COLORS.info} strokeWidth={2.5} dot={{ fill: COLORS.teal, r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </CardBody>
        </Card>
      )}
    </div>
  );
};

// ══════════════════════════════════════════════════════════════════
//  PRODUCTS TAB
// ══════════════════════════════════════════════════════════════════

const ProductsTab = ({ period }) => {
  const { data, isLoading } = useAnalyticsProducts({ period });
  if (isLoading) return <LoadingSpinner />;
  if (!data) return null;

  const { top_by_revenue, top_by_units, inventory_health, timeline } = data;

  const chartData = (timeline || []).map((d) => ({
    ...d,
    revenue: d.revenue_cents / 100,
  }));

  // Inventory: split into critical / warning / healthy
  const critical = (inventory_health || []).filter((p) => p.inventory_qty === 0);
  const warning  = (inventory_health || []).filter((p) => p.inventory_qty > 0 && p.inventory_qty <= 10);

  return (
    <div className="space-y-6">
      {/* Units sold trend */}
      <Card>
        <div className="px-6 py-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-900">Product Sales Over Time</h3>
        </div>
        <CardBody>
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <ComposedChart data={chartData}>
                <defs>
                  <linearGradient id="unitsGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={COLORS.primary} stopOpacity={0.12} />
                    <stop offset="100%" stopColor={COLORS.primary} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#E8EDF3" vertical={false} />
                <XAxis dataKey="period" tick={{ fontSize: 11, fill: '#465D77' }} axisLine={false} tickLine={false} />
                <YAxis yAxisId="left" tick={{ fontSize: 11, fill: '#465D77' }} axisLine={false} tickLine={false} allowDecimals={false} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11, fill: '#465D77' }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${v >= 1000 ? `${(v/1000).toFixed(0)}k` : v}`} />
                <Tooltip content={<ChartTip />} />
                <Legend />
                <Area yAxisId="right" type="monotone" dataKey="revenue" name="Revenue ($)" stroke={COLORS.primary} fill="url(#unitsGrad)" strokeWidth={2} dot={false} />
                <Bar yAxisId="left" dataKey="units_sold" name="Units Sold" fill={COLORS.navy} radius={[4, 4, 0, 0]} barSize={20} />
              </ComposedChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChart />
          )}
        </CardBody>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top by revenue */}
        <Card>
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-gray-900">Top Products by Revenue</h3>
              <p className="text-xs text-gray-500 mt-0.5">Your highest earners</p>
            </div>
          </div>
          {(top_by_revenue || []).length > 0 ? (
            <div className="divide-y divide-gray-50">
              {top_by_revenue.map((p, i) => (
                <div key={p.product_id || i} className="flex items-center gap-3 px-6 py-3">
                  <span className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                    i < 3 ? 'bg-warning-100 text-warning-700' : 'bg-surface-muted text-navy-500'
                  }`}>{i + 1}</span>
                  <div className="w-10 h-10 rounded-lg bg-gray-100 overflow-hidden flex-shrink-0">
                    {p.product_image ? (
                      <img src={p.product_image} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center"><CubeIcon className="w-5 h-5 text-gray-300" /></div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{p.product_name}</p>
                    <p className="text-xs text-gray-500">{p.units_sold} units · {p.order_count} orders</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-bold text-gray-900">{formatCents(p.revenue_cents)}</p>
                    {p.revenue_share > 0 && (
                      <p className="text-[10px] text-gray-400">{p.revenue_share}% of total</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <CardBody><EmptyChart message="No sales this period" /></CardBody>
          )}
        </Card>

        {/* Top by units with bar visualization */}
        <Card>
          <div className="px-6 py-4 border-b border-gray-100">
            <h3 className="font-semibold text-gray-900">Top Products by Volume</h3>
            <p className="text-xs text-gray-500 mt-0.5">Most popular items</p>
          </div>
          {(top_by_units || []).length > 0 ? (
            <div className="divide-y divide-gray-50">
              {top_by_units.slice(0, 10).map((p, i) => {
                const maxUnits = top_by_units[0]?.units_sold || 1;
                const pct = Math.round(p.units_sold / maxUnits * 100);
                return (
                  <div key={p.product_id || i} className="px-6 py-3">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-sm font-medium text-gray-900 truncate pr-4">{p.product_name}</span>
                      <span className="text-sm font-bold text-gray-700 flex-shrink-0">{p.units_sold}</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2">
                      <div
                        className="h-2 rounded-full transition-all duration-500"
                        style={{
                          width: `${pct}%`,
                          background: `linear-gradient(90deg, ${COLORS.primary}, ${COLORS.navy})`,
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <CardBody><EmptyChart message="No sales this period" /></CardBody>
          )}
        </Card>
      </div>

      {/* Inventory Health */}
      {(inventory_health || []).length > 0 && (
        <Card>
          <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
            <FireIcon className="w-5 h-5 text-warning-400" />
            <div>
              <h3 className="font-semibold text-gray-900">Inventory Health & Forecast</h3>
              <p className="text-xs text-gray-500 mt-0.5">Stock levels with estimated days until stockout</p>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Product</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">In Stock</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Sold</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Velocity</th>
                  <th className="text-right px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Forecast</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {inventory_health.map((p) => (
                  <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-3">
                      <Link to={`/products/${p.id}/edit`} className="flex items-center gap-3 group">
                        <div className="w-8 h-8 rounded-lg bg-gray-100 overflow-hidden flex-shrink-0">
                          {p.images?.[0]?.url ? (
                            <img src={p.images[0].url} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center"><CubeIcon className="w-4 h-4 text-gray-300" /></div>
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-gray-900 truncate group-hover:text-primary-600 transition-colors">{p.name}</p>
                          <p className="text-xs text-gray-400">{p.sku || '—'}</p>
                        </div>
                      </Link>
                    </td>
                    <td className="text-right px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-bold ${
                        p.inventory_qty === 0 ? 'bg-red-100 text-red-700'
                          : p.inventory_qty <= 5 ? 'bg-warning-100 text-warning-700'
                          : 'bg-success-100 text-success-700'
                      }`}>
                        {p.inventory_qty}
                      </span>
                    </td>
                    <td className="text-right px-4 py-3 font-medium text-gray-700">{p.units_sold_period}</td>
                    <td className="text-right px-4 py-3 text-gray-500">{p.velocity_per_day}/day</td>
                    <td className="text-right px-6 py-3">
                      {p.days_until_stockout !== null ? (
                        <span className={`font-semibold ${
                          p.days_until_stockout <= 7 ? 'text-red-500'
                            : p.days_until_stockout <= 30 ? 'text-warning-500'
                            : 'text-success-500'
                        }`}>
                          {p.days_until_stockout}d
                        </span>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
};

// ══════════════════════════════════════════════════════════════════
//  CUSTOMERS TAB
// ══════════════════════════════════════════════════════════════════

const CustomersTab = ({ period }) => {
  const { data, isLoading } = useAnalyticsCustomers({ period });
  if (isLoading) return <LoadingSpinner />;
  if (!data) return null;

  const { total_customers, new_timeline, top_spenders, segments, ltv_distribution, lifetime_value: ltv, avg_days_between_orders, top_regions } = data;

  const totalBuyers = (segments.one_time || 0) + (segments.two_orders || 0) + (segments.loyal || 0);
  const repeatRate  = totalBuyers > 0
    ? Math.round(((segments.two_orders || 0) + (segments.loyal || 0)) / totalBuyers * 100)
    : 0;

  const segmentPie = [
    { name: 'One-time', value: segments.one_time || 0, fill: COLORS.blue },
    { name: '2 Orders', value: segments.two_orders || 0, fill: COLORS.orange },
    { name: 'Loyal (3+)', value: segments.loyal || 0, fill: COLORS.green },
  ].filter((s) => s.value > 0);

  const ltvData = (ltv_distribution || []).map((b) => ({
    bucket: b.bucket,
    count: b.count,
  }));

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="relative rounded-2xl p-5 overflow-hidden bg-gradient-to-br from-primary-600 to-primary-900">
          <div className="absolute -right-3 -top-3 w-20 h-20 rounded-full bg-white/10" />
          <div className="relative z-10">
            <p className="text-sm text-white/70 font-medium">Total Customers</p>
            <p className="text-3xl font-extrabold text-white mt-1">{total_customers}</p>
          </div>
        </div>
        <MetricCard label="Repeat Rate" value={`${repeatRate}%`} icon={ArrowPathIcon} color="green" sublabel={`${(segments.two_orders || 0) + (segments.loyal || 0)} repeat buyers`} />
        <MetricCard label="Avg Lifetime Value" value={formatCents(ltv.avg_cents)} icon={CurrencyDollarIcon} color="purple" />
        <MetricCard
          label="Avg Days Between Orders"
          value={avg_days_between_orders ? `${avg_days_between_orders}d` : 'N/A'}
          icon={ClockIcon}
          color="blue"
          sublabel="For repeat customers"
        />
      </div>

      {/* New customer acquisition */}
      <Card>
        <div className="px-6 py-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-900">Customer Acquisition</h3>
          <p className="text-xs text-gray-500 mt-0.5">New customers over time</p>
        </div>
        <CardBody>
          {new_timeline?.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={new_timeline} barCategoryGap="20%">
                <defs>
                  <linearGradient id="custGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={COLORS.primary} />
                    <stop offset="100%" stopColor={COLORS.primary} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#E8EDF3" vertical={false} />
                <XAxis dataKey="period" tick={{ fontSize: 11, fill: '#465D77' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#465D77' }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip content={<ChartTip />} />
                <Bar dataKey="new_customers" name="New Customers" fill="url(#custGrad)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChart message="No new customers in this period" />
          )}
        </CardBody>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Customer segments */}
        {segmentPie.length > 0 && (
          <Card>
            <div className="px-6 py-4 border-b border-gray-100">
              <h3 className="font-semibold text-gray-900">Customer Segments</h3>
            </div>
            <CardBody>
              <div className="flex items-center gap-8">
                <ResponsiveContainer width={180} height={180}>
                  <PieChart>
                    <Pie data={segmentPie} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={4} dataKey="value">
                      {segmentPie.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-3 flex-1">
                  {segmentPie.map((seg) => (
                    <div key={seg.name}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="flex items-center gap-2 text-sm text-gray-700">
                          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: seg.fill }} />
                          {seg.name}
                        </span>
                        <span className="text-sm font-bold text-gray-900">{seg.value}</span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-1.5">
                        <div className="h-1.5 rounded-full transition-all" style={{ width: `${totalBuyers > 0 ? (seg.value / totalBuyers * 100) : 0}%`, backgroundColor: seg.fill }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </CardBody>
          </Card>
        )}

        {/* LTV distribution */}
        {ltvData.length > 0 && (
          <Card>
            <div className="px-6 py-4 border-b border-gray-100">
              <h3 className="font-semibold text-gray-900">Lifetime Value Distribution</h3>
              <p className="text-xs text-gray-500 mt-0.5">All-time spending per customer</p>
            </div>
            <CardBody>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={ltvData} barCategoryGap="20%">
                  <CartesianGrid strokeDasharray="3 3" stroke="#E8EDF3" vertical={false} />
                  <XAxis dataKey="bucket" tick={{ fontSize: 11, fill: '#465D77' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#465D77' }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip content={<ChartTip />} />
                  <Bar dataKey="count" name="Customers" fill={COLORS.info} radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardBody>
          </Card>
        )}
      </div>

      {/* Top spenders */}
      {(top_spenders || []).length > 0 && (
        <Card>
          <div className="px-6 py-4 border-b border-gray-100">
            <h3 className="font-semibold text-gray-900">Top Customers</h3>
            <p className="text-xs text-gray-500 mt-0.5">Highest spenders this period</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Customer</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Orders</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Avg Order</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Last Order</th>
                  <th className="text-right px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Total Spent</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {top_spenders.map((c, i) => (
                  <tr key={c.customer_email || i} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-3">
                      <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0 ${
                          i === 0 ? 'bg-gradient-to-br from-warning-300 to-warning-500'
                            : i === 1 ? 'bg-gradient-to-br from-navy-300 to-navy-400'
                            : i === 2 ? 'bg-gradient-to-br from-warning-400 to-warning-600'
                            : 'bg-surface-muted text-navy-500'
                        }`}>
                          {(c.customer_name || c.customer_email || '?')[0].toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-gray-900 truncate">{c.customer_name || 'Guest'}</p>
                          <p className="text-xs text-gray-400 truncate">{c.customer_email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="text-right px-4 py-3 font-medium text-gray-700">{c.order_count}</td>
                    <td className="text-right px-4 py-3 text-gray-500">{formatCents(c.avg_order_cents)}</td>
                    <td className="text-right px-4 py-3 text-gray-500">{c.last_order_at ? formatDate(c.last_order_at) : '—'}</td>
                    <td className="text-right px-6 py-3 font-bold text-gray-900">{formatCents(c.total_spent_cents)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Top regions */}
      {(top_regions || []).length > 0 && (
        <Card>
          <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
            <GlobeAltIcon className="w-5 h-5 text-info-400" />
            <div>
              <h3 className="font-semibold text-gray-900">Top Regions</h3>
              <p className="text-xs text-gray-500 mt-0.5">Where your orders are coming from</p>
            </div>
          </div>
          <div className="divide-y divide-gray-50">
            {top_regions.map((r, i) => {
              const maxOrders = top_regions[0]?.order_count || 1;
              return (
                <div key={`${r.region}-${r.country}-${i}`} className="flex items-center gap-4 px-6 py-3">
                  <span className="w-7 h-7 rounded-lg bg-info-50 flex items-center justify-center text-xs font-bold text-info-600 flex-shrink-0">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900">{r.region || 'Unknown'}{r.country ? `, ${r.country}` : ''}</p>
                    <div className="w-full bg-gray-100 rounded-full h-1.5 mt-1.5">
                      <div className="h-1.5 rounded-full bg-info-500 transition-all" style={{ width: `${Math.round(r.order_count / maxOrders * 100)}%` }} />
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-bold text-gray-900">{r.order_count} orders</p>
                    <p className="text-xs text-gray-400">{formatCents(r.revenue_cents)}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
};

// ══════════════════════════════════════════════════════════════════
//  MAIN PAGE
// ══════════════════════════════════════════════════════════════════

function AnalyticsPage() {
  const [activeTab, setActiveTab] = useState('overview');
  const [period, setPeriod] = useState('30d');

  return (
    <div className="max-w-7xl mx-auto px-4 py-4 sm:p-6">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
          <p className="text-gray-500 mt-1 text-sm">Deep insights into your store's performance</p>
        </div>
        <PeriodSelector value={period} onChange={setPeriod} />
      </div>

      <TabNav active={activeTab} onChange={setActiveTab} />

      {activeTab === 'overview'  && <OverviewTab period={period} />}
      {activeTab === 'revenue'   && <RevenueTab period={period} />}
      {activeTab === 'orders'    && <OrdersTab period={period} />}
      {activeTab === 'products'  && <ProductsTab period={period} />}
      {activeTab === 'customers' && <CustomersTab period={period} />}
    </div>
  );
}

export default AnalyticsPage;
