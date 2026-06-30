// popup.js (module) — list captured products, export, enqueue image jobs.
// Generation itself runs in the offscreen worker (see offscreen.js), so it keeps
// going after the popup closes. The popup only enqueues jobs and renders the
// queue/results from chrome.storage (live via storage.onChanged).
import { IMAGE_PRESETS, VIDEO_PRESETS } from './prompts.js';

const JOBS_KEY = 'sts_jobs';
const presetsFor = (kind) => (kind === 'video' ? VIDEO_PRESETS : IMAGE_PRESETS);

const listEl = document.getElementById('list');
const countEl = document.getElementById('count');
const hintEl = document.getElementById('hint');
const searchEl = document.getElementById('search');
const sortEl = document.getElementById('sort');

// gen (preset chooser) panel
const genPanel = document.getElementById('genPanel');
const genTitle = document.getElementById('genTitle');
const genRun = document.getElementById('genRun');
const genSrc = document.getElementById('genSrc');
const genName = document.getElementById('genName');
const presetSel = document.getElementById('presetSel');
const genStatus = document.getElementById('genStatus');

// jobs panel
const jobsPanel = document.getElementById('jobsPanel');
const jobsList = document.getElementById('jobsList');
const jobsEmpty = document.getElementById('jobsEmpty');
const jobsBadge = document.getElementById('jobsBadge');

let products = [];
let currentBatch = { products: [], kind: 'image' };

// ---------- product list ----------
function loadProducts() {
  chrome.runtime.sendMessage({ type: 'STS_GET' }, (items) => {
    products = Array.isArray(items) ? items : [];
    renderProducts();
  });
}

function renderProducts() {
  const q = searchEl.value.trim().toLowerCase();
  const sortKey = sortEl.value;
  let rows = products.filter((p) => !q || p.name.toLowerCase().includes(q));
  rows.sort((a, b) => {
    if (sortKey === 'priceVnd') return (a.priceVnd || 0) - (b.priceVnd || 0);
    return (b[sortKey] || 0) - (a[sortKey] || 0);
  });

  countEl.textContent = String(products.length);
  hintEl.classList.toggle('hidden', products.length > 0);
  listEl.innerHTML = '';

  for (const p of rows) {
    const li = document.createElement('li');
    li.className = 'card';

    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.dataset.key = (p.shopid || '') + '_' + p.itemid;

    const img = document.createElement('img');
    img.src = p.imageUrl;
    img.loading = 'lazy';
    img.referrerPolicy = 'no-referrer';

    const info = document.createElement('div');
    info.className = 'info';
    const price = p.priceVnd != null ? p.priceVnd.toLocaleString('vi-VN') + 'đ' : '—';
    const sold = p.sold != null ? ' · đã bán ' + p.sold.toLocaleString('vi-VN') : '';
    info.innerHTML =
      `<span class="name">${escapeHtml(p.name)}</span>` +
      `<span class="meta"><span class="price">${price}</span>${sold}` +
      (p.shopLocation ? ' · ' + escapeHtml(p.shopLocation) : '') + '</span>' +
      (p.link ? `<a href="${p.link}" target="_blank">mở trên Shopee ↗</a>` : '');

    li.append(cb, img, info);
    listEl.appendChild(li);
  }
}

// ---------- preset chooser → enqueue (single or batch, image or video) ----------
function fillPresets(kind) {
  presetSel.innerHTML = '';
  for (const p of presetsFor(kind)) {
    const o = document.createElement('option');
    o.value = p.id;
    o.textContent = p.label;
    presetSel.appendChild(o);
  }
}

function openGenPanel(productsArr, kind) {
  if (!productsArr || !productsArr.length) return;
  currentBatch = { products: productsArr, kind };
  genTitle.textContent = kind === 'video' ? '🎬 Tạo video viral' : '🎨 Tạo ảnh viral';
  genRun.textContent = kind === 'video' ? '➕ Tạo video (chạy nền)' : '➕ Tạo ảnh (chạy nền)';
  fillPresets(kind);

  if (productsArr.length === 1) {
    genSrc.style.display = '';
    genSrc.src = productsArr[0].imageUrl;
    genSrc.referrerPolicy = 'no-referrer';
    genName.textContent = productsArr[0].name;
  } else {
    genSrc.style.display = 'none';
    genName.textContent = `${productsArr.length} sản phẩm đã chọn`;
  }
  genStatus.textContent = '';
  genStatus.classList.remove('error');
  genPanel.classList.remove('hidden');
}

