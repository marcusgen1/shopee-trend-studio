// offscreen.js — persistent hidden page used ONLY as a fetch worker.
// Offscreen documents only get chrome.runtime (NOT chrome.storage), so this file
// must never touch chrome.storage. The service worker owns the queue + storage;
// it sends us jobs, we generate images, and we report each result back via a
// message. We survive the popup closing and aren't killed mid-fetch like the SW.
import { generateImage, generateVideo } from './ai.js';

const queue = [];
const seen = new Set(); // job ids already accepted this session (dedupe resends)
let settings = null;
let processing = false;

chrome.runtime.onMessage.addListener((msg) => {
  if (!msg || msg.target !== 'offscreen') return;
  if (msg.type === 'PROCESS') {
    if (msg.settings) settings = msg.settings;
    for (const job of msg.jobs || []) {
      if (!seen.has(job.id)) { seen.add(job.id); queue.push(job); }
    }
    drain();
  }
});

async function drain() {
  if (processing) return;
  processing = true;
  try {
    while (queue.length) {
      const job = queue.shift();
      await report(job.id, { status: 'running', startTs: Date.now() });
      let r;
      try {
        r = job.kind === 'video'
          ? await generateVideo(settings, job.imageUrl, job.prompt)
          : await generateImage(settings, job.imageUrl, job.prompt);
      } catch (e) {
        r = { ok: false, error: String((e && e.message) || e) };
      }
      await report(
        job.id,
        r.ok
          ? { status: 'done', resultUrl: r.url, doneTs: Date.now() }
          : { status: 'error', error: r.error, doneTs: Date.now() }
      );
    }
  } finally {
    processing = false;
    chrome.runtime.sendMessage({ type: 'STS_IDLE' }).catch(() => {});
  }
}

// Ask the service worker (which has chrome.storage) to persist a job update.
// Awaited so the SW stays alive long enough to finish the (fast) storage write.
function report(id, patch) {
  return chrome.runtime.sendMessage({ type: 'JOB_UPDATE', id, patch }).catch(() => {});
}

// Tell the SW we're alive so it dispatches whatever is queued (handshake avoids
// a race where PROCESS is sent before this listener is registered).
chrome.runtime.sendMessage({ type: 'OFFSCREEN_READY' }).catch(() => {});
