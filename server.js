// server.js — Express entry point for the INE Price Tracker backend.
// Runs on Render (production) or locally (dev).
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const routes = require('./src/routes');

const app = express();
const PORT = process.env.PORT || 3001;

// Allow requests from Vite dev server (any local port) and deployed Vercel frontend.
const allowedOrigins = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:3000',
  process.env.FRONTEND_URL,
].filter(Boolean);

app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin) return cb(null, true);
      if (
        allowedOrigins.includes(origin) ||
        /\.vercel\.app$/.test(origin) ||
        /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin)
      ) {
        return cb(null, true);
      }
      cb(null, true); // Permissive fallback for public API endpoints
    },
    credentials: true,
  })
);

app.use(express.json());

// Health check — used by Render's health-check ping to keep the service warm.
app.get('/health', (_req, res) => res.json({ status: 'ok', ts: new Date().toISOString() }));

app.use('/api', routes);

const { runScrapeForAllActive } = require('./src/routes').runScrapeForAllActive
  ? require('./src/routes')
  : require('./src/scraper/scrapeRunner');

app.listen(PORT, () => {
  console.log(`[server] listening on port ${PORT}`);

  // Auto-check for overdue scrapes on server startup and every 15 minutes
  const triggerAutoScrape = async () => {
    try {
      console.log('[auto-scheduler] Checking for due/overdue product scrapes...');
      const results = await runScrapeForAllActive({ force: false });
      console.log('[auto-scheduler] Scrape check complete:', JSON.stringify(results));
    } catch (err) {
      console.error('[auto-scheduler] Scrape check error:', err);
    }
  };

  // Run initial check 5s after startup
  setTimeout(triggerAutoScrape, 5000);

  // Run periodic check every 15 minutes (900,000 ms)
  setInterval(triggerAutoScrape, 15 * 60 * 1000);
});