async function enqueue() {
  const { products: prods, kind } = currentBatch;
  if (!prods.length) return;
  const presets = presetsFor(kind);
  const preset = presets.find((x) => x.id === presetSel.value) || presets[0];

  const newJobs = prods.map((p) => ({
    id: crypto.randomUUID(),
    kind,
    name: p.name,
    imageUrl: p.imageUrl,
    link: p.link || null,
    presetId: preset.id,
    presetLabel: (kind === 'video' ? '🎬 ' : '🎨 ') + preset.label,
    prompt: preset.prompt.replace(/\{product\}/g, p.name),
    status: 'queued',
    ts: Date.now(),
  }));

  const { [JOBS_KEY]: jobs = [] } = await chrome.storage.local.get(JOBS_KEY);
  jobs.unshift(...newJobs);
  await chrome.storage.local.set({ [JOBS_KEY]: jobs });
  chrome.runtime.sendMessage({ type: 'STS_ENQUEUE' });

  genStatus.classList.remove('error');
  genStatus.innerHTML = `✅ Đã thêm ${newJobs.length} job vào hàng đợi — chạy nền, <b>có thể đóng popup</b>.`;
  renderJobs();
}

function selectedProducts() {
  const keys = new Set(selectedKeys());
  return products.filter((p) => keys.has((p.shopid || '') + '_' + p.itemid));
}

// ---------- jobs / results ----------
const STATUS_LABEL = {
  queued: '⏳ Chờ',
  running: '🎨 Đang tạo…',
  done: '✅ Xong',
  error: '⚠ Lỗi',
};

async function renderJobs() {
  const { [JOBS_KEY]: jobs = [] } = await chrome.storage.local.get(JOBS_KEY);
  const busy = jobs.some((j) => j.status === 'queued' || j.status === 'running');
  jobsBadge.textContent = String(jobs.length);
  jobsBadge.classList.toggle('busy', busy);
  jobsEmpty.classList.toggle('hidden', jobs.length > 0);
  jobsList.innerHTML = '';

  for (const j of jobs) {
    const li = document.createElement('li');
    li.className = 'job ' + j.status;

    const isVideo = j.kind === 'video';
    const thumbWrap = document.createElement('div');
    thumbWrap.className = 'job-thumb';
    const thumb = document.createElement('img');
    // videos have no poster -> show the source product image + a ▶ badge
    thumb.src = (!isVideo && j.resultUrl) ? j.resultUrl : j.imageUrl;
    thumb.referrerPolicy = 'no-referrer';
    if (j.status === 'running') thumb.classList.add('pulsing');
    thumbWrap.appendChild(thumb);
    if (isVideo) {
      const play = document.createElement('span');
      play.className = 'play';
      play.textContent = '▶';
      thumbWrap.appendChild(play);
    }

    const info = document.createElement('div');
    info.className = 'job-info';
    info.innerHTML =
      `<span class="job-name">${escapeHtml(j.name)}</span>` +
      `<span class="job-meta">${escapeHtml(j.presetLabel || '')} · <b>${STATUS_LABEL[j.status] || j.status}</b></span>` +
      (j.link ? `<a class="job-link" href="${j.link}" target="_blank" rel="noreferrer">mở sản phẩm trên Shopee ↗</a>` : '') +
      (j.status === 'error' && j.error ? `<span class="job-err">${escapeHtml(j.error)}</span>` : '');

    const acts = document.createElement('div');
    acts.className = 'job-acts';
    acts.append(...buildActions(j));

    li.append(thumbWrap, info, acts);
    jobsList.appendChild(li);
  }
}

function actionBtn(label, title, action, id) {
  const b = document.createElement('button');
  b.className = 'btn';
  b.textContent = label;
  b.title = title;
  b.dataset.action = action;
  b.dataset.id = id;
  return b;
}

function buildActions(j) {
  const a = [];
  if (j.status === 'done') {
    a.push(actionBtn('⬇︎', 'Tải', 'download', j.id));
    a.push(actionBtn('↗', 'Mở tab', 'open', j.id));
    a.push(actionBtn('🔁', 'Tạo lại', 'retry', j.id));
  } else if (j.status === 'error') {
    a.push(actionBtn('🔁', 'Thử lại', 'retry', j.id));
  }
  a.push(actionBtn('🗑', 'Xoá', 'delete', j.id));
  return a;
}

