import fetch from 'node-fetch';

function cleanQuery(query) {
  return query
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

async function fetchShopifyCompetitor(domain, platformName, query) {
  try {
    const url = `https://${domain}/search/suggest.json?q=${encodeURIComponent(query)}&resources[type]=product&resources[limit]=3`;
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'application/json'
      }
    });
    if (!res.ok) return [];
    const data = await res.json();
    const products = data.resources?.results?.products || [];
    
    return products.map(p => {
      const priceNum = parseFloat(p.price.replace(/[^0-9.]/g, '')) || 0;
      return {
        title: p.title,
        price: priceNum,
        url: `https://${domain}${p.url}`,
        image: p.image || '',
        source: platformName
      };
    });
  } catch (error) {
    console.error(`Shopify fetch failed for ${domain}:`, error);
    return [];
  }
}

async function fetchDarazPrices(query) {
  try {
    const url = `https://www.google.com/search?q=site:daraz.pk+${encodeURIComponent(query)}`;
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8'
      }
    });
    if (!res.ok) return [];
    const html = await res.text();
    
    const results = [];
    // Catch google result links to daraz
    const googleResultRegex = /<a href="\/url\?q=(https:\/\/www\.daraz\.pk\/products\/[^"&]+)[^>]*>([\s\S]*?)<\/h3>/gi;
    
    let match;
    let limit = 0;
    while ((match = googleResultRegex.exec(html)) !== null && limit < 5) {
      const productUrl = decodeURIComponent(match[1]);
      let title = match[2].replace(/<[^>]*>/g, '').trim();
      
      const index = html.indexOf(match[0]);
      const snippetContext = html.substring(Math.max(0, index - 200), Math.min(html.length, index + 1000));
      const priceMatch = snippetContext.match(/(?:Rs\.?|PKR)\s*([0-9,]+)/i);
      const price = priceMatch ? parseFloat(priceMatch[1].replace(/,/g, '')) : null;
      
      if (price) {
        results.push({
          title: title.replace(/\s*-\s*daraz\.pk.*/i, '').trim(),
          price: price,
          url: productUrl,
          image: '',
          source: 'Daraz'
        });
        limit += 1;
      }
    }
    return results;
  } catch (error) {
    console.error('Daraz Google proxy fetch failed:', error);
    return [];
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { query } = req.body || {};
  if (!query || query.trim().length < 3) {
    return res.status(400).json({ error: 'Query parameter must be at least 3 characters long' });
  }

  const cleaned = cleanQuery(query);
  try {
    const [bagallery, elo, daraz] = await Promise.all([
      fetchShopifyCompetitor('bagallery.com', 'Bagallery', cleaned),
      fetchShopifyCompetitor('www.elo.pk', 'Elo', cleaned),
      fetchDarazPrices(query)
    ]);

    const allMatches = [...bagallery, ...elo, ...daraz]
      .filter(item => item.price > 0)
      .sort((a, b) => a.price - b.price);

    res.status(200).json({
      query,
      results: allMatches
    });
  } catch (error) {
    res.status(500).json({ error: error.message || 'Could not analyze competitor prices' });
  }
}
