import { useEffect, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { formatDistanceToNow, format } from 'date-fns';
import api from '../api';
import StockBadge from '../components/StockBadge';
import PriceChart from '../components/PriceChart';
import ScrapeLog from '../components/ScrapeLog';
import { RefreshCwIcon, ExternalLinkIcon, ChartIcon, LogsIcon, ClockIcon } from '../components/Icons';
import './ProductPage.css';

function formatPrice(price, currency = 'INR') {
  if (price == null) return '—';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(price);
}

export default function ProductPage() {
  const { id } = useParams();
  const [product, setProduct]   = useState(null);
  const [history, setHistory]   = useState([]);
  const [logs, setLogs]         = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(null);
  const [scraping, setScraping] = useState(false);
  const [scrapeFeedback, setScrapeFeedback] = useState(null);
  const [activeTab, setActiveTab] = useState('chart'); // 'chart' | 'logs'
  const [targetPriceInput, setTargetPriceInput] = useState('');

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [trackedRes, historyRes, logsRes] = await Promise.all([
        api.get('/products/tracked'),
        api.get(`/products/${id}/history`),
        api.get(`/products/${id}/logs`),
      ]);
      const found = trackedRes.data.find((p) => p.id === id);
      setProduct(found ?? null);
      setHistory(historyRes.data);
      setLogs(logsRes.data);
    } catch (err) {
      setError(err.response?.data?.error ?? err.message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!scrapeFeedback) return;
    const timer = setTimeout(() => setScrapeFeedback(null), 6000);
    return () => clearTimeout(timer);
  }, [scrapeFeedback]);

  const handleManualScrape = async () => {
    setScraping(true);
    setScrapeFeedback(null);
    try {
      // Step 1: Fire the scrape — backend responds immediately with 202.
      await api.post(`/products/${id}/scrape`);

      // Step 2: Poll the status endpoint every 1.2 seconds (up to 2 minutes).
      const MAX_POLLS = 100; // 100 × 1.2s = 2 minutes
      let polls = 0;
      const poll = async () => {
        polls++;
        try {
          const { data: statusData } = await api.get(`/products/${id}/scrape/status`);
          if (statusData.status === 'pending' && polls < MAX_POLLS) {
            setTimeout(poll, 1200);
            return;
          }

          // Reload fresh data from DB regardless of outcome
          await load();

          if (statusData.status === 'done' && statusData.result?.ok) {
            const r = statusData.result;
            setScrapeFeedback({
              type: 'success',
              message: `Scrape completed: ${formatPrice(r.price, 'INR')} (${r.inStock ? 'In Stock' : 'Out of Stock'})`,
            });
          } else if (statusData.status === 'error') {
            setScrapeFeedback({
              type: 'error',
              message: `Scrape error: ${statusData.error || 'Unknown error'}`,
            });
          } else if (statusData.status === 'done' && !statusData.result?.ok) {
            await load();
            setScrapeFeedback({
              type: 'error',
              message: `Scrape notice: ${statusData.result?.reason || 'Store returned intermittent error'}. View attempt details in Scrape Logs tab.`,
            });
          } else {
            // Timed out polling
            await load();
            setScrapeFeedback({
              type: 'error',
              message: 'Scrape is taking longer than expected. Check the scrape logs tab.',
            });
          }
        } catch (pollErr) {
          console.warn('Poll error:', pollErr);
          if (polls < MAX_POLLS) {
            setTimeout(poll, 3000);
            return; // don't fall through to setScraping
          } else {
            setScrapeFeedback({ type: 'error', message: 'Could not reach server.' });
          }
        }
        // Reached here = polling ended (success, final error, or max polls)
        setScraping(false);
      };

      // Start polling after initial 1.2s delay
      setTimeout(poll, 1200);

    } catch (err) {
      console.error('Manual scrape trigger failed:', err);
      setScrapeFeedback({
        type: 'error',
        message: `Could not trigger scrape: ${err.response?.data?.error ?? err.message}`,
      });
      setScraping(false);
    }
  };

  if (loading) return (
    <div className="page container">
      <div className="skeleton mb-4" style={{ height: 28, width: 160 }} />
      <div className="skeleton mb-6" style={{ height: 100 }} />
      <div className="skeleton" style={{ height: 320 }} />
    </div>
  );

  if (error) return (
    <div className="page container">
      <div className="empty-state">
        <h3>Error loading product</h3>
        <p className="text-muted">{error}</p>
        <button className="btn btn-secondary mt-4" onClick={load}>Retry</button>
      </div>
    </div>
  );

  if (!product) return (
    <div className="page container">
      <div className="empty-state">
        <h3>Product not found</h3>
        <p className="text-muted">It may have been removed from tracking.</p>
        <Link to="/" className="btn btn-primary mt-4">Back to Dashboard</Link>
      </div>
    </div>
  );

  const latest = Array.isArray(product.latest_prices)
    ? product.latest_prices[0]
    : (product.latest_prices ?? (history.length > 0 ? history[history.length - 1] : null));
  const prevPrice = history.length >= 2 ? Number(history[history.length - 2].price) : null;
  const curPrice  = latest?.price != null ? Number(latest.price) : null;
  const priceDelta = (curPrice != null && prevPrice != null) ? curPrice - prevPrice : null;

  return (
    <div className="page hero-gradient">
      <div className="container">

        {/* Breadcrumb */}
        <div className="breadcrumb fade-in">
          <Link to="/" className="text-muted text-sm">Dashboard</Link>
          <span className="text-muted">/</span>
          <span className="text-sm font-medium">{product.name}</span>
        </div>

        {/* Scrape Feedback Banner */}
        {scrapeFeedback && (
          <div className={`scrape-feedback-banner fade-in ${scrapeFeedback.type}`}>
            <span className="sfb-text">{scrapeFeedback.message}</span>
            <button
              type="button"
              className="sfb-close"
              onClick={() => setScrapeFeedback(null)}
              aria-label="Close"
            >
              ✕
            </button>
          </div>
        )}

        {/* Product header */}
        <div className="pp-header card fade-in">
          <div className="pp-header-left">
            <div className="pp-title-row">
              <h1 className="pp-name">{product.name}</h1>
              <StockBadge inStock={latest?.in_stock ?? null} stockQty={latest?.stock_qty ?? null} />
            </div>

            <div className="pp-meta-tags mt-2">
              {product.store_product_id && (
                <span className="badge badge-muted mono text-xs">SKU #{product.store_product_id}</span>
              )}
              {latest?.stock_qty != null && (
                <span className="badge badge-green text-xs">
                  📦 Stock Remaining: {latest.stock_qty} {latest.stock_qty === 1 ? 'unit' : 'units'}
                </span>
              )}
              {(() => {
                const uniqueSignatures = new Set(logs.map((l) => l.structure_signature).filter(Boolean));
                return uniqueSignatures.size > 1 ? (
                  <span className="badge badge-yellow text-xs" title="Storefront markup structure changed between scrape runs">
                    ⚠️ DOM Structure Shift Detected
                  </span>
                ) : null;
              })()}
              <span className="badge badge-muted text-xs">
                <ClockIcon size={12} /> Every {product.scrape_interval_minutes ? Math.round(product.scrape_interval_minutes / 60) : 2}h
              </span>
              {latest?.scraped_at && (() => {
                const intervalMs = (product.scrape_interval_minutes || 120) * 60 * 1000;
                const lastScrapeTs = new Date(latest.scraped_at).getTime();
                const nextScrapeTs = lastScrapeTs + intervalMs;
                const msUntilNext = nextScrapeTs - Date.now();
                const minsUntilNext = Math.ceil(msUntilNext / 60000);

                return (
                  <span className="badge badge-blue text-xs">
                    Next scrape: {minsUntilNext > 0 ? `in ~${minsUntilNext} mins` : 'due soon'}
                  </span>
                );
              })()}
              {product.product_url && (
                <a href={product.product_url} target="_blank" rel="noopener noreferrer"
                  className="pp-store-link text-xs">
                  View on Store <ExternalLinkIcon size={11} />
                </a>
              )}
            </div>
          </div>

          <div className="pp-price-block">
            <span className="pp-price">
              {curPrice != null ? formatPrice(curPrice, latest?.currency) : 'No data yet'}
            </span>
            {priceDelta !== null && (
              <span className={`price-delta ${priceDelta > 0 ? 'up' : priceDelta < 0 ? 'down' : 'flat'}`}>
                {priceDelta > 0 ? '▲' : priceDelta < 0 ? '▼' : '—'}{' '}
                {priceDelta !== 0
                  ? `${formatPrice(Math.abs(priceDelta), latest?.currency)} vs prev`
                  : 'No change'}
              </span>
            )}
            {latest?.scraped_at && (
              <p className="text-xs text-muted mt-1">
                Updated {formatDistanceToNow(new Date(latest.scraped_at), { addSuffix: true })}
              </p>
            )}
          </div>
        </div>

        {/* Scrape Telemetry Live Stepper (Full Width Top) */}
        {scraping && (
          <div className="scrape-stepper-card card fade-in mb-6">
            <div className="stepper-header">
              <span className="pulse-dot active" />
              <span className="font-semibold text-sm">Live Playwright Scraper Pipeline Active</span>
            </div>
            <div className="stepper-pipeline mt-3">
              <div className="step-item active">
                <div className="step-badge">1</div>
                <div className="step-info">
                  <span className="step-title">Launch Headless Chrome</span>
                  <span className="step-desc">Chromium / Stealth Context</span>
                </div>
              </div>
              <div className="step-item active">
                <div className="step-badge spinner-badge">2</div>
                <div className="step-info">
                  <span className="step-title">Bypass Bot Challenge</span>
                  <span className="step-desc">Mouse Dwell ≥ 600ms & WASM Solver</span>
                </div>
              </div>
              <div className="step-item">
                <div className="step-badge">3</div>
                <div className="step-info">
                  <span className="step-title">Decrypt Payload</span>
                  <span className="step-desc">Extract DOM Price & Stock Qty</span>
                </div>
              </div>
              <div className="step-item">
                <div className="step-badge">4</div>
                <div className="step-info">
                  <span className="step-title">Database Sync</span>
                  <span className="step-desc">Upsert Supabase & Scrape Logs</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 2-Column Asymmetric SaaS Layout */}
        <div className="pp-layout-grid">
          {/* Main Left Column (70%) */}
          <div className="pp-main-col">
            {/* Tabs */}
            <div className="pp-tabs fade-in">
              <button
                id="tab-chart"
                className={`tab-btn ${activeTab === 'chart' ? 'active' : ''}`}
                onClick={() => setActiveTab('chart')}
              >
                <ChartIcon size={15} /> Price History
                <span className="tab-count">{history.length}</span>
              </button>
              <button
                id="tab-logs"
                className={`tab-btn ${activeTab === 'logs' ? 'active' : ''}`}
                onClick={() => setActiveTab('logs')}
              >
                <LogsIcon size={15} /> Scrape Logs
                <span className="tab-count">{logs.length}</span>
              </button>
            </div>

            {/* Tab content */}
            <div className="pp-tab-content">
              {activeTab === 'chart' && (
                <div className="card fade-in">
                  <PriceChart history={history} />
                </div>
              )}

              {activeTab === 'logs' && (
                <div className="fade-in">
                  <ScrapeLog logs={logs} />
                </div>
              )}
            </div>

            {/* Raw Readings Table */}
            {activeTab === 'chart' && history.length > 0 && (
              <div className="mt-6 fade-in">
                <p className="section-title mb-4">Raw Readings</p>
                <div className="table-wrapper">
                  <table>
                    <thead>
                      <tr>
                        <th>Date & Time</th>
                        <th>Price</th>
                        <th>Stock</th>
                        <th>Qty</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...history].reverse().slice(0, 50).map((h) => (
                        <tr key={h.id}>
                          <td className="mono text-xs">
                            {format(new Date(h.scraped_at), 'dd MMM yyyy, HH:mm:ss')}
                          </td>
                          <td className="font-bold">
                            {formatPrice(h.price, h.currency)}
                          </td>
                          <td>
                            <StockBadge inStock={h.in_stock} stockQty={h.stock_qty} />
                          </td>
                          <td className="text-muted">{h.stock_qty ?? '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          {/* Right Sidebar Column (30%) */}
          <div className="pp-sidebar-col flex flex-col gap-4">
            {/* Quick Actions Card */}
            <div className="card fade-in sidebar-widget">
              <p className="widget-title mb-3">Telemetry Controls</p>
              <button
                id="manual-scrape-btn"
                className="btn btn-primary w-full"
                onClick={handleManualScrape}
                disabled={scraping}
              >
                <RefreshCwIcon size={14} className={scraping ? 'spinner' : ''} />
                {scraping ? 'Scraping Live…' : 'Trigger Scrape Now'}
              </button>
              <p className="text-xs text-muted mt-3">
                Runs an instant Playwright headless pass. Scheduled runs execute every 2h.
              </p>
            </div>

            {/* Target Price Alert Card */}
            <div className="card fade-in sidebar-widget">
              <p className="widget-title mb-2">Target Price Alert</p>
              <p className="text-xs text-muted mb-3">Set alert threshold price to track drops.</p>
              
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  className="input text-xs"
                  placeholder="Target ₹ (e.g. 20000)"
                  value={targetPriceInput}
                  onChange={(e) => setTargetPriceInput(e.target.value)}
                />
              </div>

              {targetPriceInput && curPrice != null && (() => {
                const targetVal = Number(targetPriceInput);
                const isReached = curPrice <= targetVal;
                const diff = curPrice - targetVal;
                return (
                  <div className={`target-alert-status mt-3 p-2 rounded text-xs border ${isReached ? 'badge-green' : 'badge-muted'}`}>
                    {isReached ? (
                      <span className="font-semibold text-emerald-400">🎉 Target Price Reached! ({formatPrice(curPrice, latest?.currency)})</span>
                    ) : (
                      <span>🎯 Target: {formatPrice(targetVal, latest?.currency)} ({formatPrice(diff, latest?.currency)} away)</span>
                    )}
                  </div>
                );
              })()}
            </div>

            {/* Advanced Price Analytics & Volatility Index Widget */}
            {history.length > 0 && (() => {
              const validPrices = history.map((h) => Number(h.price)).filter((p) => p > 0);
              const maxP = validPrices.length ? Math.max(...validPrices) : 0;
              const minP = validPrices.length ? Math.min(...validPrices) : 0;
              const savings = curPrice != null && maxP > curPrice ? maxP - curPrice : 0;
              const savingsPct = maxP > 0 && savings > 0 ? ((savings / maxP) * 100).toFixed(1) : 0;
              const fluctuations = history.reduce(
                (acc, h, i) => (i > 0 && Number(h.price) !== Number(history[i - 1].price) ? acc + 1 : acc),
                0
              );
              const inStockCount = history.filter((h) => h.in_stock).length;
              const stockRate = history.length ? Math.round((inStockCount / history.length) * 100) : 0;

              return (
                <div className="analytics-insights-stacked card fade-in">
                  <p className="widget-title mb-3">Price & Stock Analytics</p>
                  
                  <div className="analytics-stacked-item">
                    <span className="ai-label">Max Peak Savings</span>
                    <span className="ai-value" style={{ color: savings > 0 ? 'var(--accent-emerald)' : 'var(--text-secondary)' }}>
                      {savings > 0 ? `${formatPrice(savings, latest?.currency)} (${savingsPct}% off)` : 'At Peak Price'}
                    </span>
                    <span className="ai-sub">vs historical highest price</span>
                  </div>

                  <div className="divider my-2" />

                  <div className="analytics-stacked-item">
                    <span className="ai-label">Price Fluctuation Count</span>
                    <span className="ai-value" style={{ color: 'var(--accent-blue)' }}>
                      {fluctuations} {fluctuations === 1 ? 'change' : 'changes'}
                    </span>
                    <span className="ai-sub">detected across {history.length} scrapes</span>
                  </div>

                  <div className="divider my-2" />

                  <div className="analytics-stacked-item">
                    <span className="ai-label">Stock Availability</span>
                    <span className="ai-value" style={{ color: stockRate >= 70 ? 'var(--accent-emerald)' : 'var(--accent-rose)' }}>
                      {stockRate}% In Stock
                    </span>
                    <span className="ai-sub">{inStockCount} of {history.length} readings online</span>
                  </div>

                  <div className="divider my-2" />

                  <div className="analytics-stacked-item">
                    <span className="ai-label">Volatility Rating</span>
                    <span className="ai-value" style={{ color: fluctuations > 3 ? 'var(--accent-amber)' : 'var(--accent-emerald)' }}>
                      {fluctuations === 0 ? '🟢 Stable' : fluctuations <= 2 ? '🟡 Moderate' : '🔴 High Volatility'}
                    </span>
                    <span className="ai-sub">store pricing algorithm index</span>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>

      </div>
    </div>
  );
}
