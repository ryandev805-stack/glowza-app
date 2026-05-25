// ─────────────────────────────────────────────────────────────────────────────
// competitor-prices.js
// POST /api/competitor-prices  { query: string, limit?: number }
// ─────────────────────────────────────────────────────────────────────────────

const TIMEOUT_MS = 8_000;
const MIN_RELEVANCE = 0.3;

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

const SHOPIFY_STORES = [
  { domain: 'bagallery.com', name: 'Bagallery' },
  { domain: 'www.elo.pk', name: 'Elo' },
  { domain: 'www.sapphireonline.pk', name: 'Sapphire' },
  { domain: 'www.sanasafinaz.com', name: 'Sana Safinaz' },
];

const IMAGE_SEARCH_DOMAINS = [
  'daraz.pk',
  'bagallery.com',
  'elo.pk',
  'naheed.pk',
  'sapphireonline.pk',
  'sanasafinaz.com',
  'khaadi.com',
  'alkaram.com',
  'gul-ahmed.com',
  'limelight.pk',
];

const SOURCE_NAMES = {
  'daraz.pk': 'Daraz',
  'bagallery.com': 'Bagallery',
  'elo.pk': 'Elo',
  'naheed.pk': 'Naheed',
  'sapphireonline.pk': 'Sapphire',
  'sanasafinaz.com': 'Sana Safinaz',
  'khaadi.com': 'Khaadi',
  'alkaram.com': 'Al-Karam',
  'gul-ahmed.com': 'Gul Ahmed',
  'limelight.pk': 'Limelight',
};

// ─── Utils ────────────────────────────────────────────────────────────────────

