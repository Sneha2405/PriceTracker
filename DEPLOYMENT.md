# 🚀 INE Price Tracker — Production Deployment Guide

This guide provides step-by-step instructions to deploy the full-stack Product Price & Stock Monitoring system (Express Node.js backend with Playwright scraper, Supabase PostgreSQL database, and React Vite frontend) to free-tier cloud platforms.

---

## 📋 Overview of Target Cloud Hosting

| Component | Platform | Build & Runtime Configuration |
| :--- | :--- | :--- |
| **Backend API & Scraper** | [Render.com](https://render.com) | Node.js environment + Playwright Chromium dependencies |
| **Frontend Dashboard** | [Vercel](https://vercel.com) | Vite React static SPA build (Root Directory: `frontend`) |
| **PostgreSQL Database** | [Supabase](https://supabase.com) | Hosted PostgreSQL database with custom SQL schema |
| **Automated Cron Trigger** | [cron-job.org](https://cron-job.org) | External HTTPS POST webhook trigger every 15–120 minutes |

---

## Step 1: 🗄️ Supabase Database Setup

1. Sign in to your [Supabase Dashboard](https://supabase.com) and create a new project.
2. Navigate to the **SQL Editor** tab in the sidebar.
3. Open `schema.sql` from your project repository root, copy its contents, paste them into the SQL editor, and click **Run**:

```sql
-- Tracked products table
CREATE TABLE IF NOT EXISTS tracked_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_product_id TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  brand TEXT,
  category TEXT,
  sku TEXT,
  product_url TEXT NOT NULL,
  image_url TEXT,
  is_active BOOLEAN DEFAULT true,
  scrape_interval_minutes INT DEFAULT 120,
  target_price NUMERIC(10, 2),
  alert_email TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Price history table
CREATE TABLE IF NOT EXISTS price_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES tracked_products(id) ON DELETE CASCADE,
  price NUMERIC(10, 2) NOT NULL,
  mrp NUMERIC(10, 2),
  discount_percent NUMERIC(5, 2),
  currency TEXT DEFAULT 'INR',
  in_stock BOOLEAN DEFAULT true,
  stock_qty INT,
  scraped_at TIMESTAMPTZ DEFAULT now()
);

-- Scrape audit logs table
CREATE TABLE IF NOT EXISTS scrape_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES tracked_products(id) ON DELETE CASCADE,
  run_id UUID NOT NULL,
  attempt_number INT NOT NULL,
  status TEXT NOT NULL,
  duration_ms INT,
  http_status INT,
  structure_signature TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Helper view for latest prices per product
CREATE OR REPLACE VIEW latest_prices AS
SELECT DISTINCT ON (product_id)
  product_id, price, mrp, discount_percent, currency, in_stock, stock_qty, scraped_at
FROM price_history
ORDER BY product_id, scraped_at DESC;
```

4. Go to **Project Settings ➔ API** and copy:
   - **Project URL** (`SUPABASE_URL`)
   - **`service_role` secret key** (`SUPABASE_SERVICE_ROLE_KEY`)

---

## Step 2: ⚙️ Backend Deployment (Render)

1. Push your repository to **GitHub**.
2. Log in to [Render Dashboard](https://dashboard.render.com) and click **New ➔ Web Service**.
3. Connect your GitHub repository.
4. Fill out the service configuration:
   - **Name**: `ine-price-tracker-backend`
   - **Region**: Oregon (US West) or Frankfurt (EU)
   - **Branch**: `main`
   - **Runtime**: `Node`
   - **Build Command**:
     ```bash
     npm install && npx playwright install --with-deps chromium
     ```
   - **Start Command**:
     ```bash
     node server.js
     ```
5. Add the following **Environment Variables**:

| Variable Name | Example Value | Description |
| :--- | :--- | :--- |
| `SUPABASE_URL` | `https://xxxxxx.supabase.co` | Supabase Project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJhbGci...` | Supabase `service_role` API secret |
| `STORE_BASE_URL` | `https://demo.inelabteamdev.com` | Target mock storefront URL |
| `CRON_SECRET` | `dev_secret_12345` | Shared authentication key for cron webhooks |
| `FRONTEND_URL` | `https://ine-price-tracker.vercel.app` | Allowed CORS frontend origin |

6. Click **Create Web Service**. Once deployed, copy your backend URL (e.g. `https://ine-price-tracker-backend.onrender.com`).

---

## Step 3: 🎨 Frontend Deployment (Vercel)

1. Log in to [Vercel Dashboard](https://vercel.com) and click **Add New ➔ Project**.
2. Select your GitHub repository.
3. In project settings, set **Root Directory** to `frontend`.
4. Add the following **Environment Variable**:

| Variable Name | Value | Description |
| :--- | :--- | :--- |
| `VITE_API_URL` | `https://ine-price-tracker-backend.onrender.com/api` | Backend API endpoint URL |

5. Click **Deploy**. Vercel will build the React Vite application and issue a production URL (e.g. `https://ine-price-tracker.vercel.app`).

---

## Step 4: ⏱️ Scheduled Scraper Trigger (cron-job.org)

Because Render free instances go to sleep after inactivity, an external cron trigger ensures automatic wake-ups and routine price updates:

1. Create a free account at [cron-job.org](https://cron-job.org).
2. Click **Create Cron Job**:
   - **Title**: `INE Price Tracker Auto Scrape`
   - **URL**: `https://ine-price-tracker-backend.onrender.com/api/scrape/run`
   - **Execution Schedule**: Every 15 to 120 minutes
   - **Request Method**: `POST`
3. Under **Headers**, click **Add Header**:
   - **Name**: `X-Cron-Secret`
   - **Value**: `<your_CRON_SECRET_value_from_step_2>`
4. Save and enable the job.

---

## 🔍 Verification & Diagnostics

Once deployed:
1. Open your backend health URL: `https://ine-price-tracker-backend.onrender.com/api/health` ➔ Should return `{"status":"ok"}`.
2. Open your Vercel frontend URL ➔ Search for `ironwood` or `headphones` and click **+ Track Product**.
3. Click **⚡ Scrape All Now** on the dashboard to run live Playwright telemetry in background.
