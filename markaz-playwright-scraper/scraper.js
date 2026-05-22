const fs = require('node:fs/promises');
const path = require('node:path');
const readline = require('node:readline/promises');
const { stdin: input, stdout: output } = require('node:process');
const { chromium } = require('playwright');

const OUTPUT_JSON = path.join(__dirname, 'products.json');
const OUTPUT_TXT = path.join(__dirname, 'product_urls.txt');

const SCROLL_DELAY_MS = Number(process.env.SCROLL_DELAY_MS || 1200);
const MAX_IDLE_SCROLLS = Number(process.env.MAX_IDLE_SCROLLS || 10);
const MAX_SCROLLS = Number(process.env.MAX_SCROLLS || 250);

const productsById = new Map();
let runtimeConfig = {
  startUrl: process.env.MARKAZ_URL || 'https://www.markaz.app/shop',
  minPrice: Number(process.env.MIN_PRICE || 0),
  maxPrice: Number(process.env.MAX_PRICE || 999999999),
  deepSearch: String(process.env.DEEP_SEARCH || '').toLowerCase() === 'true',
  maxProducts: Number(process.env.MAX_PRODUCTS || 200),
};

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseNumber(value, fallback) {
  const cleaned = String(value || '').replace(/,/g, '').trim();
  const number = Number(cleaned);
  return Number.isFinite(number) ? number : fallback;
}

async function askConfig() {
  if (!process.stdin.isTTY || process.env.CI === 'true') return runtimeConfig;

  const rl = readline.createInterface({ input, output });
  try {
    const startUrl =
      (await rl.question(`Markaz URL [${runtimeConfig.startUrl}]: `)).trim() ||
      runtimeConfig.startUrl;
    const minPrice = parseNumber(
      await rl.question(`Minimum Markaz price [${runtimeConfig.minPrice}]: `),
      runtimeConfig.minPrice,
    );
    const maxPrice = parseNumber(
      await rl.question(`Maximum Markaz price [${runtimeConfig.maxPrice}]: `),
      runtimeConfig.maxPrice,
    );
    const maxProducts = parseNumber(
      await rl.question(`Number of products to collect [${runtimeConfig.maxProducts}]: `),
      runtimeConfig.maxProducts,
    );
    const deepAnswer = (
      await rl.question(`Deep search product detail pages? [${runtimeConfig.deepSearch ? 'Y/n' : 'y/N'}]: `)
    ).trim().toLowerCase();
    const deepSearch = deepAnswer
      ? ['y', 'yes', 'true', '1'].includes(deepAnswer)
      : runtimeConfig.deepSearch;

    runtimeConfig = {
      startUrl,
      minPrice,
      maxPrice,
      deepSearch,
      maxProducts: Math.max(1, Math.floor(maxProducts)),
    };
    return runtimeConfig;
  } finally {
    rl.close();
  }
}

function normalizeProductUrl(url) {
  try {
    const parsed = new URL(url, runtimeConfig.startUrl);
    if (parsed.hostname !== 'www.markaz.app') return '';
    if (!parsed.pathname.startsWith('/shop/product/')) return '';
    parsed.search = '';
    parsed.hash = '';
    return parsed.toString().replace(/\/$/, '');
  } catch {
    return '';
  }
}

function extractProductId(url) {
  const cleanUrl = normalizeProductUrl(url);
  const match = cleanUrl.match(/\/(\d+)$/);
  return match?.[1] || '';
}