function cleanQuery(query) {
  return query
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Expands a query into multiple fallback variants:
 * original → 4-gram → 3-gram → 2-gram + singular/plural toggle
 */
function expandQueries(query) {
  const cleaned = cleanQuery(query);
  const words = cleaned.split(' ').filter(w => w.length > 1);
  const candidates = new Set([cleaned]);

  if (words.length > 4) candidates.add(words.slice(0, 4).join(' '));
  if (words.length > 3) candidates.add(words.slice(0, 3).join(' '));
  if (words.length > 2) candidates.add(words.slice(0, 2).join(' '));

  // singular/plural toggle on last word
  const last = words[words.length - 1];
  const toggled = last.endsWith('s')
    ? [...words.slice(0, -1), last.slice(0, -1)].join(' ')
    : [...words.slice(0, -1), last + 's'].join(' ');
  if (toggled !== cleaned) candidates.add(toggled);

  return [...candidates];
}

/**
 * Score how well a product title matches the query (0–1).
 */
function relevanceScore(title, query) {
  const t = cleanQuery(title);
  const queryWords = cleanQuery(query).split(' ').filter(Boolean);
  if (!queryWords.length) return 0;
  const matches = queryWords.filter(w => t.includes(w));
  return matches.length / queryWords.length;
}

/**
 * Deduplicate across sources using title + price fingerprint.
 */
function deduplicateResults(results) {
  const seen = new Set();
  return results.filter(r => {
    const key = `${cleanQuery(r.title).slice(0, 30)}|${r.price}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function stripHtml(value) {
  return String(value || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function sourceFromUrl(url) {
  const host = String(url || '').match(/https?:\/\/(?:www\.)?([^/]+)/i)?.[1] || '';
  const matched = Object.keys(SOURCE_NAMES).find(domain => host.includes(domain));
  return matched ? SOURCE_NAMES[matched] : host;
}

function isKnownCommerceUrl(url) {
  return IMAGE_SEARCH_DOMAINS.some(domain => String(url || '').includes(domain));
}

function priceFromContext(context) {
  const match = String(context || '').match(/(?:Rs\.?|PKR|₨)\s*([0-9,]+(?:\.[0-9]{1,2})?)/i);
  return match ? parseFloat(match[1].replace(/,/g, '')) : 0;
}

function cleanExternalUrl(rawUrl) {
  try {
    const decoded = decodeURIComponent(String(rawUrl || '').split('&')[0]);
    const url = new URL(decoded);
    url.hash = '';
    return url.toString();
  } catch {
    return '';
  }
}

function addImageSearchResult(results, seen, { url, title, price = 0, image = '' }) {
  const productUrl = cleanExternalUrl(url);
  if (!productUrl || seen.has(productUrl) || !isKnownCommerceUrl(productUrl)) return;
  seen.add(productUrl);
  results.push({
    title: stripHtml(title) || sourceFromUrl(productUrl),
    price: Number(price || 0),
    url: productUrl,
    image,
    source: sourceFromUrl(productUrl),
    foundBy: 'image',
  });
}

// ─── Shopify Adapter ──────────────────────────────────────────────────────────

async function fetchOneShopifyStore({ domain, name }, query, signal) {
  const url =
    `https://${domain}/search/suggest.json` +
    `?q=${encodeURIComponent(query)}&resources[type]=product&resources[limit]=5`;

  const res = await fetch(url, {
    signal,
    headers: { 'User-Agent': UA, Accept: 'application/json' },
  });

  if (!res.ok) return [];

  const data = await res.json();
  const products = data.resources?.results?.products ?? [];

  return products.map(p => ({
    title: p.title,
    price: parseFloat(p.price.replace(/[^0-9.]/g, '')) || 0,
    url: `https://${domain}${p.url}`,
    image: p.image ?? '',
    source: name,
  }));
}

async function fetchShopifyStores(query, signal) {
  const settled = await Promise.allSettled(
    SHOPIFY_STORES.map(store => fetchOneShopifyStore(store, query, signal))
  );
  return settled
    .filter(r => r.status === 'fulfilled')
    .flatMap(r => r.value);
}

// ─── Daraz Adapter ────────────────────────────────────────────────────────────

async function fetchDarazDirect(query, signal) {
  const url = `https://www.daraz.pk/catalog/?q=${encodeURIComponent(query)}&_keyori=ss&from=input`;

  const res = await fetch(url, {
    signal,
    headers: {
      'User-Agent': UA,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
    },
  });

  if (!res.ok) return [];
  const html = await res.text();

  // Daraz embeds product data in __NEXT_DATA__
  const jsonMatch = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (!jsonMatch) return [];

  try {
    const data = JSON.parse(jsonMatch[1]);
    // Inspect actual response in devtools — path may shift between Daraz deploys
    const items =
      data?.props?.pageProps?.initialProps?.pageData?.listItems ??
      data?.props?.pageProps?.initialProps?.pageData?.mods?.listItems ??
      [];

    return items.slice(0, 8).map(item => ({
      title: item.name ?? '',
      price: parseFloat(item.price) || 0,
      url: item.itemUrl ? `https:${item.itemUrl}` : '',
      image: item.image ?? '',
      source: 'Daraz',
    }));
  } catch {
    return [];
  }
}

async function fetchDarazGoogleFallback(query, signal) {
  const url = `https://www.google.com/search?q=site:daraz.pk+${encodeURIComponent(query)}&num=8`;

  const res = await fetch(url, {
    signal,
    headers: {
      'User-Agent': UA,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
  });

  if (!res.ok) return [];
  const html = await res.text();

  const results = [];
  const linkRe = /href="\/url\?q=(https:\/\/www\.daraz\.pk\/products\/[^"&]+)/gi;
  const seen = new Set();
  let match;

  while ((match = linkRe.exec(html)) !== null && results.length < 5) {
    const productUrl = decodeURIComponent(match[1]);
    if (seen.has(productUrl)) continue;
    seen.add(productUrl);

    const ctx = html.substring(Math.max(0, match.index - 400), match.index + 800);
    const titleEl = ctx.match(/<h3[^>]*>([\s\S]*?)<\/h3>/i);
    const title = titleEl
      ? titleEl[1].replace(/<[^>]*>/g, '').replace(/\s*-\s*daraz\.pk.*/i, '').trim()
      : '';
    const priceEl = ctx.match(/(?:Rs\.?|PKR)\s*([0-9,]+)/i);
    const price = priceEl ? parseFloat(priceEl[1].replace(/,/g, '')) : 0;

    if (price && title) {
      results.push({ title, price, url: productUrl, image: '', source: 'Daraz' });
    }
  }

  return results;
}

async function fetchDaraz(query, signal) {
  const primary = await fetchDarazDirect(query, signal);
  if (primary.length > 0) return primary;
  return fetchDarazGoogleFallback(query, signal);
}

// ─── Naheed Adapter ───────────────────────────────────────────────────────────

async function fetchNaheed(query, signal) {
  const url = `https://www.naheed.pk/catalogsearch/result/?q=${encodeURIComponent(query)}`;

  const res = await fetch(url, {
    signal,
    headers: { 'User-Agent': UA, Accept: 'text/html' },
  });

  if (!res.ok) return [];
  const html = await res.text();

  const results = [];

  // Primary: JSON-LD structured data
  const jsonLdBlocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/gi)];
  for (const block of jsonLdBlocks) {
    try {
      const parsed = JSON.parse(block[1]);
      const items =
        parsed['@type'] === 'ItemList'
          ? (parsed.itemListElement ?? []).map(e => e.item)
          : parsed['@type'] === 'Product'
            ? [parsed]
            : [];

      for (const item of items) {
        const price = parseFloat(item.offers?.price) || 0;
        const title = item.name ?? '';
        if (price && title) {
          results.push({
            title,
            price,
            url: item.url ?? url,
            image: Array.isArray(item.image) ? item.image[0] : (item.image ?? ''),
            source: 'Naheed',
          });
        }
      }
    } catch { /* skip malformed block */ }
  }

  // Fallback: HTML class-based extraction
  if (results.length === 0) {
    const priceRe = /class="price"[^>]*>\s*<span[^>]*>Rs\.\s*([0-9,]+)/gi;
    const titleRe = /class="product-item-link"[^>]*>\s*([\s\S]*?)<\/a>/gi;
    const prices = [...html.matchAll(priceRe)].map(m => parseFloat(m[1].replace(/,/g, '')));
    const titles = [...html.matchAll(titleRe)].map(m => m[1].trim());

    for (let i = 0; i < Math.min(prices.length, titles.length, 6); i++) {
      if (prices[i] && titles[i]) {
        results.push({ title: titles[i], price: prices[i], url, image: '', source: 'Naheed' });
      }
    }
  }

  return results;
}

