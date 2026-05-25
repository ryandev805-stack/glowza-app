function textBetween(source, pattern) {
  const match = source.match(pattern);
  return match?.[1]?.trim() || '';
}

function cleanText(value) {
  return String(value || '')
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
      // Ignore invalid embedded JSON-LD and fall back to meta tags.
    }
  }
  return null;
}

function imagesFrom(value) {
  if (Array.isArray(value)) return value.map(firstImage).filter(Boolean);
  if (typeof value === 'object' && value?.url) return [value.url];
  return value ? [value] : [];
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

function decodeHtml(html) {
  return html
    .replace(/\\"/g, '"')
    .replace(/\\\//g, '/')
    .replace(/\\n/g, '\n')
    .replace(/\\u0026/g, '&')
    .replace(/\\u003c/g, '<')
    .replace(/\\u003e/g, '>');
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
          image: firstImage(raw.image || raw.imageUrl || raw.thumbnail || raw.thumbnailUrl || raw.url || ''),
        };
      })
      .filter((item) => item.markazPrice > 0);
  } catch {
    return [];
  }
}

function numberFrom(value) {
  const match = String(value || '').replace(/,/g, '').match(/\d+(\.\d+)?/);
  return match ? Number(match[0]) : 0;
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

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { url } = req.body || {};
  if (!url || !/^https?:\/\//i.test(url)) {
    res.status(400).json({ error: 'Valid product URL is required' });
    return;
  }

  try {
    const response = await fetch(url, {
      headers: {
        'user-agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36',
        accept: 'text/html,application/xhtml+xml',
      },
    });

    if (!response.ok) {
      res.status(response.status).json({ error: `Could not fetch product page (${response.status})` });
      return;
    }

    const html = await response.text();
    const decoded = decodeHtml(html);
    const jsonLd = parseJsonLd(decoded);
    const offers = Array.isArray(jsonLd?.offers) ? jsonLd.offers[0] : jsonLd?.offers;
    const title =
      jsonLd?.name ||
      textBetween(decoded, /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["'][^>]*>/i) ||
      textBetween(decoded, /<title[^>]*>([\s\S]*?)<\/title>/i);
    const description =
      jsonLd?.description ||
      textBetween(decoded, /<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["'][^>]*>/i) ||
      textBetween(decoded, /<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["'][^>]*>/i);
    const image =
      firstImage(jsonLd?.image) ||
      textBetween(decoded, /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["'][^>]*>/i);
    const metaImages = [...decoded.matchAll(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["'][^>]*>/gi)]
      .map((match) => match[1])
      .filter(Boolean);
    const images = [...new Set([image, ...imagesFrom(jsonLd?.image), ...metaImages].filter(Boolean))];
    const variations = extractVariations(decoded);
    const firstVariation = variations[0];
    const price =
      firstVariation?.markazPrice ||
      numberFrom(offers?.price) ||
      numberFrom(textBetween(decoded, /<meta[^>]+property=["']product:price:amount["'][^>]+content=["']([^"']+)["'][^>]*>/i)) ||
      numberFrom(decoded.match(/(?:Rs\.?|PKR)\s*([0-9,.]+)/i)?.[1]);
    const pricing = buildPricing(price);
    const brand = typeof jsonLd?.brand === 'object' ? jsonLd.brand.name : jsonLd?.brand;
    const variationImages = firstVariation?.image
      ? [...new Set([firstVariation.image, ...images].filter(Boolean))]
      : images;

    res.status(200).json({
      name: firstVariation ? `${cleanText(title)} - ${firstVariation.name}` : cleanText(title),
      description: formatDescription(description),
      price: pricing.price,
      oldPrice: pricing.oldPrice,
      discount: pricing.discount,
      image: variationImages[0] || image,
      images: variationImages,
      brand: cleanText(brand || 'Markaz'),
      stock: firstVariation?.stock || 10,
      isActive: true,
      sourceUrl: url,
      markazPrice: price,
      markazStatus: firstVariation?.status || '',
      markazVariationId: firstVariation?.id || '',
      markazVariationName: firstVariation?.name || '',
      markazVariationOptions: firstVariation?.options || {},
      variations,
    });
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Could not scrape product',
    });
  }
}
