import { adminFieldValue, getAdminFirestore } from './_firebase-admin.js';

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

function unique(values) {
  return [...new Set(values.filter(Boolean))];
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

function firstImage(value) {
  if (Array.isArray(value)) return firstImage(value[0]);
  if (typeof value === 'object' && value?.url) return value.url;
  return value || '';
}

function variationOptionsFrom(raw) {
  const options = {};
  const add = (key, value) => {
    const cleanKey = cleanText(key).toLowerCase();
    const cleanValue = cleanText(value);
    if (!cleanKey || !cleanValue) return;
    if (['id', 'price', 'prepaidprice', 'saleprice', 'stock', 'availablestock', 'quantity', 'status'].includes(cleanKey)) return;
    options[cleanKey] = cleanValue;
  };

  add('size', raw.size || raw.Size);
  add('color', raw.color || raw.colour || raw.Color || raw.Colour);

  [
    raw.attributes,
    raw.attributeValues,
    raw.options,
    raw.optionValues,
    raw.variantOptions,
    raw.variationOptions,
    raw.properties,
  ].forEach((container) => {
    if (Array.isArray(container)) {
      container.forEach((item) => {
        if (!item || typeof item !== 'object') return;
        add(item.name || item.key || item.label || item.title || item.attributeName || item.optionName, item.value || item.optionValue || item.attributeValue || item.label || item.title);
      });
      return;
    }
    if (container && typeof container === 'object') {
      Object.entries(container).forEach(([key, value]) => {
        if (value && typeof value === 'object') {
          add(key, value.name || value.value || value.label || value.title);
        } else {
          add(key, value);
        }
      });
    }
  });

  return options;
}

function variationNameFrom(raw, index, options) {
  const explicit = cleanText(raw.name || raw.title || raw.variantName || raw.variationName || raw.skuName);
  if (explicit) return explicit;
  const optionName = Object.entries(options)
    .map(([key, value]) => `${key}: ${value}`)
    .join(', ');
  return optionName || `Variation ${index + 1}`;
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
  return {
    prePaidPrice: numberFrom(text.match(/"prePaidPrice":([0-9.]+)/)?.[1]),
    price: numberFrom(text.match(/"price":([0-9.]+)/)?.[1]),
    stock: numberFrom(text.match(/"availableStock":([0-9.]+)/)?.[1]),
    status: text.match(/"status":"([^"]+)"/)?.[1] || '',
  };
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

function extractVariations(decoded) {
  const arrayText = readBracketValue(decoded, 'variations');
  if (!arrayText) return [];
  try {
    const parsed = JSON.parse(arrayText);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((raw, index) => {
        const options = variationOptionsFrom(raw);
        return {
          id: String(raw.id || raw.variationId || raw.sku || raw.supplierProductCode || index),
          name: variationNameFrom(raw, index, options),
          options,
          markazPrice: Number(raw.prePaidPrice || raw.price || raw.salePrice || 0),
          stock: Number(raw.availableStock ?? raw.stock ?? raw.quantity ?? 0) || 0,
          status: String(raw.status || ''),
        };
      })
      .filter((item) => item.markazPrice > 0);
  } catch {
    return [];
  }
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

async function fetchHtml(url) {
  const response = await fetch(url, {
    headers: {
      'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36',
      accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'accept-language': 'en-US,en;q=0.9',
    },
  });
  if (!response.ok) throw new Error(`Could not fetch Markaz product (${response.status})`);
  return response.text();
}

function parseProductFromHtml(html, sourceUrl) {
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
  const description =
    formatDescription(jsonLd?.description) ||
    formatDescription(textBetween(decoded, /"name":"description","content":"([\s\S]*?)"\}\]/i)) ||
    formatDescription(textBetween(decoded, /<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["'][^>]*>/i)) ||
    formatDescription(textBetween(decoded, /<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["'][^>]*>/i));
  const markazPrice =
    variation.prePaidPrice ||
    variation.price ||
    numberFrom(offers?.price) ||
    numberFrom(textBetween(decoded, /<meta[^>]+property=["']product:price:amount["'][^>]+content=["']([^"']+)["'][^>]*>/i)) ||
    numberFrom(decoded.match(/(?:Rs\.?|PKR)\s*([0-9,.]+)/i)?.[1]);

  if (!markazPrice) throw new Error('Could not read updated Markaz price from source product.');

  const images = extractImages(decoded, jsonLd);
  const videos = extractVideos(decoded);
  return {
    name: cleanText(rawTitle).replace(/\s*[–-]\s*Markaz.*/i, ''),
    description,
    sourceImages: images,
    sourceVideos: videos,
    markazPrice,
    stock: variation.stock || 0,
    markazStatus: variation.status || decoded.match(/"status":"([^"]+)"/)?.[1] || '',
    sourceUrl,
    variations,
  };
}

function normalize(value) {
  return JSON.stringify(value ?? null);
}

function changed(before, after) {
  return normalize(before) !== normalize(after);
}

function collectChanges(current, next, labels) {
  const changes = {};
  const summary = [];
  for (const [key, after] of Object.entries(next)) {
    const before = current[key];
    if (changed(before, after)) {
      changes[key] = { before: before ?? null, after: after ?? null };
      summary.push(labels[key] || key);
    }
  }
  return { changes, summary };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { productId } = req.body || {};
  if (!productId) {
    res.status(400).json({ error: 'Product ID is required' });
    return;
  }

  try {
    const db = getAdminFirestore();
    const ref = db.collection('products').doc(productId);
    const snapshot = await ref.get();
    if (!snapshot.exists) {
      res.status(404).json({ error: 'Product not found' });
      return;
    }

    const current = { id: snapshot.id, ...snapshot.data() };
    if (!current.sourceUrl) {
      res.status(400).json({ error: 'This product has no Markaz source URL saved.' });
      return;
    }

    const html = await fetchHtml(current.sourceUrl);
    const markaz = parseProductFromHtml(html, current.sourceUrl);
    const matchedVariation = current.markazVariationId
      ? markaz.variations.find((variation) => String(variation.id) === String(current.markazVariationId))
      : null;
    const activeMarkaz = matchedVariation
      ? {
          ...markaz,
          name: `${markaz.name} - ${matchedVariation.name}`,
          markazPrice: matchedVariation.markazPrice,
          stock: matchedVariation.stock,
          markazStatus: matchedVariation.status || markaz.markazStatus,
          markazVariationName: matchedVariation.name,
          markazVariationOptions: matchedVariation.options || {},
        }
      : markaz;
    const pricing = buildPricing(activeMarkaz.markazPrice);
    const compared = {
      name: activeMarkaz.name || current.name || '',
      description: activeMarkaz.description || current.description || '',
      markazPrice: activeMarkaz.markazPrice,
      price: pricing.price,
      oldPrice: pricing.oldPrice,
      discount: pricing.discount,
      stock: activeMarkaz.stock,
      markazStatus: activeMarkaz.markazStatus,
      markazVariationName: activeMarkaz.markazVariationName || current.markazVariationName || '',
      markazVariationOptions: activeMarkaz.markazVariationOptions || current.markazVariationOptions || {},
    };
    const labels = {
      name: 'Name changed',
      description: 'Description changed',
      markazPrice: 'Markaz price changed',
      price: 'Glowza sale price recalculated',
      oldPrice: 'Cut price recalculated',
      discount: 'Discount recalculated',
      stock: 'Stock changed',
      markazStatus: 'Markaz status changed',
      markazVariationName: 'Variation name changed',
      markazVariationOptions: 'Variation options changed',
    };
    const { changes, summary } = collectChanges(current, compared, labels);
    const needsReview = summary.length > 0;
    const update = {
      ...compared,
      source: current.source || 'markaz',
      sourceUrl: current.sourceUrl,
      sourceSyncedAt: adminFieldValue.serverTimestamp(),
      syncChangeSummary: summary,
      syncChangeCount: summary.length,
      needsReview,
      ...(needsReview ? { isActive: false, importStatus: 'draft' } : {}),
      updatedAt: adminFieldValue.serverTimestamp(),
    };

    await ref.update(update);
    const updated = await ref.get();
    res.status(200).json({
      product: { id: updated.id, ...updated.data() },
      changes,
      changeSummary: summary,
      changed: needsReview,
    });
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Could not sync Markaz product',
    });
  }
}
