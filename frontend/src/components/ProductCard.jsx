// src/components/ProductCard.jsx
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import api from '../api';
import StockBadge from './StockBadge';
import './ProductCard.css';

function formatPrice(price, currency = 'INR') {
  if (price == null) return '—';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(price);
}

export default function ProductCard({ product }) {
  const [history, setHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const latest = Array.isArray(product.latest_prices)
    ? product.latest_prices[0]
    : (product.latest_prices ?? null);

  useEffect(() => {
    let isMounted = true;
    setLoadingHistory(true);
    api.get(`/products/${product.id}/history`)
      .then((res) => {
        if (isMounted && Array.isArray(res.data)) {
          setHistory(res.data);
        }
      })
      .catch(() => {
        // Silently fall back if history fails to load
      })
      .finally(() => {
        if (isMounted) setLoadingHistory(false);
      });
    return () => { isMounted = false; };
  }, [product.id]);

  const scrapedAgo = latest?.scraped_at
    ? formatDistanceToNow(new Date(latest.scraped_at), { addSuffix: true })
    : null;

  const isOutOfStock = latest?.in_stock === false;
  const isLowStock = latest?.in_stock === true && latest?.stock_qty != null && latest.stock_qty <= 10;

  const stockClass = isOutOfStock
    ? 'state-out-of-stock'
    : isLowStock
    ? 'state-low-stock'
    : 'state-healthy';

  // Compute price and stock history metrics
  const validPrices = history.map((h) => Number(h.price)).filter((p) => p > 0);
  const minPrice = validPrices.length ? Math.min(...validPrices) : null;
  const maxPrice = validPrices.length ? Math.max(...validPrices) : null;

  const prevPrice = history.length >= 2 ? Number(history[history.length - 2].price) : null;
  const curPrice = latest?.price != null ? Number(latest.price) : null;
  const priceDelta = (curPrice != null && prevPrice != null) ? curPrice - prevPrice : null;

  const inStockScrapes = history.filter((h) => h.in_stock).length;
  const stockHistoryPct = history.length ? Math.round((inStockScrapes / history.length) * 100) : null;

  return (
    <Link to={`/product/${product.id}`} className={`product-card card fade-in ${stockClass}`}>
      <div className="pc-top-bar">
        <StockBadge
          inStock={latest?.in_stock ?? null}
          stockQty={latest?.stock_qty ?? null}
        />
        {product.brand && <span className="pc-brand text-xs text-muted">{product.brand}</span>}
      </div>

      <div className="pc-body">
        <h3 className="pc-name">{product.name}</h3>

        <div className="pc-price-row">
          <div className="pc-price">
            {latest?.price != null ? (
              <span className="pc-price-value tabular-nums">
                {formatPrice(latest.price, latest.currency)}
              </span>
            ) : (
              <span className="pc-price-empty text-muted text-sm">No price data</span>
            )}
          </div>

          {priceDelta !== null && (
            <span className={`pc-price-delta ${priceDelta > 0 ? 'up' : priceDelta < 0 ? 'down' : 'flat'}`}>
              {priceDelta > 0 ? '▲' : priceDelta < 0 ? '▼' : '—'} {priceDelta !== 0 ? formatPrice(Math.abs(priceDelta), latest?.currency) : 'Stable'}
            </span>
          )}
        </div>

        {/* Inline Price & Stock History Block */}
        <div className="pc-history-box">
          <div className="pc-history-row">
            <span className="pc-history-title">Price Range</span>
            <span className="pc-history-value mono">
              {minPrice != null && maxPrice != null
                ? `${formatPrice(minPrice, latest?.currency)} – ${formatPrice(maxPrice, latest?.currency)}`
                : history.length > 0 ? formatPrice(curPrice, latest?.currency) : 'Loading range…'}
            </span>
          </div>

          <div className="pc-history-row">
            <span className="pc-history-title">Stock History</span>
            <div className="pc-stock-history-pills">
              {history.length > 0 ? (
                <>
                  <span className={`pc-stock-pct ${stockHistoryPct >= 70 ? 'good' : 'poor'}`}>
                    {stockHistoryPct}% In-Stock
                  </span>
                  <div className="pc-history-dots" title={`History across ${history.length} scrape runs`}>
                    {history.slice(-6).map((h, idx) => (
                      <span
                        key={idx}
                        className={`pc-dot ${h.in_stock ? 'dot-green' : 'dot-red'}`}
                        title={`${h.in_stock ? 'In Stock' : 'Out of Stock'} on ${new Date(h.scraped_at).toLocaleTimeString()}`}
                      />
                    ))}
                  </div>
                </>
              ) : (
                <span className="text-muted text-xs">{loadingHistory ? 'Loading history…' : `${history.length} runs`}</span>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="pc-footer">
        <span className="text-xs text-muted">
          {scrapedAgo ? `Scraped ${scrapedAgo}` : 'Never scraped'}
        </span>
        <span className="pc-view-link text-xs">View telemetry →</span>
      </div>
    </Link>
  );
}

