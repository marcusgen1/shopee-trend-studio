// background.js — service worker. Collect + de-dup captured products into
// chrome.storage.local and keep a badge count. AI generation (Seedream/Seedance)
// runs in the popup via src/ai.js, NOT here (see note below).

const STORAGE_KEY = 'sts_products';

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg || !msg.type) return;

  if (msg.type === 'STS_PRODUCTS') {
    mergeProducts(msg.products).then((total) => {
      chrome.action.setBadgeText({ text: total > 999 ? '999+' : String(total) });
      chrome.action.setBadgeBackgroundColor({ color: '#ee4d2d' });
    });
    return; // fire-and-forget
  }

  if (msg.type === 'STS_GET') {
    chrome.storage.local.get(STORAGE_KEY).then((r) => sendResponse(r[STORAGE_KEY] || []));
    return true; // async response
  }

  if (msg.type === 'STS_CLEAR') {
    chrome.storage.local.set({ [STORAGE_KEY]: [] }).then(() => {
      chrome.action.setBadgeText({ text: '' });
      sendResponse(true);
    });
    return true;
  }

  // Popup added job(s) -> ensure offscreen worker exists and hand it the queue.
  if (msg.type === 'STS_ENQUEUE') {
    dispatchJobs();
    return; // fire-and-forget
  }

  // Offscreen page loaded and is ready -> hand it whatever is queued.
  if (msg.type === 'OFFSCREEN_READY') {
    dispatchJobs();
    return;
  }

  // Offscreen reports a job's progress/result -> persist to storage (it can't).
  if (msg.type === 'JOB_UPDATE') {
    (async () => {
      const { sts_jobs = [] } = await chrome.storage.local.get('sts_jobs');
      const j = sts_jobs.find((x) => x.id === msg.id);
      if (j) {
        Object.assign(j, msg.patch);
        await chrome.storage.local.set({ sts_jobs });
      }
      sendResponse(true);
    })();
    return true; // keep SW alive until the (fast) write finishes
  }

  // Offscreen drained the queue. If something new slipped in, re-dispatch;
  // otherwise close it to free resources.
  if (msg.type === 'STS_IDLE') {
    (async () => {
      const { sts_jobs = [] } = await chrome.storage.local.get('sts_jobs');
      const remaining = sts_jobs.some((j) => j.status === 'queued' || j.status === 'running');
      if (remaining) dispatchJobs();
      else closeOffscreen();
    })();
    return;
  }
});

// ---- Offscreen worker lifecycle (image/video generation runs there, see ai.js) ----
// An extension PAGE (offscreen doc) keeps host_permissions, isn't killed while open,
// and survives the popup closing — unlike the MV3 service worker, which gets
// terminated mid-fetch. So all slow API work happens in the offscreen document.
const OFFSCREEN_URL = 'src/offscreen.html';
let creatingOffscreen = null;

async function ensureOffscreen() {
  if (await chrome.offscreen.hasDocument()) return;
  if (creatingOffscreen) { await creatingOffscreen; return; }
  creatingOffscreen = chrome.offscreen.createDocument({
    url: OFFSCREEN_URL,
    reasons: ['BLOBS'],
    justification: 'Tạo ảnh marketing qua API ở chế độ nền để tiếp tục chạy sau khi đóng popup.',
  });
  try { await creatingOffscreen; } finally { creatingOffscreen = null; }
}

async function closeOffscreen() {
  try {
    if (await chrome.offscreen.hasDocument()) await chrome.offscreen.closeDocument();
  } catch (_) {}
}

// Read the queue from storage and hand pending jobs (+ API settings) to the
// offscreen worker. Resends are deduped by job id on the offscreen side, and
// 'running' jobs are included so a worker that died mid-job gets them again.
async function dispatchJobs() {
  try {
    await ensureOffscreen();
    const { sts_jobs = [], sts_settings } = await chrome.storage.local.get(['sts_jobs', 'sts_settings']);
    const todo = sts_jobs.filter((j) => j.status === 'queued' || j.status === 'running');
    if (todo.length) {
      chrome.runtime
        .sendMessage({ target: 'offscreen', type: 'PROCESS', jobs: todo, settings: sts_settings })
        .catch(() => {});
    }
  } catch (e) {
    console.warn('[STS] dispatchJobs', e);
  }
}

async function mergeProducts(incoming) {
  const r = await chrome.storage.local.get(STORAGE_KEY);
  const existing = r[STORAGE_KEY] || [];
  const map = new Map(existing.map((p) => [keyOf(p), p]));
  const now = Date.now();
  for (const p of incoming) {
    const k = keyOf(p);
    if (!map.has(k)) {
      map.set(k, { ...p, capturedAt: now });
    } else {
      // refresh volatile fields (price/sold can change) but keep first-seen time
      const prev = map.get(k);
      map.set(k, { ...prev, priceVnd: p.priceVnd ?? prev.priceVnd, sold: p.sold ?? prev.sold });
    }
  }
  const arr = [...map.values()];
  await chrome.storage.local.set({ [STORAGE_KEY]: arr });
  return arr.length;
}

function keyOf(p) {
  return (p.shopid || '') + '_' + p.itemid;
}
