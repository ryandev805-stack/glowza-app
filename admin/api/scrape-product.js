function textBetween(source, pattern) {
  const match = source.match(pattern);
  return match?.[1]?.trim() || '';
}

function cleanText(value) {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
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

function numberFrom(value) {
  const match = String(value || '').replace(/,/g, '').match(/\d+(\.\d+)?/);
  return match ? Number(match[0]) : 0;
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
    const jsonLd = parseJsonLd(html);
    const offers = Array.isArray(jsonLd?.offers) ? jsonLd.offers[0] : jsonLd?.offers;
    const title =
      jsonLd?.name ||
      textBetween(html, /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["'][^>]*>/i) ||
      textBetween(html, /<title[^>]*>([\s\S]*?)<\/title>/i);
    const description =
      jsonLd?.description ||
      textBetween(html, /<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["'][^>]*>/i) ||
      textBetween(html, /<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["'][^>]*>/i);
    const image =
      firstImage(jsonLd?.image) ||
      textBetween(html, /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["'][^>]*>/i);
    const metaImages = [...html.matchAll(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["'][^>]*>/gi)]
      .map((match) => match[1])
      .filter(Boolean);
    const images = [...new Set([image, ...imagesFrom(jsonLd?.image), ...metaImages].filter(Boolean))];
    const price =
      numberFrom(offers?.price) ||
      numberFrom(textBetween(html, /<meta[^>]+property=["']product:price:amount["'][^>]+content=["']([^"']+)["'][^>]*>/i)) ||
      numberFrom(html.match(/(?:Rs\.?|PKR)\s*([0-9,.]+)/i)?.[1]);
    const brand = typeof jsonLd?.brand === 'object' ? jsonLd.brand.name : jsonLd?.brand;

    res.status(200).json({
      name: cleanText(title),
      description: cleanText(description),
      price,
      oldPrice: price,
      image,
      images,
      brand: cleanText(brand || 'Markaz'),
      stock: 10,
      isActive: true,
      sourceUrl: url,
    });
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Could not scrape product',
    });
  }
}
