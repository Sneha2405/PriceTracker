# Design Note: Scraping Reliability, Architecture Trade-Offs, & AI Learning Iterations

## 1. Scraping Reliability & Resilience Strategy

- **WASM & Challenge Navigation**: Handled the target storefront’s anti-bot WebAssembly challenge (`/api/challenge`) and canvas fingerprinting by configuring Playwright with realistic user-agent strings, explicit navigation state checks (`domcontentloaded`), and automatic retry handlers.
- **Client-Side DOM Price Decryption**: Automated hover and click triggers on obscured `.price-block` DOM nodes (`Reveal price`, `REFRESH PRICE`) to force the target site's frontend execution script to decode client-encrypted prices directly into readable DOM nodes.
- **Stock Regex Extractor**: Parsed complex, non-standard inventory strings (e.g. `IN STOCK · 120 LEFT`, `Low Stock (3 left)`, `0 left`) into normalized integer stock counts using robust fallback regular expressions.
- **High-Resilience Retries & Audit Trails**: Implemented up to 8 retries with 250ms backoff to transparently bypass intermittent store 500 challenge responses. Every attempt (`success`, `retried`, `failed`) records execution duration, attempt count, and error strings in `scrape_logs` for complete auditability.
- **Plausibility Guard**: Applied dynamic threshold validation to filter out anomalous price readings (>10× jump or >90% drop) before database insertion, preventing data corruption during target site DOM structure shifts.

---

## 2. Key Architecture Trade-Offs

- **Headless Browser Overhead vs. Scraping Fidelity**: Chose headless Playwright Chromium over lightweight HTTP fetchers (`axios` / `cheerio`). While Playwright introduces higher memory consumption, it was essential for executing client-side JavaScript, solving WebAssembly challenges, and rendering dynamic DOM elements.
- **Granular Attempt Auditing vs. Database Storage**: Opted to log every single scrape attempt in `scrape_logs` rather than only saving final successful prices. This added minor DB write volume but provided complete operational visibility into target store health and challenge failure rates.

---

## 3. AI Tool Missteps & Course Corrections

- **Initial Misstep (Static HTTP Parsing)**: On the first iteration, AI generated standard HTTP `fetch` / `cheerio` scrapers. This failed because the mock store obfuscates prices behind client-side JavaScript execution and WebAssembly proof-of-work handshakes.
  - **Correction**: Re-architected the scraping engine using Playwright, adding simulated mouse hover events to trigger dynamic price decoding.
- **Deployment Misstep (Render Binary Cache Eviction)**: AI initially relied on Playwright's default global cache path (`~/.cache/ms-playwright`). On Render's ephemeral server instances, browser binaries were missing on deployment boot.
  - **Correction**: Set `process.env.PLAYWRIGHT_BROWSERS_PATH = '0'` to store Chromium binaries directly within `node_modules` and configured `"postinstall": "npx playwright install chromium"` in `package.json`.
