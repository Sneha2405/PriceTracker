// src/components/PriceChart.jsx
import { useState, useMemo } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import { format, subDays, isAfter } from 'date-fns';
import { ChartIcon } from './Icons';
import './PriceChart.css';

function formatPrice(v) {
  if (v == null || !Number.isFinite(v)) return '—';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(v);
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="chart-tooltip glass">
      <p className="tooltip-date">{format(new Date(label), 'dd MMM yyyy, HH:mm:ss')}</p>
      <div className="tooltip-price-row">
        <span className="tooltip-label">Price</span>
        <span className="tooltip-price">{formatPrice(d.price)}</span>
      </div>
      <p className="tooltip-stock">
        <span className={`pulse-dot ${d.in_stock ? 'green' : 'red'}`} />
        {d.in_stock
          ? d.stock_qty != null
            ? `In Stock (${d.stock_qty} available)`
            : 'In Stock'
          : 'Out of Stock'}
      </p>
    </div>
  );
};

export default function PriceChart({ history }) {
  const [timeRange, setTimeRange] = useState('all'); // '24h' | '7d' | 'all'

  const filteredHistory = useMemo(() => {
    if (!history?.length) return [];
    if (timeRange === 'all') return history;

    const now = new Date();
    const cutoff = timeRange === '24h' ? subDays(now, 1) : subDays(now, 7);
    const filtered = history.filter((h) => isAfter(new Date(h.scraped_at), cutoff));
    return filtered.length > 0 ? filtered : history; // fallback to full history if window is empty
  }, [history, timeRange]);

  if (!history?.length) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">
          <ChartIcon size={36} />
        </div>
        <h3>No price history recorded yet</h3>
        <p className="text-muted">Click <strong>Scrape Now</strong> above to record the initial price entry.</p>
      </div>
    );
  }

  const data = filteredHistory.map((h) => ({
    ...h,
    ts: h.scraped_at,
    price: Number(h.price),
  }));

  const prices = data.map((d) => d.price);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const avgPrice = prices.reduce((a, b) => a + b, 0) / prices.length;

  return (
    <div className="price-chart-wrapper fade-in">
      {/* Top Header: Controls + Range selector */}
      <div className="chart-header-row">
        <div className="chart-range-selector">
          <button
            type="button"
            className={`range-chip ${timeRange === '24h' ? 'active' : ''}`}
            onClick={() => setTimeRange('24h')}
          >
            24 Hours
          </button>
          <button
            type="button"
            className={`range-chip ${timeRange === '7d' ? 'active' : ''}`}
            onClick={() => setTimeRange('7d')}
          >
            7 Days
          </button>
          <button
            type="button"
            className={`range-chip ${timeRange === 'all' ? 'active' : ''}`}
            onClick={() => setTimeRange('all')}
          >
            All Time
          </button>
        </div>
      </div>

      {/* Stats summary bar */}
      <div className="chart-stats">
        <div className="chart-stat">
          <span className="stat-label">Lowest Price</span>
          <span className="stat-value" style={{ color: 'var(--accent-emerald)' }}>
            {formatPrice(minPrice)}
          </span>
        </div>
        <div className="chart-stat">
          <span className="stat-label">Average Price</span>
          <span className="stat-value" style={{ color: 'var(--accent-blue)' }}>
            {formatPrice(avgPrice)}
          </span>
        </div>
        <div className="chart-stat">
          <span className="stat-label">Highest Price</span>
          <span className="stat-value" style={{ color: 'var(--accent-amber)' }}>
            {formatPrice(maxPrice)}
          </span>
        </div>
        <div className="chart-stat">
          <span className="stat-label">Readings</span>
          <span className="stat-value">{data.length}</span>
        </div>
      </div>

      {/* Chart Area */}
      <div className="chart-area">
        <ResponsiveContainer width="100%" height={320}>
          <AreaChart data={data} margin={{ top: 15, right: 30, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.35} />
                <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.0} />
              </linearGradient>
              <linearGradient id="strokeGradient" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#60a5fa" />
                <stop offset="50%" stopColor="#8b5cf6" />
                <stop offset="100%" stopColor="#34d399" />
              </linearGradient>
            </defs>

            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />

            <XAxis
              dataKey="ts"
              tickFormatter={(v) => format(new Date(v), 'dd MMM, HH:mm')}
              tick={{ fill: '#94a3b8', fontSize: 11 }}
              axisLine={{ stroke: 'rgba(255,255,255,0.08)' }}
              tickLine={false}
            />

            <YAxis
              tickFormatter={(v) => `₹${(v / 1000).toFixed(1)}k`}
              tick={{ fill: '#94a3b8', fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              domain={['auto', 'auto']}
              width={56}
            />

            <Tooltip content={<CustomTooltip />} />

            {/* Min Price Reference Line */}
            {minPrice !== maxPrice && (
              <ReferenceLine
                y={minPrice}
                stroke="#34d399"
                strokeDasharray="4 4"
                label={{ value: `Min: ${formatPrice(minPrice)}`, position: 'insideBottomRight', fill: '#34d399', fontSize: 10 }}
              />
            )}

            {/* Max Price Reference Line */}
            {minPrice !== maxPrice && (
              <ReferenceLine
                y={maxPrice}
                stroke="#f59e0b"
                strokeDasharray="4 4"
                label={{ value: `Max: ${formatPrice(maxPrice)}`, position: 'insideTopRight', fill: '#f59e0b', fontSize: 10 }}
              />
            )}

            {/* Average Price Reference Line */}
            <ReferenceLine
              y={avgPrice}
              stroke="rgba(96,165,250,0.4)"
              strokeDasharray="3 3"
              label={{ value: `Avg: ${formatPrice(avgPrice)}`, position: 'right', fill: '#60a5fa', fontSize: 10 }}
            />

            <Area
              type="linear"
              dataKey="price"
              stroke="url(#strokeGradient)"
              strokeWidth={3}
              fill="url(#areaGradient)"
              dot={(props) => {
                const { cx, cy, payload } = props;
                const color = payload.in_stock ? '#34d399' : '#f43f5e';
                return (
                  <circle
                    key={`dot-${cx}-${cy}`}
                    cx={cx}
                    cy={cy}
                    r={5}
                    fill={color}
                    stroke="#0b0d14"
                    strokeWidth={2}
                  />
                );
              }}
              activeDot={{ r: 7, fill: '#60a5fa', stroke: '#ffffff', strokeWidth: 2 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="chart-legend text-xs text-muted">
        <span className="legend-item">
          <span className="legend-dot green" /> In Stock
        </span>
        <span className="legend-item">
          <span className="legend-dot red" /> Out of Stock
        </span>
        <span className="legend-item text-secondary">
          Hover data points to inspect historical readings
        </span>
      </div>
    </div>
  );
}