// ─── Google Image Search Adapter ─────────────────────────────────────────────

/**
 * Reverse-image-search via Google Lens and extract product pages with prices.
 * Google Lens results often include e-commerce product pages that
 * contain prices in their snippets or titles.
 */
async function fetchGoogleImageSearch(imageUrl, signal) {
  const results = [];

  try {
    const lensUrl =
      `https://www.google.com/searchbyimage?image_url=${encodeURIComponent(imageUrl)}&safe=off&hl=en`;

    const res = await fetch(lensUrl, {
      signal,
      headers: {
        'User-Agent': UA,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        Referer: 'https://www.google.com/',
      },
    });

    if (!res.ok) return [];
    const html = await res.text();

    const seen = new Set();

    const googleLinkRe = /href="\/url\?q=(https?:\/\/(?!www\.google)[^"&]+)/gi;
    let match;
    while ((match = googleLinkRe.exec(html)) !== null && results.length < 12) {
      const ctx = html.substring(Math.max(0, match.index - 500), Math.min(html.length, match.index + 1200));
      const title = ctx.match(/<h3[^>]*>([\s\S]*?)<\/h3>/i)?.[1] || '';
      addImageSearchResult(results, seen, {
        url: match[1],
        title,
        price: priceFromContext(ctx),
      });
    }

    const rawKnownUrlRe = /https?:\\?\/\\?\/(?:www\.)?(daraz\.pk|bagallery\.com|elo\.pk|naheed\.pk|sapphireonline\.pk|sanasafinaz\.com|khaadi\.com|alkaram\.com|gul-ahmed\.com|limelight\.pk)[^"'\\<>\s]+/gi;
    while ((match = rawKnownUrlRe.exec(html)) !== null && results.length < 12) {
      const url = match[0].replace(/\\\//g, '/');
      const ctx = html.substring(Math.max(0, match.index - 500), Math.min(html.length, match.index + 1200));
      addImageSearchResult(results, seen, {
        url,
        title: stripHtml(ctx).slice(0, 130),
        price: priceFromContext(ctx),
      });
    }
  } catch (err) {
    console.error('[image-search]', err.message);
  }

  return results;
}

