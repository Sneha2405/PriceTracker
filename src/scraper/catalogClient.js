// src/scraper/catalogClient.js
//
// The catalog endpoint (/api/catalog?page=&pageSize=) is the stable part
// of the store: same shape every time, no price/stock on it. Used for
// product search/selection only. Price volatility lives in the
// per-product endpoint, handled separately in productClient.js.

const BASE_URL = process.env.STORE_BASE_URL || 'https://demo.inelabteamdev.com';

/**
 * Fetch a single catalog page with retry backoff on 429 Too Many Requests.
 */
async function fetchCatalogPage(page = 1, pageSize = 20, retries = 3) {
  const url = `${BASE_URL}/api/catalog?page=${page}&pageSize=${pageSize}`;
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url);
      if (res.status === 429) {
        // Exponential backoff on rate limit
        await new Promise((r) => setTimeout(r, 400 * attempt));
        continue;
      }
      if (!res.ok) {
        throw new Error(`Catalog fetch failed: ${res.status} ${res.statusText}`);
      }
      return await res.json();
    } catch (err) {
      if (attempt === retries) throw err;
      await new Promise((r) => setTimeout(r, 300 * attempt));
    }
  }
}

let catalogCache = null;
let catalogCacheTime = 0;
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes cache

/**
 * Fetches and caches all catalog items in memory for fast instant searching.
 */
async function getAllCatalogItems() {
  if (catalogCache && Date.now() - catalogCacheTime < CACHE_TTL_MS) {
    return catalogCache;
  }

  const first = await fetchCatalogPage(1, 100);
  const items = [...(first.items || [])];
  const totalPages = first.pages ?? Math.ceil((first.total || 100) / 100);

  const CHUNK_SIZE = 3;
  for (let page = 2; page <= totalPages; page += CHUNK_SIZE) {
    const pagePromises = [];
    for (let p = page; p < page + CHUNK_SIZE && p <= totalPages; p++) {
      pagePromises.push(fetchCatalogPage(p, 100));
    }
    const batches = await Promise.all(pagePromises);
    for (const batch of batches) {
      if (batch?.items) items.push(...batch.items);
    }
  }

  // Deduplicate items by ID
  const uniqueMap = new Map();
  for (const item of items) {
    if (!uniqueMap.has(item.id)) {
      uniqueMap.set(item.id, item);
    }
  }

  catalogCache = Array.from(uniqueMap.values());
  catalogCacheTime = Date.now();
  return catalogCache;
}

/**
 * Search the full catalog by product name, brand, or SKU (case-insensitive).
 * Strictly filters out non-matching products.
 */
async function searchProducts(query) {
  const q = query.trim().toLowerCase();
  if (!q) return [];

  const allItems = await getAllCatalogItems();

  const filtered = allItems.filter((p) => {
    const nameMatch = p.name?.toLowerCase().includes(q);
    const brandMatch = p.brand?.toLowerCase().includes(q);
    const skuMatch = p.sku?.toLowerCase().includes(q);
    return nameMatch || brandMatch || skuMatch;
  });

  return filtered.sort((a, b) => {
    const aStartsWith = a.name?.toLowerCase().startsWith(q) ? 0 : 1;
    const bStartsWith = b.name?.toLowerCase().startsWith(q) ? 0 : 1;
    return aStartsWith - bStartsWith;
  });
}

module.exports = { fetchCatalogPage, searchProducts, BASE_URL };
