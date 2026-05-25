// ─────────────────────────────────────────────────────────────────────────────
// competitor-prices.js
// POST /api/competitor-prices  { query: string, limit?: number }
// ─────────────────────────────────────────────────────────────────────────────

const TIMEOUT_MS = 15_000;
const MIN_RELEVANCE = 0.3;

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

const SHOPIFY_STORES = [
  { domain: 'bagallery.com', name: 'Bagallery' },
  { domain: 'www.elo.pk', name: 'Elo' },
  { domain: 'www.sapphireonline.pk', name: 'Sapphire' },
  { domain: 'www.sanasafinaz.com', name: 'Sana Safinaz' },
];

const SERPAPI_KEY_ENTRY = [
  ['SERPAPI_API_KEY', process.env.SERPAPI_API_KEY],
  ['SERPAPI_KEY', process.env.SERPAPI_KEY],
  ['SERP_API_KEY', process.env.SERP_API_KEY],
  ['VITE_SERPAPI_API_KEY', process.env.VITE_SERPAPI_API_KEY],
].find(([, value]) => String(value || '').trim().length > 0);
const SERPAPI_KEY_NAME = SERPAPI_KEY_ENTRY?.[0] || '';
const SERPAPI_KEY = String(SERPAPI_KEY_ENTRY?.[1] || '').trim();

const MARKETPLACE_SOURCES = [
  ['daraz.pk', 'Daraz Pakistan'],
  ['olx.com.pk', 'OLX Pakistan'],
  ['goto.com.pk', 'Goto'],
  ['yayvo.com', 'Yayvo'],
  ['hummart.com', 'HumMart'],
  ['priceoye.pk', 'PriceOye'],
  ['telemart.pk', 'Telemart'],
  ['shophive.com', 'Shophive'],
  ['homeshopping.pk', 'HomeShopping'],
  ['ishopping.pk', 'iShopping'],
  ['symbios.pk', 'Symbios'],
  ['khaadi.com', 'Khaadi'],
  ['sapphireonline.pk', 'Sapphire'],
  ['nishatlinen.com', 'Nishat Linen'],
  ['limelight.pk', 'Limelight'],
  ['beechtree.pk', 'Beechtree'],
  ['outfitters.com.pk', 'Outfitters'],
  ['zellbury.com', 'Zellbury'],
  ['alkaramstudio.com', 'Alkaram Studio'],
  ['alkaram.com', 'Alkaram'],
  ['bonanzasatrangi.com', 'Bonanza Satrangi'],
  ['gul-ahmed.com', 'Gul Ahmed'],
  ['bagallery.com', 'Bagallery'],
  ['vegas.pk', 'Vegas.pk'],
  ['just4girls.pk', 'Just4Girls'],
  ['naheed.pk', 'Naheed'],
  ['foodpanda.pk', 'Pandamart'],
  ['metro-online.pk', 'Metro Online'],
  ['grocerapp.pk', 'GrocerApp'],
  ['readings.com.pk', 'Readings'],
  ['libertybooks.com', 'Liberty Books'],
  ['interwood.pk', 'Interwood'],
  ['habitt.com', 'Habitt'],
  ['apnafurniture.pk', 'Apna Furniture'],
];

const IMAGE_SEARCH_DOMAINS = MARKETPLACE_SOURCES.map(([domain]) => domain);
const SOURCE_NAMES = Object.fromEntries(MARKETPLACE_SOURCES);
const COMMERCE_DOMAIN_RE = new RegExp(
  `https?:\\\\?/\\\\?/(?:www\\.)?(${IMAGE_SEARCH_DOMAINS.map(domain => domain.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})[^"'\\\\<>\\s]+`,
  'gi',
);

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

