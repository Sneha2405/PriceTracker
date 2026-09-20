# INE Product Price & Stock Tracker

A resilient, full-stack internal operations dashboard for automated product price and stock monitoring. Built for the **INE Software Engineer Intern Assignment** targeting the mock storefront at `https://demo.inelabteamdev.com/`.

---

## ⚡ System Architecture & Monorepo Structure

The project uses a standard **Full-Stack Monorepo Architecture**, cleanly isolating the Node.js Playwright backend from the React + Vite frontend:

```text
ine-price-tracker/
├── server.js                     # Express API entry point
├── schema.sql                    # Supabase PostgreSQL schema definition
├── src/                          # ⚙️ BACKEND ENGINE (Node.js / Express)
│   ├── db.js                     # Supabase database client
│   ├── routes.js                 # REST API endpoints & background scraper triggers
│   └── scraper/
│       ├── catalogClient.js      # In-memory fast catalog cache & store search
│       ├── productScraper.js     # Playwright engine (WASM challenge & encrypted price decryption)
│       └── scrapeRunner.js       # Execution orchestrator, plausibility guard & logger
├── scripts/
│   └── headedScrape.js           # Headed browser execution script for visual demo recording
└── frontend/                     # 🎨 FRONTEND DASHBOARD (React + Vite)
    └── src/
        ├── api.js                # Axios HTTP client with fallback resolution
        ├── main.jsx              # React application entry
        ├── App.jsx               # Client routing setup
        ├── pages/
        │   ├── DashboardPage.jsx # Main ops tracking view (Stat row, toolbar, product cards)
        │   ├── SearchPage.jsx    # Live store catalog search & 1-click product tracking
        │   └── ProductPage.jsx   # 2-column telemetry detail view (Recharts line chart & scrape logs)
        └── components/
            ├── ProductCard.jsx   # Stock-differentiated card component with hero price styling
            ├── StockBadge.jsx    # Colorblind-accessible status indicator (shape + color)
            ├── PriceChart.jsx    # Historical price movement area chart
            └── ScrapeLog.jsx     # Detailed attempt-level audit trail table
```

### End-to-End Data Flow

```text
┌─────────────────────────┐      HTTP REST      ┌───────────────────────────┐      SQL Queries      ┌─────────────────────────┐
│ React Frontend (Vite)   │ ◄─────────────────► │ Express Backend (Node.js) │ ◄───────────────────► │ Supabase PostgreSQL DB  │
│ Deployed on Vercel      │                     │ Deployed on Render        │                       │ Hosted on Supabase      │
└─────────────────────────┘                     └─────────────┬─────────────┘                       └─────────────────────────┘
                                                              │
                                                        Playwright CLI
                                                              │
                                                              ▼
                                                ┌───────────────────────────┐
                                                │ Target Mock Storefront    │
                                                │ demo.inelabteamdev.com    │
                                                └───────────────────────────┘
```

---

## ✨ Key Features & Technical Highlights

### 🔍 1. Intelligent Playwright Scraper Engine
- **WASM & Fingerprint Handshake**: Automatically navigates the mock storefront's `/api/challenge` WebAssembly proof-of-work challenge, WebGL canvas fingerprinting, and session handshake.
- **Client-Side DOM Decryption**: Hover-activates `.price-block` triggers (`Reveal price`, `REFRESH PRICE`) and extracts client-decrypted price values directly from DOM nodes.
- **Stock Quantity Regex Extractor**: Parses complex inventory text (e.g. `IN STOCK · 120 LEFT`, `Low Stock (3 left)`, `0 left`) into structured integer stock counts.
- **High-Resilience Retries**: Configured with `MAX_ATTEMPTS = 8` and fast `250ms` backoff to bypass intermittent store 500 challenges.
- **Plausible Price Guard**: Rejects spurious readings (>10× jump or >90% drop) and logs them safely without corrupting `price_history`.
- **Honest Scrape Audit Trails**: Every attempt (`success`, `retried`, `failed`) records execution duration, attempt count, and error strings in `scrape_logs`.