async function fetchBingImageSearch(imageUrl, signal) {
  const results = [];
  const seen = new Set();
  const url =
    `https://www.bing.com/images/search?view=detailv2&iss=sbi&FORM=SBIIRP&sbisrc=UrlPaste&q=imgurl:${encodeURIComponent(imageUrl)}`;

  try {
    const res = await fetch(url, {
      signal,
      headers: {
        'User-Agent': UA,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });
    if (!res.ok) return [];
    const html = await res.text();

    const metadataRe = /m=\{&quot;[^"]*?&quot;purl&quot;:&quot;([^"]+)&quot;[^}]*?(?:&quot;t&quot;:&quot;([^"]*)&quot;)?[^}]*?(?:&quot;murl&quot;:&quot;([^"]+)&quot;)?/gi;
    let match;
    while ((match = metadataRe.exec(html)) !== null && results.length < 12) {
      const ctx = html.substring(Math.max(0, match.index - 500), Math.min(html.length, match.index + 1200));
      addImageSearchResult(results, seen, {
        url: match[1],
        title: match[2] || stripHtml(ctx).slice(0, 130),
        price: priceFromContext(ctx),
        image: match[3] ? cleanExternalUrl(match[3]) : '',
      });
    }

    const linkRe = /<a[^>]+href="(https?:\/\/[^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
    while ((match = linkRe.exec(html)) !== null && results.length < 12) {
      const ctx = html.substring(Math.max(0, match.index - 500), Math.min(html.length, match.index + 1200));
      addImageSearchResult(results, seen, {
        url: match[1],
        title: match[2] || ctx,
        price: priceFromContext(ctx),
      });
    }
  } catch (err) {
    console.error('[bing-image-search]', err.message);
  }

  return results;
}

// ─── Aggregator ───────────────────────────────────────────────────────────────

async function fetchAllAdapters(query, imageUrl) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const tasks = [
      fetchShopifyStores(query, controller.signal),
      fetchDaraz(query, controller.signal),
      fetchNaheed(query, controller.signal),
    ];

    // Run image search in parallel when imageUrl is provided
    if (imageUrl) {
      tasks.push(fetchGoogleImageSearch(imageUrl, controller.signal));
      tasks.push(fetchBingImageSearch(imageUrl, controller.signal));
    }

    const settled = await Promise.allSettled(tasks);

    return settled
      .filter(r => r.status === 'fulfilled')
      .flatMap(r => r.value);
  } finally {
    clearTimeout(timeout);
  }
}

// ─── Route Handler ────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { query, imageUrl, limit = 20 } = req.body ?? {};

  const hasQuery = query && typeof query === 'string' && query.trim().length >= 3;
  const hasImage = imageUrl && typeof imageUrl === 'string' && /^https?:\/\//i.test(imageUrl);

  if (!hasQuery && !hasImage) {
    return res.status(400).json({ error: 'Provide either query (≥3 chars) or imageUrl' });
  }

  const trimmedQuery = hasQuery ? query.trim() : '';

  try {
    // Image-only mode: skip text expansion, just run image search + all adapters
    // with a generic query derived from the image URL filename
    if (!hasQuery && hasImage) {
      const imageFilename = decodeURIComponent(
        imageUrl.split('/').pop()?.split('?')[0]?.replace(/[-_]/g, ' ').replace(/\.[^.]+$/, '') ?? ''
      );
      const raw = await fetchAllAdapters(imageFilename, imageUrl);
      const results = deduplicateResults(raw)
        .filter(r => r.price > 0)
        .sort((a, b) => a.price - b.price)
        .slice(0, limit);
      return res.status(200).json({ query: imageFilename, imageUrl, total: results.length, results });
    }

    const queries = expandQueries(trimmedQuery);
    let allResults = [];

    for (const q of queries) {
      // Pass imageUrl on the first query attempt for richer results
      const raw = await fetchAllAdapters(q, q === queries[0] ? imageUrl : undefined);
      allResults = [...allResults, ...raw];
      // Stop falling back once we have enough quality hits
      if (allResults.filter(r => r.price > 0).length >= 5) break;
    }

    const results = deduplicateResults(allResults)
      .filter(r => r.price > 0)
      .map(r => ({
        ...r,
        relevance: relevanceScore(r.title, trimmedQuery),
      }))
      .filter(r => r.foundBy === 'image' || r.relevance >= MIN_RELEVANCE)
      .sort((a, b) =>
        b.relevance !== a.relevance
          ? b.relevance - a.relevance  // high relevance first
          : a.price - b.price          // then lowest price
      )
      .slice(0, limit);

    return res.status(200).json({
      query: trimmedQuery,
      imageUrl: imageUrl ?? null,
      total: results.length,
      results,
    });
  } catch (err) {
    console.error('[competitor-prices]', err);
    return res.status(500).json({ error: 'Failed to fetch competitor prices' });
  }
}
