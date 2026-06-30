// content.js — ISOLATED world. Receives captured JSON from inject.js (via
// window.postMessage), extracts product objects, and relays them to the
// background service worker for de-dup + storage.

const IMG_BASE = 'https://down-vn.img.susercontent.com/file/';

window.addEventListener('message', (event) => {
  if (event.source !== window) return;
  const data = event.data;
  if (!data || data.__sts !== true) return;
  let products;
  try {
    products = extractProducts(data.body);
  } catch (_) {
    return;
  }
  if (products && products.length) {
    chrome.runtime.sendMessage({ type: 'STS_PRODUCTS', url: data.url, products });
  }
});

// Walk an arbitrary JSON tree and pull out anything that looks like a Shopee item.
function extractProducts(root) {
  const out = [];
  const seen = new Set();
  const stack = [root];
  let guard = 0;

  while (stack.length && guard < 100000) {
    guard++;
    const node = stack.pop();
    if (!node || typeof node !== 'object') continue;

    if (Array.isArray(node)) {
      for (const v of node) if (v && typeof v === 'object') stack.push(v);
      continue;
    }

    const basic = node.item_basic || node.item || node;
    const itemid = basic.itemid || basic.item_id;
    const shopid = basic.shopid || basic.shop_id;
    const name = basic.name || basic.title;
    const image = basic.image || (Array.isArray(basic.images) && basic.images[0]);

    if (itemid && name && image) {
      const key = (shopid || '') + '_' + itemid;
      if (!seen.has(key)) {
        seen.add(key);
        const rawPrice = pickNum(basic.price, basic.price_min, basic.price_max);
        out.push({
          itemid,
          shopid: shopid || null,
          name: String(name),
          // Shopee encodes price as VND * 100000
          priceVnd: rawPrice != null ? Math.round(rawPrice / 100000) : null,
          sold: pickNum(basic.historical_sold, basic.sold, basic.global_sold_count),
          rating: basic.item_rating && basic.item_rating.rating_star
            ? Math.round(basic.item_rating.rating_star * 10) / 10
            : null,
          imageHash: image,
          imageUrl: IMG_BASE + image,
          link: shopid && itemid ? `https://shopee.vn/product/${shopid}/${itemid}` : null,
          shopLocation: basic.shop_location || null,
        });
      }
    }

    // keep descending
    for (const k in node) {
      const v = node[k];
      if (v && typeof v === 'object') stack.push(v);
    }
  }
  return out;
}

function pickNum(...vals) {
  for (const v of vals) if (typeof v === 'number' && !Number.isNaN(v)) return v;
  return null;
}
