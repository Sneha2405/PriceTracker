// src/components/NotificationCenter.jsx
import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import './NotificationCenter.css';

export default function NotificationCenter() {
  const [alerts, setAlerts] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);
  const navigate = useNavigate();

  const fetchAlerts = async () => {
    try {
      const { data: products } = await api.get('/products/tracked');
      const activeAlerts = [];

      products.forEach((p) => {
        const latest = Array.isArray(p.latest_prices) ? p.latest_prices[0] : p.latest_prices;
        if (!latest) return;

        // 1. Target Price Drop Alert
        if (p.target_price != null && Number(latest.price) <= Number(p.target_price)) {
          activeAlerts.push({
            id: `target-${p.id}`,
            productId: p.id,
            type: 'price_drop',
            title: '🎯 Target Price Met!',
            message: `${p.name} is now ₹${Number(latest.price).toLocaleString('en-IN')} (Target: ₹${Number(p.target_price).toLocaleString('en-IN')})`,
            timestamp: latest.scraped_at,
          });
        }

        // 2. Back In Stock Alert
        if (latest.in_stock === true && latest.stock_qty != null && latest.stock_qty > 0) {
          activeAlerts.push({
            id: `stock-${p.id}`,
            productId: p.id,
            type: 'in_stock',
            title: '📦 Back In Stock',
            message: `${p.name} is available now (${latest.stock_qty} left in stock)`,
            timestamp: latest.scraped_at,
          });
        }
      });

      setAlerts(activeAlerts);
    } catch (err) {
      console.warn('[NotificationCenter] Failed to fetch alerts:', err.message);
    }
  };

  useEffect(() => {
    fetchAlerts();
    const interval = setInterval(fetchAlerts, 60_000);
    return () => clearInterval(interval);
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleAlertClick = (productId) => {
    setIsOpen(false);
    navigate(`/product/${productId}`);
  };

  return (
    <div className="notif-center" ref={dropdownRef}>
      <button
        type="button"
        className={`notif-bell-btn ${isOpen ? 'active' : ''}`}
        onClick={() => setIsOpen(!isOpen)}
        aria-label="In-App Notifications"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {alerts.length > 0 && (
          <span className="notif-badge">{alerts.length}</span>
        )}
      </button>

      {isOpen && (
        <div className="notif-dropdown fade-in">
          <div className="notif-header">
            <span className="notif-title">In-App Alerts</span>
            <span className="notif-count">{alerts.length} active</span>
          </div>

          <div className="notif-body">
            {alerts.length === 0 ? (
              <div className="notif-empty">
                <span>🔔 No active price or stock alerts</span>
              </div>
            ) : (
              alerts.map((a) => (
                <div
                  key={a.id}
                  className={`notif-item ${a.type}`}
                  onClick={() => handleAlertClick(a.productId)}
                  role="button"
                  tabIndex={0}
                >
                  <div className="notif-item-title">{a.title}</div>
                  <div className="notif-item-msg">{a.message}</div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