function parseRscText(text) {
  const decoded = String(text || '')
    .replace(/\\"/g, '"')
    .replace(/\\\//g, '/')
    .replace(/\\n/g, '\n')
    .replace(/\\u0026/g, '&')
    .replace(/\\u003c/g, '<')
    .replace(/\\u003e/g, '>');

  const name =
    decoded.match(/"name":"([^"]+)"/)?.[1] ||
    decoded.match(/"title":"([^"]+)"/)?.[1] ||
    decoded.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ||
    '';

  const price =
    decoded.match(/"markazPrice":([0-9.]+)/)?.[1] ||
    decoded.match(/"prePaidPrice":([0-9.]+)/)?.[1] ||
    decoded.match(/"salePrice":([0-9.]+)/)?.[1] ||
    decoded.match(/"price":([0-9.]+)/)?.[1] ||
    decoded.match(/(?:Rs\.?|PKR)\s*([0-9,.]+)/i)?.[1] ||
    '';

  const images = [
    ...decoded.matchAll(/https?:\/\/[^"'\\\s<]+\.(?:jpg|jpeg|png|webp|avif)(?:\?[^"'\\\s<]*)?/gi),
  ]
    .map((match) => match[0])
    .filter((imageUrl, index, list) => list.indexOf(imageUrl) === index)
    .slice(0, 20);

  return {
    name: cleanText(name),
    price: price ? Number(String(price).replace(/,/g, '')) : null,
    images,
  };
}

function parsePriceFromText(text) {
  const value =
    String(text || '').match(/(?:Rs\.?|PKR)\s*([0-9][0-9,.]*)/i)?.[1] ||
    String(text || '').match(/"prePaidPrice":([0-9.]+)/)?.[1] ||
    String(text || '').match(/"salePrice":([0-9.]+)/)?.[1] ||
    String(text || '').match(/"price":([0-9.]+)/)?.[1] ||
    '';
  return value ? Number(String(value).replace(/,/g, '')) : null;
}

function isInsidePriceRange(product) {
  if (product.price == null) return runtimeConfig.deepSearch ? false : true;
  return product.price >= runtimeConfig.minPrice && product.price <= runtimeConfig.maxPrice;
}

function marketplacePrice(price) {
  const basePrice = Number(price) || 0;
  let margin = 0;
  if (basePrice <= 500) margin = 200;
  else if (basePrice <= 1000) margin = 300;
  else if (basePrice <= 1500) margin = 500;
  else if (basePrice <= 2500) margin = 750;
  else if (basePrice <= 3500) margin = 1000;
  else margin = basePrice * 0.5;

  const salePrice = Math.ceil(basePrice + margin);
  const cutPrice = Math.ceil(salePrice / 0.6);
  return {
    markazPrice: basePrice,
    margin: Math.ceil(margin),
    salePrice,
    cutPrice,
    displayDiscountPercent: cutPrice > salePrice ? Math.round(((cutPrice - salePrice) / cutPrice) * 100) : 0,
  };
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

async function saveOutputs() {
  const products = [...productsById.values()]
    .filter(isInsidePriceRange)
    .map((product) => ({
      ...product,
      pricingRule: product.price == null ? null : marketplacePrice(product.price),
    }))
    .sort((a, b) => Number(a.productId) - Number(b.productId));
  await fs.writeFile(OUTPUT_JSON, `${JSON.stringify(products, null, 2)}\n`, 'utf8');
  await fs.writeFile(OUTPUT_TXT, `${products.map((product) => product.url).join('\n')}\n`, 'utf8');
  return products.length;
}

async function recordRscResponse(response) {
  const responseUrl = response.url();
  if (!responseUrl.includes('/shop/product/') || !responseUrl.includes('_rsc=')) return false;

  const cleanUrl = normalizeProductUrl(responseUrl);
  const productId = extractProductId(cleanUrl);
  if (!cleanUrl || !productId) return false;

  try {
    const rawRscText = await response.text();
    const parsed = parseRscText(rawRscText);
    const previous = productsById.get(productId);

    productsById.set(productId, {
      productId,
      url: cleanUrl,
      capturedAt: new Date().toISOString(),
      status: response.status(),
      name: parsed.name || previous?.name || '',
      price: parsed.price ?? previous?.price ?? null,
      images: parsed.images.length ? parsed.images : previous?.images || [],
      pricingRule: parsed.price == null ? previous?.pricingRule || null : marketplacePrice(parsed.price),
      rawRscText,
    });

    return !previous;
  } catch (error) {
    console.warn(`Could not read RSC response for ${cleanUrl}: ${error.message}`);
    return false;
  }
}

async function enrichProductFromDetailPage(context, product) {
  const detailPage = await context.newPage();
  try {
    await detailPage.goto(product.url, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await delay(900);
    const detail = await detailPage.evaluate(() => {
      const title =
        document.querySelector('h1')?.textContent ||
        document.querySelector('[data-testid*="title"]')?.textContent ||
        document.title ||
        '';
      const bodyText = document.body?.innerText || '';
      const images = [...document.images].map((image) => image.currentSrc || image.src).filter(Boolean);
      return { title, bodyText, images };
    });

    const price = parsePriceFromText(detail.bodyText);
    const current = productsById.get(product.productId) || product;
    productsById.set(product.productId, {
      ...current,
      name: cleanText(current.name || detail.title),
      price: current.price ?? price,
      images: current.images?.length ? current.images : detail.images.slice(0, 20),
      pricingRule: current.price != null ? marketplacePrice(current.price) : price != null ? marketplacePrice(price) : null,
      deepFetched: true,
    });
  } catch (error) {
    console.warn(`Deep search failed for ${product.url}: ${error.message}`);
  } finally {
    await detailPage.close().catch(() => {});
  }
}

async function deepSearchProducts(context) {
  const products = [...productsById.values()];
  console.log(`Deep search enabled. Visiting ${products.length} product detail pages to read price/details.`);
  for (let index = 0; index < products.length; index += 1) {
    const product = products[index];
    console.log(`Deep search ${index + 1}/${products.length}: ${product.url}`);
    await enrichProductFromDetailPage(context, product);
    await delay(700);
    if ((index + 1) % 10 === 0) await saveOutputs();
  }
}

async function collectVisibleProductUrls(page) {
  return page.evaluate(() => {
    return [...document.querySelectorAll('a[href*="/shop/product/"]')]
      .map((anchor) => anchor.href)
      .filter(Boolean);
  });
}

async function triggerProductPrefetches(page) {
  const urls = await collectVisibleProductUrls(page);
  for (const url of urls) {
    const cleanUrl = normalizeProductUrl(url);
    const productId = extractProductId(cleanUrl);
    if (!cleanUrl || !productId || productsById.has(productId)) continue;

    productsById.set(productId, {
      productId,
      url: cleanUrl,
      capturedAt: new Date().toISOString(),
      status: null,
      name: '',
      price: null,
      images: [],
      rawRscText: '',
    });
  }
}

async function clickShowMoreProducts(page) {
  const selectors = [
    'button:has-text("Show more products")',
    'text=/show\\s+more\\s+products/i',
    'button:has-text("Show More")',
    'text=/show\\s+more/i',
  ];

  for (const selector of selectors) {
    const locator = page.locator(selector).first();
    try {
      if ((await locator.count()) === 0) continue;
      if (!(await locator.isVisible({ timeout: 500 }))) continue;

      await locator.scrollIntoViewIfNeeded({ timeout: 3000 });
      await delay(300);
      await locator.click({ timeout: 5000 });
      console.log('Clicked "Show more products".');
      await delay(SCROLL_DELAY_MS);
      return true;
    } catch {
      // Try the next selector. Markaz can render the button as different elements.
    }
  }

  return false;
}

async function autoScrollAndCollect(page) {
  let idleScrolls = 0;
  let lastCount = productsById.size;

  for (let attempt = 1; attempt <= MAX_SCROLLS; attempt += 1) {
    await triggerProductPrefetches(page);

    await page.evaluate(() => {
      window.scrollBy(0, window.innerHeight * 0.75);
    });

    await delay(SCROLL_DELAY_MS);
    const clickedShowMore = await clickShowMoreProducts(page);
    await triggerProductPrefetches(page);

    const currentCount = productsById.size;
    const newCount = currentCount - lastCount;

    console.log(
      `Scroll ${attempt}: ${currentCount}/${runtimeConfig.maxProducts} products collected${newCount > 0 ? ` (+${newCount})` : ''}`,
    );

    if (currentCount >= runtimeConfig.maxProducts) {
      console.log(`Target reached: ${runtimeConfig.maxProducts} products.`);
      break;
    }

    if (currentCount === lastCount && !clickedShowMore) {
      idleScrolls += 1;
    } else {
      idleScrolls = 0;
      lastCount = currentCount;
      await saveOutputs();
    }

    if (idleScrolls >= MAX_IDLE_SCROLLS) {
      console.log(`Stopping after ${idleScrolls} scrolls with no new products.`);
      break;
    }
  }
}

async function main() {
  const config = await askConfig();
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 2.75,
    viewport: { width: 390, height: 844 },
    userAgent:
      'Mozilla/5.0 (Linux; Android 12; Pixel 5) AppleWebKit/537.36 Chrome/124.0.0.0 Mobile Safari/537.36',
  });

  const page = await context.newPage();

  page.on('response', async (response) => {
    try {
      const isNew = await recordRscResponse(response);
      if (isNew) {
        console.log(`RSC product captured: ${normalizeProductUrl(response.url())}`);
      }
    } catch (error) {
      console.warn(`Response handler failed for ${response.url()}: ${error.message}`);
    }
  });

  page.on('requestfailed', (request) => {
    const url = request.url();
    if (url.includes('/shop/product/') || url.includes('markaz.app')) {
      console.warn(`Request failed: ${url} - ${request.failure()?.errorText || 'unknown error'}`);
    }
  });

  try {
    console.log(`Opening ${config.startUrl}`);
    console.log(`Price range: PKR ${config.minPrice} - ${config.maxPrice}`);
    console.log(`Target products: ${config.maxProducts}`);
    console.log(`Deep search: ${config.deepSearch ? 'enabled' : 'disabled'}`);
    await page.goto(config.startUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await delay(2500);

    await autoScrollAndCollect(page);
    if (config.deepSearch) {
      await deepSearchProducts(context);
    }
    const total = await saveOutputs();

    console.log(`Done. Saved ${total} products inside selected price range.`);
    console.log('Glowza pricing rule included in products.json as pricingRule:');
    console.log('- <=500: +200 margin');
    console.log('- 501-1000: +300 margin');
    console.log('- 1001-1500: +500 margin');
    console.log('- 1501-2500: +750 margin');
    console.log('- 2501-3500: +1000 margin');
    console.log('- >3500: +50% margin');
    console.log(`JSON: ${OUTPUT_JSON}`);
    console.log(`URLs: ${OUTPUT_TXT}`);
  } finally {
    await browser.close();
  }
}

if (require.main === module) {
  main().catch(async (error) => {
    console.error(`Scraper failed: ${error.stack || error.message}`);
    await saveOutputs().catch(() => {});
    process.exit(1);
  });
}

module.exports = {
  normalizeProductUrl,
  extractProductId,
  parseRscText,
  autoScrollAndCollect,
};