function priceFromAny(value) {
  if (typeof value === 'number') return value;
  if (!value) return 0;
  if (typeof value === 'object') {
    return (
      Number(value.extracted_value || 0) ||
      priceFromAny(value.value) ||
      priceFromAny(value.price) ||
      priceFromAny(value.amount)
    );
  }
  return priceFromContext(String(value)) || Number(String(value).replace(/[^0-9.]/g, '')) || 0;
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

function extractJsonLdProducts(html) {
  const products = [];
  const blocks = [...String(html || '').matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  for (const block of blocks) {
    try {
      const parsed = JSON.parse(stripHtml(block[1]).replace(/&quot;/g, '"'));
      const nodes = Array.isArray(parsed) ? parsed : parsed['@graph'] || [parsed];
      nodes.forEach((node) => {
        if (node?.['@type'] === 'Product') products.push(node);
        if (Array.isArray(node?.itemListElement)) {
          node.itemListElement.forEach((entry) => {
            if (entry?.item?.['@type'] === 'Product') products.push(entry.item);
          });
        }
      });
    } catch {
      // Skip malformed or escaped schema blocks.
    }
  }
  return products;
}

function productFromHtml(html, fallbackUrl) {
  const products = extractJsonLdProducts(html);
  for (const product of products) {
    const offers = Array.isArray(product.offers) ? product.offers[0] : product.offers;
    const price = parseFloat(String(offers?.price || offers?.lowPrice || '').replace(/[^0-9.]/g, '')) || 0;
    if (price) {
      return {
        title: product.name || '',
        price,
        image: Array.isArray(product.image) ? product.image[0] : product.image || '',
        url: product.url || fallbackUrl,
      };
    }
  }

  const title =
    String(html).match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i)?.[1] ||
    String(html).match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ||
    '';
  const image =
    String(html).match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)?.[1] ||
    '';
  const price =
    priceFromContext(String(html).slice(0, 120000)) ||
    parseFloat(String(html).match(/"price"\s*:\s*"?([0-9,.]+)"?/i)?.[1]?.replace(/,/g, '') || '0') ||
    0;

  return {
    title: stripHtml(title),
    price,
    image,
    url: fallbackUrl,
  };
}

async function enrichImageResults(results, signal) {
  const imageResults = results.filter((result) => result.foundBy === 'image').slice(0, 10);
  const settled = await Promise.allSettled(
    imageResults.map(async (result) => {
      if (result.price > 0 && result.title) return result;
      const res = await fetch(result.url, {
        signal,
        headers: {
          'User-Agent': UA,
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
        },
      });
      if (!res.ok) return result;
      const html = await res.text();
      const extracted = productFromHtml(html, result.url);
      return {
        ...result,
        title: extracted.title || result.title,
        price: extracted.price || result.price,
        image: extracted.image || result.image,
        url: extracted.url || result.url,
      };
    }),
  );

  const enrichedByUrl = new Map();
  settled.forEach((entry) => {
    if (entry.status === 'fulfilled') enrichedByUrl.set(entry.value.url, entry.value);
  });

  return results.map((result) => enrichedByUrl.get(result.url) || result);
}