### 🎨 2. Accessible Financial Ops Dashboard UI
- **Dark Warm-Black Palette**: Built with a custom `#13110e` base, `#1b1814` card surfaces, and `#f5f2ed` high-contrast typography.
- **Hero Price Accent**: `#f59e0b` Warm Amber is strictly reserved for price figures (`tabular-nums` alignment) to maximize visual hierarchy.
- **WCAG AA Colorblind Accessibility**: Stock status indicators use distinct shapes—**Solid Filled Circle** for In-Stock, **Hollow Ring Circle** for Out-of-Stock, and **Solid Square** for Low-Stock—ensuring clarity under Deuteranopia and Protanopia.
- **State-Differentiated Product Cards**: Out-of-stock items automatically recede with `opacity: 0.6` / `grayscale(0.4)`, while low-stock items (<10 left) feature a subtle left accent border.
- **Real-Time Toolbar**: Client-side name/SKU filter input, status filters (*In Stock*, *Out of Stock*, *Pending*), and instant price/date sorting.

---

## 🚀 Local Development Setup

### Prerequisites
- **Node.js**: `v18+`
- **npm**: `v9+`

### 1. Repository Setup & Environment
```bash
# Copy sample environment configuration
cp .env.example .env
```

Ensure your `.env` file contains your Supabase parameters and secret token:
```env
PORT=3001
STORE_BASE_URL=https://demo.inelabteamdev.com
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key
CRON_SECRET=dev_secret
```

### 2. Backend Setup
```bash
# Install root dependencies
npm install

# Download Chromium browser binary for Playwright
npx playwright install chromium

# Start backend Express server (runs on http://localhost:3001)
npm run dev
```

### 3. Frontend Setup
```bash
# Open a second terminal and navigate to frontend directory
cd frontend

# Install frontend dependencies
npm install

# Start Vite React development server (runs on http://localhost:5173)
npm run dev
```

---

## 📡 REST API Reference

| Method | Endpoint | Description | Query / Header Parameters |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/health` | Service health status check | None |
| `GET` | `/api/products/search` | Instant store catalog search | `?q=ironwood` |
| `POST` | `/api/products/track` | Track a store catalog product | Body: `{ store_product_id, target_price }` |
| `GET` | `/api/products/tracked` | Fetch all tracked items & latest readings | None |
| `POST` | `/api/products/:id/scrape` | Trigger manual Playwright scrape | URL param: `id` |
| `GET` | `/api/products/:id/history`| Fetch historical price readings | URL param: `id` |
| `GET` | `/api/products/:id/logs` | Fetch attempt-level scrape audit logs | URL param: `id` |
| `POST` | `/api/scrape/run` | Execute cron batch scrape | Header: `X-Cron-Secret: dev_secret` |

---

## 📹 Headed Scraper & Video Demo

To observe the Playwright scraper execution visually with a visible browser window:

```bash
# Execute headed scrape for a specific product ID (e.g., product 161)
npm run scrape:headed 161
```

This launches Chromium in visible headed mode with slow-motion actions, showing:
1. Automated page navigation to `https://demo.inelabteamdev.com/product/161`.
2. Execution of the WASM proof-of-work challenge and session handshake.
3. Mouse hover over `.price-block`.
4. Triggering price reveal and extracting decrypted DOM values into `price_history`.

---

## ☁️ Production Deployment

### Backend ➜ Render
1. Connect repository to Render as a **Web Service**.
2. Set **Build Command**: `npm install && npx playwright install chromium --with-deps`
3. Set **Start Command**: `node server.js`
4. Configure environment variables: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `STORE_BASE_URL`, `CRON_SECRET`.

### Frontend ➜ Vercel
1. Import repository on Vercel and set **Root Directory** to `frontend`.
2. Add environment variable: `VITE_API_URL=https://your-render-service.onrender.com/api`.
3. Deploy.

### Automated Scrape Trigger ➜ cron-job.org
1. Create a job pointing to `https://your-render-service.onrender.com/api/scrape/run`.
2. Method: `POST` with Custom Header `X-Cron-Secret: <your_secret>`.
3. Schedule: Every 15 minutes.
