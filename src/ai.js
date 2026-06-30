// ai.js — BytePlus ModelArk calls. Imported by the popup (an extension PAGE),
// not the service worker: a page isn't torn down while open and still has the
// extension's host_permissions, so fetch to Ark/Shopee bypasses CORS without
// the MV3 service-worker lifetime problems.

export const ARK_IMAGE_URL = 'https://ark.ap-southeast.bytepluses.com/api/v3/images/generations';
export const ARK_VIDEO_TASKS_URL = 'https://ark.ap-southeast.bytepluses.com/api/v3/contents/generations/tasks';

// Instruction appended when a face reference is supplied (2nd reference image).
const FACE_NOTE =
  ' IMPORTANT references: the FIRST reference image is the product — keep it ' +
  'identical. The SECOND reference image is a real person\'s face — the main ' +
  'person in the result MUST have that exact same face and identity (same facial ' +
  'features, hair); this face takes precedence over any generic description of the person.';

// Seedream image-to-image (+ optional face reference). Returns { ok, url }.
export async function generateImage(settings, productImageUrl, prompt) {
  const s = settings || {};
  if (!s.arkKey) return { ok: false, error: 'Chưa nhập API key — mở ⚙︎ Cài đặt.' };

  // Normalize every reference to a clean JPEG data URL (Shopee often serves WebP;
  // re-encoding via canvas avoids "Invalid base64 image_url" rejections).
  const refs = [];
  try {
    const prod = await fetchAsDataUrl(productImageUrl);
    refs.push(await reencodeJpeg(prod)); // [0] = product
  } catch (e) {
    return { ok: false, error: 'Không xử lý được ảnh sản phẩm: ' + ((e && e.message) || e) };
  }
  if (s.faceImage) {
    try {
      refs.push(await reencodeJpeg(s.faceImage)); // [1] = your face
    } catch (_) {
      refs.push(s.faceImage);
    }
  }

  const body = {
    model: s.imgModel || 'seedream-4-0-250828',
    prompt: s.faceImage ? prompt + FACE_NOTE : prompt,
    image: refs.length > 1 ? refs : refs[0], // multi-reference when face is set
    size: '2K',
    sequential_image_generation: 'disabled',
    response_format: 'url',
    watermark: false,
  };

  let res, json;
  try {
    res = await fetch(ARK_IMAGE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + s.arkKey },
      body: JSON.stringify(body),
    });
    json = await res.json().catch(() => ({}));
  } catch (e) {
    return { ok: false, error: 'Lỗi mạng khi gọi Ark: ' + ((e && e.message) || e) };
  }

  if (!res.ok) {
    const m = (json && json.error && (json.error.message || json.error.code)) ||
      JSON.stringify(json).slice(0, 250);
    return { ok: false, error: `Ark ${res.status}: ${m}` };
  }

  const item = json && json.data && json.data[0];
  const url = item && (item.url || (item.b64_json ? 'data:image/png;base64,' + item.b64_json : null));
  if (!url) return { ok: false, error: 'Response không có ảnh: ' + JSON.stringify(json).slice(0, 250) };
  return { ok: true, url };
}

