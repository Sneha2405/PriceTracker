// src/components/ProductCard.jsx
import { Link } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
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
  const latest = Array.isArray(product.latest_prices)
    ? product.latest_prices[0]
    : (product.latest_prices ?? null);
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

        <div className="pc-price">
          {latest?.price != null ? (
            <span className="pc-price-value tabular-nums">
              {formatPrice(latest.price, latest.currency)}
            </span>
          ) : (
            <span className="pc-price-empty text-muted text-sm">No price data</span>
          )}
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
