import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import api from '../api';
import ProductCard from '../components/ProductCard';
import { LayersIcon, RefreshCwIcon } from '../components/Icons';
import './DashboardPage.css';

export default function DashboardPage() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('all'); // 'all' | 'in_stock' | 'out_of_stock' | 'pending'
  const [sortBy, setSortBy] = useState('recent'); // 'recent' | 'price_asc' | 'price_desc' | 'name'

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const { data } = await api.get('/products/tracked');
      setProducts(data);
    } catch (err) {
      setError(err.response?.data?.error ?? err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Auto-refresh every 60 s so the dashboard stays live
  useEffect(() => {
    const id = setInterval(load, 60_000);
    return () => clearInterval(id);
  }, [load]);

  const getLatest = (p) => (Array.isArray(p.latest_prices) ? p.latest_prices[0] : p.latest_prices ?? null);

  // Filtered & Sorted products calculation
  const processedProducts = products.filter((p) => {
    const latest = getLatest(p);
    const matchesSearch =
      !searchQuery ||
      p.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.store_product_id?.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;

    if (filterStatus === 'in_stock') return latest?.in_stock === true;
    if (filterStatus === 'out_of_stock') return latest?.in_stock === false;
    if (filterStatus === 'pending') return !latest;
    return true;
  }).sort((a, b) => {
    const latestA = getLatest(a);
    const latestB = getLatest(b);
    if (sortBy === 'price_asc') {
      return (Number(latestA?.price) || 0) - (Number(latestB?.price) || 0);
    }
    if (sortBy === 'price_desc') {
      return (Number(latestB?.price) || 0) - (Number(latestA?.price) || 0);
    }
    if (sortBy === 'name') {
      return a.name.localeCompare(b.name);
    }
    // Default: 'recent' (by created_at or scraped_at)
    const dateA = new Date(latestA?.scraped_at || a.created_at || 0);
    const dateB = new Date(latestB?.scraped_at || b.created_at || 0);
    return dateB - dateA;
  });

  const [bulkScraping, setBulkScraping] = useState(false);
  const [bulkFeedback, setBulkFeedback] = useState(null);

  const handleBulkScrape = async () => {
    setBulkScraping(true);
    setBulkFeedback('Triggered bulk Playwright scrape across all tracked products...');
    try {
      await api.post('/scrape/run?force=true', {}, { headers: { 'X-Cron-Secret': 'dev_secret' } }).catch(() => {
        // Fallback for dev mode without secret check
        return api.post('/scrape/run?force=true');
      });
      // Refresh dashboard after a short delay
      setTimeout(async () => {
        await load();
        setBulkScraping(false);
        setBulkFeedback('Bulk scrape triggered successfully!');
        setTimeout(() => setBulkFeedback(null), 5000);
      }, 3000);
    } catch (err) {
      console.warn('Bulk scrape trigger notice:', err);
      // Trigger individual scrapes as fallback
      setBulkFeedback('Scraping products live in sequence...');
      for (const p of products) {
        await api.post(`/products/${p.id}/scrape`).catch(() => {});
      }
      setTimeout(async () => {
        await load();
        setBulkScraping(false);
        setBulkFeedback('Bulk refresh initiated!');
        setTimeout(() => setBulkFeedback(null), 5000);
      }, 4000);
    }
  };

  return (
    <div className="page hero-gradient">
      <div className="container">
        {/* Bulk feedback banner */}
        {bulkFeedback && (
          <div className="scrape-feedback-banner success fade-in mb-4 flex items-center justify-between">
            <span>⚡ {bulkFeedback}</span>
            <button className="sfb-close" onClick={() => setBulkFeedback(null)}>✕</button>
          </div>
        )}

        {/* Header */}
        <div className="dash-hero fade-in">
          <div className="dash-hero-title-wrap">
            <h1 className="dash-title">Tracked Products</h1>
            {products.length > 0 && (
              <p className="text-muted text-xs mono mt-1">
                {(() => {
                  const lastScrapedTime = products.reduce((latestTime, p) => {
                    const latest = getLatest(p);
                    if (!latest?.scraped_at) return latestTime;
                    const date = new Date(latest.scraped_at);
                    return !latestTime || date > latestTime ? date : latestTime;
                  }, null);
                  return lastScrapedTime
                    ? `Last scrape completed ${formatDistanceToNow(lastScrapedTime, { addSuffix: true })}`
                    : 'System active';
                })()}
              </p>
            )}
          </div>

          <div className="dash-actions flex items-center gap-3">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleBulkScrape}
              disabled={bulkScraping}
            >
              <RefreshCwIcon size={14} className={bulkScraping ? 'spinner' : ''} />
              {bulkScraping ? 'Scraping All…' : '⚡ Scrape All Now'}
            </button>
            <Link to="/search" className="btn btn-primary">
              + Track Product
            </Link>
          </div>
        </div>

        {/* Stat Row */}
        {!loading && products.length > 0 && (
          <div className="dash-stat-row fade-in">
            <div
              className={`stat-hero-wrap ${filterStatus === 'all' ? 'active' : ''}`}
              onClick={() => setFilterStatus('all')}
              role="button"
              tabIndex={0}
            >
              <span className="stat-hero-number">{products.length}</span>
              <span className="stat-hero-label">Total Tracked</span>
            </div>

            <div className="stat-inline-strip">
              <button
                type="button"
                className={`stat-inline-item ${filterStatus === 'in_stock' ? 'active' : ''}`}
                onClick={() => setFilterStatus('in_stock')}
              >
                <span className="stat-inline-dot emerald" />
                <span className="stat-inline-label">In Stock</span>
                <span className="stat-inline-val">
                  {products.filter((p) => getLatest(p)?.in_stock).length}
                </span>
              </button>

              <span className="stat-strip-divider">•</span>

              <button
                type="button"
                className={`stat-inline-item ${filterStatus === 'out_of_stock' ? 'active' : ''}`}
                onClick={() => setFilterStatus('out_of_stock')}
              >
                <span className="stat-inline-dot rose" />
                <span className="stat-inline-label">Out of Stock</span>
                <span className="stat-inline-val">
                  {products.filter((p) => getLatest(p)?.in_stock === false).length}
                </span>
              </button>

              <span className="stat-strip-divider">•</span>

              <button
                type="button"
                className={`stat-inline-item ${filterStatus === 'pending' ? 'active' : ''}`}
                onClick={() => setFilterStatus('pending')}
              >
                <span className="stat-inline-dot amber" />
                <span className="stat-inline-label">Pending Scrape</span>
                <span className="stat-inline-val">
                  {products.filter((p) => !getLatest(p)).length}
                </span>
              </button>
            </div>
          </div>
        )}

        {/* Search & Sort Controls Toolbar */}
        {!loading && products.length > 0 && (
          <div className="dash-toolbar fade-in mt-4">
            <div className="search-input-wrapper flex-1">
              <input
                type="text"
                className="input text-sm"
                placeholder="Search tracked products by name or SKU..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <button
                  type="button"
                  className="search-clear-btn"
                  onClick={() => setSearchQuery('')}
                >
                  ✕
                </button>
              )}
            </div>

            <div className="toolbar-controls flex items-center gap-3">
              <div className="select-wrapper">
                <select
                  className="input select text-sm"
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                >
                  <option value="recent">Recently Scraped</option>
                  <option value="price_asc">Price: Low to High</option>
                  <option value="price_desc">Price: High to Low</option>
                  <option value="name">Name (A–Z)</option>
                </select>
              </div>

              {(searchQuery || filterStatus !== 'all') && (
                <button
                  type="button"
                  className="btn btn-sm btn-ghost"
                  onClick={() => {
                    setSearchQuery('');
                    setFilterStatus('all');
                  }}
                >
                  Reset Filters
                </button>
              )}
            </div>
          </div>
        )}

        <div className="divider" />

        {/* Body */}
        {loading && (
          <div className="product-grid">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="card skeleton" style={{ height: 170 }} />
            ))}
          </div>
        )}

        {error && (
          <div className="error-banner fade-in">
            <span>{error}</span>
            <button className="btn btn-sm btn-secondary" onClick={load}>Retry</button>
          </div>
        )}

        {!loading && !error && products.length === 0 && (
          <div className="empty-state fade-in">
            <div className="empty-state-icon">
              <LayersIcon size={40} />
            </div>
            <h3>No products tracked yet</h3>
            <p className="mt-2 text-muted">
              Search for any catalog product to start tracking historical prices.
            </p>
            <Link to="/search" className="btn btn-primary mt-4">Search Catalog</Link>
          </div>
        )}

        {!loading && !error && products.length > 0 && processedProducts.length === 0 && (
          <div className="empty-state fade-in">
            <h3>No matching products found</h3>
            <p className="mt-2 text-muted">
              Try adjusting your search query or filter selection.
            </p>
            <button
              type="button"
              className="btn btn-secondary mt-4"
              onClick={() => {
                setSearchQuery('');
                setFilterStatus('all');
              }}
            >
              Clear Filters
            </button>
          </div>
        )}

        {!loading && !error && processedProducts.length > 0 && (
          <div className="product-grid">
            {processedProducts.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
