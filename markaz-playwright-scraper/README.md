# Markaz Playwright Scraper

Scrapes Markaz product URLs and captured Next.js RSC product prefetch payloads from:

```bash
https://www.markaz.app/shop
```

## Run

```bash
cd markaz-playwright-scraper
npm install
node scraper.js
```

When you run it, the scraper asks:

- Markaz URL
- Minimum Markaz price
- Maximum Markaz price
- Number of products to collect
- Whether to deep search product detail pages

Optional:

```bash
MARKAZ_URL=https://www.markaz.app/shop/search?q=bag MAX_PRODUCTS=300 node scraper.js
MIN_PRICE=500 MAX_PRICE=2500 MAX_PRODUCTS=300 DEEP_SEARCH=true node scraper.js
MAX_IDLE_SCROLLS=15 MAX_SCROLLS=400 node scraper.js
```

The browser context is mobile-first (`390x844`, touch enabled, Android user agent) because Markaz loads more products on mobile. When the mobile page shows a `Show more products` button, the scraper clicks it automatically and continues collecting.

## Output

The scraper writes:

```bash
products.json
product_urls.txt
```

`products.json` contains the clean product URL, product ID, captured raw `_rsc` response text, parsed summary when available, and a `pricingRule` object.

The included pricing rule follows the current Glowza margin setup:

- Markaz price up to `500`: add `200`
- `501` to `1000`: add `300`
- `1001` to `1500`: add `500`
- `1501` to `2500`: add `750`
- `2501` to `3500`: add `1000`
- Above `3500`: add `50%`

The cut price is calculated from the sale price using a `40%` display discount.
