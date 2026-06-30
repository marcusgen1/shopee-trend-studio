// options.js — persist API key, model ids, and your face reference image
// (downscaled) to chrome.storage.local. Everything stays on this machine.
const DEFAULTS = {
  arkKey: '',
  imgModel: 'seedream-4-0-250828',
  vidModel: 'seedance-1-0-pro-250528',
};

const els = {
  arkKey: document.getElementById('arkKey'),
  imgModel: document.getElementById('imgModel'),
  vidModel: document.getElementById('vidModel'),
};
const faceFile = document.getElementById('faceFile');
const facePreview = document.getElementById('facePreview');
const facePreviewWrap = document.getElementById('facePreviewWrap');
const faceRemove = document.getElementById('faceRemove');

let faceImage = ''; // data URL of your face (or '')

chrome.storage.local.get('sts_settings').then((r) => {
  const s = { ...DEFAULTS, ...(r.sts_settings || {}) };
  els.arkKey.value = s.arkKey;
  els.imgModel.value = s.imgModel;
  els.vidModel.value = s.vidModel;
  faceImage = s.faceImage || '';
  renderFace();
});

function renderFace() {
  if (faceImage) {
    facePreview.src = faceImage;
    facePreviewWrap.style.display = 'flex';
  } else {
    facePreview.removeAttribute('src');
    facePreviewWrap.style.display = 'none';
  }
}

// Merge current fields into stored settings (so we never clobber other keys).
async function persist(extra = {}) {
  const { sts_settings } = await chrome.storage.local.get('sts_settings');
  const s = {
    ...(sts_settings || {}),
    arkKey: els.arkKey.value.trim(),
    imgModel: els.imgModel.value.trim() || DEFAULTS.imgModel,
    vidModel: els.vidModel.value.trim() || DEFAULTS.vidModel,
    faceImage,
    ...extra,
  };
  await chrome.storage.local.set({ sts_settings: s });
}

function flash(msg) {
  const st = document.getElementById('status');
  st.textContent = msg;
  setTimeout(() => (st.textContent = ''), 1600);
}

document.getElementById('save').addEventListener('click', async () => {
  await persist();
  flash('✓ Đã lưu');
});

// Pick a face image -> downscale -> store immediately.
faceFile.addEventListener('change', async () => {
  const file = faceFile.files && faceFile.files[0];
  if (!file) return;
  try {
    faceImage = await downscaleToDataUrl(file, 1024, 0.85);
    renderFace();
    await persist();
    flash('✓ Đã lưu ảnh mặt');
  } catch (e) {
    flash('⚠ Lỗi đọc ảnh: ' + ((e && e.message) || e));
  }
});

faceRemove.addEventListener('click', async () => {
  faceImage = '';
  faceFile.value = '';
  renderFace();
  await persist();
  flash('✓ Đã xoá ảnh mặt');
});

// Read a File, scale longest side down to `max`, return a JPEG data URL.
function downscaleToDataUrl(file, max, quality) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        let { width, height } = img;
        if (Math.max(width, height) > max) {
          if (width >= height) { height = Math.round((height * max) / width); width = max; }
          else { width = Math.round((width * max) / height); height = max; }
        }
        const c = document.createElement('canvas');
        c.width = width;
        c.height = height;
        c.getContext('2d').drawImage(img, 0, 0, width, height);
        resolve(c.toDataURL('image/jpeg', quality));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}