async function enrichProductResults(results, signal, maxItems = 12) {
  const candidates = results.slice(0, maxItems);
  const settled = await Promise.allSettled(
    candidates.map(async (result) => {
      if (result.price > 0 && result.title && result.image) return result;
      const res = await fetch(result.url, {
        signal,
        headers: {
          'User-Agent': UA,
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
        },
      });
      if (!res.ok) return result;
      const html = await res.text();
      const extracted = productFromHtml(html, result.url);
      return {
        ...result,
        title: extracted.title || result.title,
        price: extracted.price || result.price,
        image: extracted.image || result.image,
        url: extracted.url || result.url,
      };
    }),
  );
  return settled
    .filter(entry => entry.status === 'fulfilled')
    .map(entry => entry.value);
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

async function fetchGoogleMarketplaceSearch(queryText, signal) {
  const domainChunks = [];
  for (let index = 0; index < IMAGE_SEARCH_DOMAINS.length; index += 7) {
    domainChunks.push(IMAGE_SEARCH_DOMAINS.slice(index, index + 7));
  }

  const settled = await Promise.allSettled(
    domainChunks.map(async (domains) => {
      const siteQuery = domains.map(domain => `site:${domain}`).join(' OR ');
      const url = `https://www.google.com/search?q=${encodeURIComponent(`(${siteQuery}) ${queryText} price`)}&num=10`;
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
      const results = [];
      const seen = new Set();
      const linkRe = /href="\/url\?q=(https?:\/\/(?!www\.google)[^"&]+)/gi;
      let match;
      while ((match = linkRe.exec(html)) !== null && results.length < 8) {
        const productUrl = cleanExternalUrl(match[1]);
        if (!productUrl || seen.has(productUrl) || !domains.some(domain => productUrl.includes(domain))) continue;
        seen.add(productUrl);
        const ctx = html.substring(Math.max(0, match.index - 500), Math.min(html.length, match.index + 1200));
        const title = stripHtml(ctx.match(/<h3[^>]*>([\s\S]*?)<\/h3>/i)?.[1] || '').replace(/\s*-\s*Google Search.*/i, '');
        results.push({
          title: title || sourceFromUrl(productUrl),
          price: priceFromContext(ctx),
          url: productUrl,
          image: '',
          source: sourceFromUrl(productUrl),
          foundBy: 'text',
        });
      }
      return enrichProductResults(results, signal, 5);
    }),
  );

  return settled
    .filter(entry => entry.status === 'fulfilled')
    .flatMap(entry => entry.value);
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

    COMMERCE_DOMAIN_RE.lastIndex = 0;
    while ((match = COMMERCE_DOMAIN_RE.exec(html)) !== null && results.length < 12) {
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

async function fetchGoogleLensUploadByUrl(imageUrl, signal) {
  const results = [];
  const seen = new Set();
  const lensUrl = `https://lens.google.com/uploadbyurl?url=${encodeURIComponent(imageUrl)}&hl=en`;

  try {
    const res = await fetch(lensUrl, {
      signal,
      headers: {
        'User-Agent': UA,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });
    if (!res.ok) return [];
    const html = await res.text();
    let match;
    COMMERCE_DOMAIN_RE.lastIndex = 0;
    while ((match = COMMERCE_DOMAIN_RE.exec(html)) !== null && results.length < 12) {
      const url = match[0].replace(/\\\//g, '/');
      const ctx = html.substring(Math.max(0, match.index - 500), Math.min(html.length, match.index + 1200));
      addImageSearchResult(results, seen, {
        url,
        title: stripHtml(ctx).slice(0, 130),
        price: priceFromContext(ctx),
      });
    }
  } catch (err) {
    console.error('[google-lens-uploadbyurl]', err.message);
  }

  return results;
}

async function fetchSerpApiGoogleLens(imageUrl, signal, queryText = '') {
  if (!SERPAPI_KEY) return [];

  const lensTypes = ['products', 'visual_matches', 'exact_matches'];
  const settled = await Promise.allSettled(
    lensTypes.map(async (type) => {
      const url = new URL('https://serpapi.com/search.json');
      url.searchParams.set('engine', 'google_lens');
      url.searchParams.set('url', imageUrl);
      url.searchParams.set('type', type);
      url.searchParams.set('hl', 'en');
      url.searchParams.set('country', 'pk');
      url.searchParams.set('api_key', SERPAPI_KEY);
      if (queryText && type !== 'exact_matches') url.searchParams.set('q', queryText);

      const res = await fetch(url.toString(), {
        signal,
        headers: { Accept: 'application/json' },
      });
      if (!res.ok) return [];
      const data = await res.json();
      if (data.error) {
        console.error('[serpapi-google-lens]', data.error);
        return [];
      }
      const groups = [
        ...(data.products || []),
        ...(data.visual_matches || []),
        ...(data.exact_matches || []),
        ...(data.product_results || []),
        ...(data.shopping_results || []),
      ];
      return groups.map((item) => {
        const link = item.link || item.url || item.source_url || '';
        return {
          title: stripHtml(item.title || item.name || item.source || ''),
          price: priceFromAny(item.price || item.extracted_price || item.snippet),
          url: link,
          image: item.thumbnail || item.image || '',
          source: sourceFromUrl(link) || stripHtml(item.source || ''),
          foundBy: 'image',
        };
      });
    }),
  );

  const seen = new Set();
  return settled
    .filter(entry => entry.status === 'fulfilled')
    .flatMap(entry => entry.value)
    .filter((result) => {
      if (!result.url || seen.has(result.url)) return false;
      seen.add(result.url);
      return true;
    });
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
      fetchGoogleMarketplaceSearch(query, controller.signal),
    ];

    // Run image search in parallel when imageUrl is provided
    if (imageUrl) {
      tasks.push(fetchSerpApiGoogleLens(imageUrl, controller.signal, query));
      tasks.push(fetchGoogleLensUploadByUrl(imageUrl, controller.signal));
      tasks.push(fetchGoogleImageSearch(imageUrl, controller.signal));
      tasks.push(fetchBingImageSearch(imageUrl, controller.signal));
    }

    const settled = await Promise.allSettled(tasks);

    const results = settled
      .filter(r => r.status === 'fulfilled')
      .flatMap(r => r.value);
    return imageUrl ? enrichImageResults(results, controller.signal) : results;
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

    const imageMatches = results.filter((result) => result.foundBy === 'image').length;

    return res.status(200).json({
      query: trimmedQuery,
      imageUrl: imageUrl ?? null,
      total: results.length,
      diagnostics: {
        imageSearchRequested: Boolean(hasImage),
        imageProviderConfigured: Boolean(SERPAPI_KEY),
        imageProviderKeyName: SERPAPI_KEY_NAME || null,
        imageMatches,
      },
      results,
    });
  } catch (err) {
    console.error('[competitor-prices]', err);
    return res.status(500).json({ error: 'Failed to fetch competitor prices' });
  }
}
