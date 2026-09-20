// src/components/StockBadge.jsx
import './StockBadge.css';

export default function StockBadge({ inStock, stockQty }) {
  if (inStock === null || inStock === undefined) {
    return (
      <span className="stock-indicator text-muted">
        <span className="status-dot dot-muted" />
        Unknown
      </span>
    );
  }

  if (!inStock) {
    return (
      <span className="stock-indicator text-muted">
        <span className="status-dot dot-red" />
        Out of stock
      </span>
    );
  }

  if (stockQty != null && stockQty <= 10) {
    return (
      <span className="stock-indicator text-muted">
        <span className="status-dot dot-amber" />
        Low stock ({stockQty} left)
      </span>
    );
  }

  return (
    <span className="stock-indicator text-muted">
      <span className="status-dot dot-green" />
      {stockQty != null ? `In stock (${stockQty})` : 'In stock'}
    </span>
  );
}