// Seedance image-to-video: create an async task, poll until done, return the
// MP4 url. Returns { ok, url } or { ok:false, error }. Note: Ark result URLs
// expire ~24h, so download promptly.
export async function generateVideo(settings, productImageUrl, prompt) {
  const s = settings || {};
  if (!s.arkKey) return { ok: false, error: 'Chưa nhập API key — mở ⚙︎ Cài đặt.' };
  const model = s.vidModel || 'seedance-1-0-pro-250528';

  // Always compose the first frame via Seedream first: it returns an Ark-hosted
  // https URL (Seedance's image_url rejects base64), and it bakes in your face
  // (when set) + the product so the video carries the right identity.
  const composePrompt = prompt +
    ' As a single photorealistic still photo, the person clearly visible and facing the camera. No text.';
  const composed = await generateImage(s, productImageUrl, composePrompt);
  if (!composed.ok) return { ok: false, error: 'Lỗi tạo khung hình đầu: ' + composed.error };
  const firstFrameUrl = composed.url; // Ark image URL — Seedance can fetch it

  // 1) create task
  let res, json;
  try {
    res = await fetch(ARK_VIDEO_TASKS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + s.arkKey },
      body: JSON.stringify({
        model,
        content: [
          { type: 'text', text: prompt },
          { type: 'image_url', image_url: { url: firstFrameUrl }, role: 'first_frame' },
        ],
        ratio: 'adaptive', // auto-fit the product image (no awkward crop)
        resolution: '720p',
        duration: 5,
        generate_audio: false,
      }),
    });
    json = await res.json().catch(() => ({}));
  } catch (e) {
    return { ok: false, error: 'Lỗi mạng (tạo task video): ' + ((e && e.message) || e) };
  }
  if (!res.ok) {
    const m = (json && json.error && (json.error.message || json.error.code)) ||
      JSON.stringify(json).slice(0, 250);
    return { ok: false, error: `Ark ${res.status}: ${m}` };
  }
  const taskId = json.id || json.task_id || (json.data && json.data.id);
  if (!taskId) return { ok: false, error: 'Không có task id: ' + JSON.stringify(json).slice(0, 200) };

  // 2) poll until terminal (max ~5 min)
  const deadline = Date.now() + 5 * 60 * 1000;
  while (Date.now() < deadline) {
    await sleep(5000);
    let r, j;
    try {
      r = await fetch(ARK_VIDEO_TASKS_URL + '/' + encodeURIComponent(taskId), {
        headers: { 'Authorization': 'Bearer ' + s.arkKey },
      });
      j = await r.json().catch(() => ({}));
    } catch (_) {
      continue; // transient network blip -> keep polling
    }
    if (!r.ok) {
      const m = (j && j.error && (j.error.message || j.error.code)) || ('HTTP ' + r.status);
      return { ok: false, error: `Ark poll ${r.status}: ${m}` };
    }
    const status = j.status;
    if (status === 'succeeded') {
      const url = (j.content && (j.content.video_url || j.content.url)) || (j.data && j.data.video_url);
      if (url) return { ok: true, url };
      return { ok: false, error: 'Xong nhưng thiếu video_url: ' + JSON.stringify(j).slice(0, 200) };
    }
    if (status === 'failed' || status === 'expired' || status === 'cancelled') {
      return { ok: false, error: 'Task ' + status + ': ' + ((j.error && j.error.message) || JSON.stringify(j).slice(0, 150)) };
    }
    // queued | running -> keep waiting
  }
  return { ok: false, error: 'Quá thời gian chờ video (5 phút).' };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Re-encode a data: URL image to a clean JPEG data URL via canvas (the offscreen
// page has a DOM). Loading a data: URL doesn't taint the canvas, so toDataURL
// works. Flattens transparency on white and caps the longest side.
function reencodeJpeg(dataUrl, max = 2048, quality = 0.92) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      let { width, height } = img;
      if (!width || !height) return reject(new Error('empty image'));
      if (Math.max(width, height) > max) {
        if (width >= height) { height = Math.round((height * max) / width); width = max; }
        else { width = Math.round((width * max) / height); height = max; }
      }
      const c = document.createElement('canvas');
      c.width = width;
      c.height = height;
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0, width, height);
      try {
        resolve(c.toDataURL('image/jpeg', quality));
      } catch (e) {
        reject(e);
      }
    };
    img.onerror = () => reject(new Error('decode failed'));
    img.src = dataUrl;
  });
}

// Fetch an image URL -> base64 data: URL (works in both page and worker).
export async function fetchAsDataUrl(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error('HTTP ' + res.status);
  const buf = await res.arrayBuffer();
  const type = res.headers.get('content-type') || 'image/jpeg';
  const bytes = new Uint8Array(buf);
  let binary = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
  }
  return `data:${type};base64,${btoa(binary)}`;
}
