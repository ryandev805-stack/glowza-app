function cleanText(value) {
  return String(value || '')
    .replace(/\\n/g, ' ')
    .replace(/\\u0026/g, '&')
    .replace(/\\u003c/g, '<')
    .replace(/\\u003e/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function formatDescription(value) {
  return cleanText(value)
    .replace(/\s*\\+\s*/g, '<br>')
    .replace(/(<br>\s*){3,}/g, '<br><br>');
}

function numberFrom(value) {
  const match = String(value || '').replace(/,/g, '').match(/\d+(\.\d+)?/);
  return match ? Number(match[0]) : 0;
}

function textBetween(source, pattern) {
  const match = source.match(pattern);
  return match?.[1]?.trim() || '';
}

function absoluteUrl(url, baseUrl) {
  try {
    return new URL(url, baseUrl).toString();
  } catch {
    return '';
  }
}

function decodeHtml(html) {
  return html
    .replace(/\\"/g, '"')
    .replace(/\\\//g, '/')
    .replace(/\\n/g, '\n')
    .replace(/\\u0026/g, '&')
    .replace(/\\u003c/g, '<')
    .replace(/\\u003e/g, '>');
}

function slugify(value) {
  return cleanText(value)
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function normalizeMarkazProductUrl(url) {
  if (!url) return '';
  const clean = url.split('?')[0].replace(/\/$/, '');
  if (!/^https:\/\/www\.markaz\.app\/shop\/product\//i.test(clean)) return '';
  return clean;
}

function withPage(url, page) {
  const nextUrl = new URL(url);
  nextUrl.searchParams.set('page', String(page));
  return nextUrl.toString();
}

async function collectProductUrls(categoryUrl, limit) {
  const urls = [];
  const seen = new Set();
  const pages = [];
  const maxPages = 8;
  const targetUrlCount = Math.min(limit * 3, 60);

  for (let page = 1; page <= maxPages && urls.length < targetUrlCount; page += 1) {
    const pageUrl = withPage(categoryUrl, page);
    const html = await fetchHtml(pageUrl);
    const pageUrls = extractProductUrls(html, pageUrl);
    pages.push({ page, url: pageUrl, count: pageUrls.length });

    pageUrls.forEach((url) => {
      if (urls.length >= targetUrlCount || seen.has(url)) return;
      seen.add(url);
      urls.push(url);
    });

    if (pageUrls.length === 0 && page > 1) break;
  }

  return { urls, pages };
}

function extractProductUrls(html, baseUrl) {
  const urls = new Set();
  const decoded = decodeHtml(html);

  for (const match of decoded.matchAll(/href=["']([^"']+)["']/gi)) {
    const absolute = normalizeMarkazProductUrl(absoluteUrl(match[1], baseUrl));
    if (absolute) urls.add(absolute);
  }

  for (const match of decoded.matchAll(/https?:\/\/www\.markaz\.app\/shop\/product\/[^"'\\\s<]+/gi)) {
    const absolute = normalizeMarkazProductUrl(match[0]);
    if (absolute) urls.add(absolute);
  }

  for (const match of decoded.matchAll(/"id":(\d+)[\s\S]{0,1200}?"name":"([^"]+)"/g)) {
    const id = match[1];
    const name = cleanText(match[2]);
    if (id && name) {
      urls.add(`https://www.markaz.app/shop/product/${slugify(name)}/${id}`);
    }
  }

  for (const match of decoded.matchAll(/\{"bonus":.*?"supplierProductCode":"[^"]+"\}/g)) {
    try {
      const item = JSON.parse(match[0]);
      if (item?.id && item?.name) {
        urls.add(`https://www.markaz.app/shop/product/${slugify(item.name)}/${item.id}`);
      }
    } catch {
      // Ignore malformed hydration fragments.
    }
  }

  return [...urls];
}

function firstImage(value) {
  if (Array.isArray(value)) return firstImage(value[0]);
  if (typeof value === 'object' && value?.url) return value.url;
  return value || '';
}

function parseJsonLd(html) {
  const scripts = [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  for (const script of scripts) {
    try {
      const parsed = JSON.parse(script[1].trim());
      const nodes = Array.isArray(parsed) ? parsed : [parsed, ...(parsed['@graph'] || [])];
      const product = nodes.find((node) => {
        const type = node?.['@type'];
        return type === 'Product' || (Array.isArray(type) && type.includes('Product'));
      });
      if (product) return product;
    } catch {
      // Ignore invalid structured data.
    }
  }
  return null;
}

function extractImages(decoded, jsonLd) {
  const jsonLdImages = Array.isArray(jsonLd?.image)
    ? jsonLd.image.map(firstImage)
    : [firstImage(jsonLd?.image)];
  const ogImages = [...decoded.matchAll(/(?:property|name)=["']og:image["'][^>]+content=["']([^"']+)["']/gi)].map((match) => match[1]);
  const imageKeys = [...decoded.matchAll(/"(?:image|imageUrl|thumbnail|thumbnailUrl|url)":"(https?:\/\/[^"]+\.(?:jpg|jpeg|png|webp|avif)(?:\?[^"]*)?)"/gi)].map((match) => match[1]);
  const anyImages = [...decoded.matchAll(/https?:\/\/[^"'\\\s<]+\.(?:jpg|jpeg|png|webp|avif)(?:\?[^"'\\\s<]*)?/gi)].map((match) => match[0]);
  return unique([...jsonLdImages, ...ogImages, ...imageKeys, ...anyImages])
    .filter((url) => !/favicon|logo|sprite/i.test(url))
    .slice(0, 16);
}

function extractVideos(decoded) {
  const videoKeys = [...decoded.matchAll(/"(?:video|videoUrl|videoURL|contentUrl|embedUrl)":"(https?:\/\/[^"]+)"/gi)].map((match) => match[1]);
  const videoTags = [...decoded.matchAll(/<video[^>]+src=["']([^"']+)["']/gi)].map((match) => match[1]);
  const sourceTags = [...decoded.matchAll(/<source[^>]+src=["']([^"']+)["']/gi)].map((match) => match[1]);
  const directUrls = [...decoded.matchAll(/https?:\/\/[^"'\\\s<]+\.(?:mp4|webm|mov|m3u8)(?:\?[^"'\\\s<]*)?/gi)].map((match) => match[0]);
  return unique([...videoKeys, ...videoTags, ...sourceTags, ...directUrls])
    .filter((url) => /^https?:\/\//i.test(url))
    .slice(0, 8);
}

function extractVariation(decoded) {
  const variationMatch =
    decoded.match(/"variations":\[(\{[\s\S]*?\})\]/) ||
    decoded.match(/"variations":(\[[\s\S]*?\])/);
  const text = variationMatch?.[1] || '';
  const prePaidPrice = numberFrom(text.match(/"prePaidPrice":([0-9.]+)/)?.[1]);
  const price = numberFrom(text.match(/"price":([0-9.]+)/)?.[1]);
  const stock = numberFrom(text.match(/"availableStock":([0-9.]+)/)?.[1]);
  const status = text.match(/"status":"([^"]+)"/)?.[1] || '';
  return { prePaidPrice, price, stock, status };
}

function readBracketValue(source, key) {
  const keyIndex = source.indexOf(`"${key}":`);
  if (keyIndex < 0) return '';
  const start = source.indexOf('[', keyIndex);
  if (start < 0) return '';
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = start; index < source.length; index += 1) {
    const char = source[index];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (char === '\\') {
      escaped = true;
      continue;
    }
    if (char === '"') inString = !inString;
    if (inString) continue;
    if (char === '[') depth += 1;
    if (char === ']') {
      depth -= 1;
      if (depth === 0) return source.slice(start, index + 1);
    }
  }
  return '';
}

function normalizeVariation(raw, index) {
  const markazPrice = Number(raw.prePaidPrice || raw.price || raw.salePrice || 0);
  const image = firstImage(raw.image || raw.imageUrl || raw.thumbnail || raw.thumbnailUrl || raw.url || '');
  return {
    id: String(raw.id || raw.variationId || raw.sku || raw.supplierProductCode || index),
    name: cleanText(raw.name || raw.title || raw.variantName || raw.size || raw.color || `Variation ${index + 1}`),
    markazPrice,
    image,
    stock: Number(raw.availableStock ?? raw.stock ?? raw.quantity ?? 0) || 0,
    status: String(raw.status || ''),
  };
}

function extractVariations(decoded) {
  const arrayText = readBracketValue(decoded, 'variations');
  if (!arrayText) return [];
  try {
    const parsed = JSON.parse(arrayText);
    if (!Array.isArray(parsed)) return [];
    return parsed.map(normalizeVariation).filter((variation) => variation.markazPrice > 0);
  } catch {
    const matches = [...arrayText.matchAll(/\{[^{}]*(?:"prePaidPrice"|"price")[^{}]*\}/g)];
    return matches
      .map((match, index) => {
        const text = match[0];
        return {
          id: text.match(/"id":("?[^",}]+")/)?.[1]?.replace(/"/g, '') || String(index),
          name: cleanText(text.match(/"name":"([^"]+)"/)?.[1] || text.match(/"title":"([^"]+)"/)?.[1] || `Variation ${index + 1}`),
          markazPrice: numberFrom(text.match(/"prePaidPrice":([0-9.]+)/)?.[1]) || numberFrom(text.match(/"price":([0-9.]+)/)?.[1]),
          image: text.match(/"(?:image|imageUrl|thumbnail|thumbnailUrl|url)":"(https?:\/\/[^"]+)"/)?.[1] || '',
          stock: numberFrom(text.match(/"availableStock":([0-9.]+)/)?.[1]),
          status: text.match(/"status":"([^"]+)"/)?.[1] || '',
        };
      })
      .filter((variation) => variation.markazPrice > 0);
  }
}

function extractDetailProduct(html, sourceUrl) {
  const decoded = decodeHtml(html);
  const jsonLd = parseJsonLd(decoded);
  const offers = Array.isArray(jsonLd?.offers) ? jsonLd.offers[0] : jsonLd?.offers;
  const variation = extractVariation(decoded);
  const variations = extractVariations(decoded);

  const rawTitle =
    jsonLd?.name ||
    textBetween(decoded, /"og:title","content":"([^"]+)"/i) ||
    textBetween(decoded, /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["'][^>]*>/i) ||
    textBetween(decoded, /<title[^>]*>([\s\S]*?)<\/title>/i);
  const name = cleanText(rawTitle).replace(/\s*[–-]\s*Markaz.*/i, '');

  const description =
    formatDescription(jsonLd?.description) ||
    formatDescription(textBetween(decoded, /"name":"description","content":"([\s\S]*?)"\}\]/i)) ||
    formatDescription(textBetween(decoded, /<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["'][^>]*>/i)) ||
    formatDescription(textBetween(decoded, /<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["'][^>]*>/i));

  const images = extractImages(decoded, jsonLd);
  const videos = extractVideos(decoded);
  const brand = typeof jsonLd?.brand === 'object' ? jsonLd.brand.name : jsonLd?.brand;
  const markazPrice =
    variation.prePaidPrice ||
    variation.price ||
    numberFrom(offers?.price) ||
    numberFrom(textBetween(decoded, /<meta[^>]+property=["']product:price:amount["'][^>]+content=["']([^"']+)["'][^>]*>/i)) ||
    numberFrom(decoded.match(/(?:Rs\.?|PKR)\s*([0-9,.]+)/i)?.[1]);

  return {
    name,
    description,
    markazPrice,
    image: images[0] || '',
    images,
    videos,
    brand: cleanText(brand || 'Markaz'),
    stock: variation.stock || 0,
    markazStatus: variation.status || decoded.match(/"status":"([^"]+)"/)?.[1] || '',
    sourceUrl,
    variations,
  };
}

function expandVariationProducts(product) {
  if (!product.variations?.length) return [product];
  return product.variations.map((variation) => {
    const images = unique([variation.image, ...product.images].filter(Boolean));
    return {
      ...product,
      name: `${product.name} - ${variation.name}`,
      markazPrice: variation.markazPrice,
      image: images[0] || product.image,
      images,
      stock: variation.stock,
      markazStatus: variation.status || product.markazStatus,
      markazVariationId: variation.id,
      markazVariationName: variation.name,
      description: `${product.description || product.name}\n\nVariation: ${variation.name}`,
    };
  });
}

async function fetchHtml(url) {
  const response = await fetch(url, {
    headers: {
      'user-agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36',
      accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'accept-language': 'en-US,en;q=0.9',
    },
  });
  if (!response.ok) {
    throw new Error(`Could not fetch ${url} (${response.status})`);
  }
  return response.text();
}

async function scrapeProductDetail(url) {
  const html = await fetchHtml(url);
  const product = extractDetailProduct(html, url);
  if (!product.name || product.markazPrice <= 0) {
    throw new Error(`Missing required detail data for ${url}`);
  }
  return product;
}

async function mapWithConcurrency(items, limit, mapper) {
  const results = [];
  let index = 0;
  async function worker() {
    while (index < items.length) {
      const currentIndex = index;
      index += 1;
      try {
        results[currentIndex] = { status: 'fulfilled', value: await mapper(items[currentIndex], currentIndex) };
      } catch (error) {
        results[currentIndex] = { status: 'rejected', reason: error };
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

function buildPricing(markazPrice) {
  const basePrice = Number(markazPrice) || 0;
  let margin = 0;
  if (basePrice <= 500) {
    margin = 200;
  } else if (basePrice <= 1000) {
    margin = 300;
  } else if (basePrice <= 1500) {
    margin = 500;
  } else if (basePrice <= 2500) {
    margin = 750;
  } else if (basePrice <= 3500) {
    margin = 1000;
  } else {
    margin = basePrice * 0.5;
  }
  const price = Math.ceil(basePrice + margin);
  const oldPrice = Math.ceil(price / 0.6);
  const discount = oldPrice > price ? Math.round(((oldPrice - price) / oldPrice) * 100) : 0;
  return { price, oldPrice, discount };
}

function scoreProduct(product, minPrice, maxPrice) {
  const reasons = [];
  let score = 20;
  const name = product.name.toLowerCase();
  const demandKeywords = [
    'serum',
    'sunscreen',
    'cleanser',
    'cream',
    'face wash',
    'toner',
    'moisturizer',
    'vitamin c',
    'niacinamide',
    'hyaluronic',
    'retinol',
    'spf',
    'mask',
    'scrub',
    'korean',
    'acne',
    'glow',
  ];
  const matches = demandKeywords.filter((keyword) => name.includes(keyword));
  if (matches.length) {
    score += Math.min(28, matches.length * 7);
    reasons.push(`Demand keywords: ${matches.slice(0, 4).join(', ')}`);
  }
  if (product.images.length >= 4) {
    score += 18;
    reasons.push('Rich detail gallery');
  } else if (product.images.length >= 2) {
    score += 14;
    reasons.push('Multiple detail images');
  } else if (product.image) {
    score += 8;
    reasons.push('Has product image');
  }
  if (product.videos.length > 0) {
    score += 8;
    reasons.push('Video media available');
  }
  if (product.markazPrice >= minPrice && product.markazPrice <= maxPrice) {
    score += 18;
    reasons.push('Price is inside target range');
  }
  if (product.description.length > 160) {
    score += 12;
    reasons.push('Full detail description');
  } else if (product.description.length > 80) {
    score += 8;
    reasons.push('Description available');
  }
  if (product.stock > 0) {
    score += 10;
    reasons.push('Stock available');
  }
  if (product.markazPrice <= 0) {
    score -= 35;
    reasons.push('Missing Markaz price');
  }
  return { winningScore: Math.max(0, Math.min(100, score)), reasons };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const {
    categoryUrl,
    maxProducts = 12,
    minPrice = 200,
    maxPrice = 5000,
  } = req.body || {};

  if (!categoryUrl || !/^https:\/\/www\.markaz\.app\//i.test(categoryUrl)) {
    res.status(400).json({ error: 'Valid Markaz category URL is required' });
    return;
  }

  try {
    const limit = Math.min(Number(maxProducts) || 12, 30);
    const { urls, pages } = await collectProductUrls(categoryUrl, limit);
    if (urls.length === 0) {
      res.status(422).json({
        error:
          'No product detail links were found after checking Markaz paginated category pages.',
        scannedPages: pages,
      });
      return;
    }

    const settled = await mapWithConcurrency(urls, 4, scrapeProductDetail);
    const failedCount = settled.filter((result) => result.status === 'rejected').length;
    const products = settled
      .filter((result) => result.status === 'fulfilled')
      .map((result) => result.value)
      .flatMap(expandVariationProducts)
      .filter((product) => product.name && product.markazPrice > 0)
      .map((product, index) => {
        const pricing = buildPricing(product.markazPrice);
        const scoring = scoreProduct(product, Number(minPrice) || 0, Number(maxPrice) || 999999);
        return {
          id: `${Date.now()}-${index}`,
          ...product,
          ...pricing,
          ...scoring,
          duplicate: false,
        };
      })
      .sort((a, b) => b.winningScore - a.winningScore)
      .slice(0, limit);

    res.status(200).json({
      products,
      sourceCount: urls.length,
      detailFetchedCount: products.length,
      failedCount,
      scannedPages: pages,
    });
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Could not scan Markaz category',
    });
  }
}