jobsList.addEventListener('click', async (e) => {
  const btn = e.target.closest('button[data-action]');
  if (!btn) return;
  const { action, id } = btn.dataset;
  const { [JOBS_KEY]: jobs = [] } = await chrome.storage.local.get(JOBS_KEY);
  const j = jobs.find((x) => x.id === id);
  if (!j) return;

  if (action === 'download' && j.resultUrl) {
    const safe = (j.name || 'viral').replace(/[^\p{L}\p{N}]+/gu, '-').slice(0, 40);
    const ext = j.kind === 'video' ? 'mp4' : 'png';
    chrome.downloads.download({ url: j.resultUrl, filename: `viral-${safe}-${id.slice(0, 6)}.${ext}` });
  } else if (action === 'open' && j.resultUrl) {
    chrome.tabs.create({ url: j.resultUrl });
  } else if (action === 'retry') {
    j.status = 'queued';
    delete j.error;
    delete j.resultUrl;
    await chrome.storage.local.set({ [JOBS_KEY]: jobs });
    chrome.runtime.sendMessage({ type: 'STS_ENQUEUE' });
  } else if (action === 'delete') {
    await chrome.storage.local.set({ [JOBS_KEY]: jobs.filter((x) => x.id !== id) });
  }
});

async function clearDoneJobs() {
  const { [JOBS_KEY]: jobs = [] } = await chrome.storage.local.get(JOBS_KEY);
  await chrome.storage.local.set({ [JOBS_KEY]: jobs.filter((j) => j.status !== 'done') });
}

// ---------- export helpers ----------
function selectedKeys() {
  return [...listEl.querySelectorAll('input[type=checkbox]:checked')].map((c) => c.dataset.key);
}
function rowsForExport() {
  const keys = new Set(selectedKeys());
  return keys.size
    ? products.filter((p) => keys.has((p.shopid || '') + '_' + p.itemid))
    : products;
}
function download(filename, text, mime) {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  chrome.downloads.download({ url, filename }, () => setTimeout(() => URL.revokeObjectURL(url), 5000));
}
function toCsv(rows) {
  const cols = ['itemid', 'shopid', 'name', 'priceVnd', 'sold', 'rating', 'shopLocation', 'imageUrl', 'link'];
  const head = cols.join(',');
  const body = rows.map((p) =>
    cols.map((c) => {
      const v = p[c] == null ? '' : String(p[c]);
      return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
    }).join(',')
  ).join('\n');
  return '﻿' + head + '\n' + body; // BOM so Excel/Sheets read UTF-8
}
function escapeHtml(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

// ---------- events ----------
searchEl.addEventListener('input', renderProducts);
sortEl.addEventListener('change', renderProducts);
document.getElementById('selectAll').addEventListener('click', () => {
  const boxes = listEl.querySelectorAll('input[type=checkbox]');
  const allChecked = [...boxes].every((b) => b.checked);
  boxes.forEach((b) => (b.checked = !allChecked));
});
document.getElementById('exportCsv').addEventListener('click', () => {
  const rows = rowsForExport();
  if (rows.length) download('shopee-top-products.csv', toCsv(rows), 'text/csv;charset=utf-8');
});
document.getElementById('exportJson').addEventListener('click', () => {
  const rows = rowsForExport();
  if (rows.length) download('shopee-top-products.json', JSON.stringify(rows, null, 2), 'application/json');
});
document.getElementById('clear').addEventListener('click', () => {
  if (!confirm('Xoá toàn bộ sản phẩm đã bắt?')) return;
  chrome.runtime.sendMessage({ type: 'STS_CLEAR' }, () => loadProducts());
});
document.getElementById('opts').addEventListener('click', (e) => {
  e.preventDefault();
  chrome.runtime.openOptionsPage();
});

document.getElementById('genClose').addEventListener('click', () => genPanel.classList.add('hidden'));
document.getElementById('genRun').addEventListener('click', enqueue);
document.getElementById('batchImg').addEventListener('click', () => {
  const sel = selectedProducts();
  if (!sel.length) { alert('Tick chọn ít nhất 1 sản phẩm trước.'); return; }
  openGenPanel(sel, 'image');
});
document.getElementById('batchVid').addEventListener('click', () => {
  const sel = selectedProducts();
  if (!sel.length) { alert('Tick chọn ít nhất 1 sản phẩm trước.'); return; }
  openGenPanel(sel, 'video');
});
document.getElementById('genGoJobs').addEventListener('click', (e) => {
  e.preventDefault();
  genPanel.classList.add('hidden');
  jobsPanel.classList.remove('hidden');
  renderJobs();
});
document.getElementById('showJobs').addEventListener('click', () => {
  jobsPanel.classList.remove('hidden');
  renderJobs();
});
document.getElementById('jobsClose').addEventListener('click', () => jobsPanel.classList.add('hidden'));
document.getElementById('jobsClearDone').addEventListener('click', clearDoneJobs);

// live updates from offscreen worker / capture
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local') return;
  if (changes[JOBS_KEY]) renderJobs();
  if (changes.sts_products) loadProducts();
});

loadProducts();
renderJobs();
