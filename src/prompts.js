// prompts.js — presets for Phase 2 (Seedream image) & Phase 3 (Seedance video).
// {product} is filled with the captured product name; the Shopee product image
// is passed as the reference image (field `image`), so the real product shows up.
//
// IMPORTANT: Seedream cannot render Vietnamese (diacritics come out garbled), so
// every preset explicitly forbids text in the image. Want a Vietnamese caption?
// That's a canvas text overlay in the extension (Phase 4), NOT the model.
// Prompts are in English for more reliable control of the model.

// Shared tail: comedic PUNCH + a strong focal point + keep product faithful + no text.
const PUNCH =
  ' Make it genuinely funny and meme-worthy: ONE bold comedic focal point that ' +
  'grabs attention in the first second, an exaggerated surprising detail, lively ' +
  'over-the-top expressions, vibrant punchy pop colors, a dramatic spotlight making ' +
  'the product the hero, dynamic energetic composition. Photorealistic, high detail.';

const RULES =
  ' Keep the product EXACTLY like the reference image (same shape, colors, logo, ' +
  'details). Absolutely NO text, captions, letters, numbers, signage, logos or ' +
  'watermarks anywhere in the image.';

export const IMAGE_PRESETS = [
  {
    id: 'person_using',
    label: '🙋 Người dùng sản phẩm (mặc định)',
    prompt:
      'A real, relatable young Vietnamese person caught mid-action genuinely using / ' +
      'holding / wearing the product "{product}", with a hilarious delighted reaction.' +
      PUNCH + RULES,
  },
  {
    id: 'funny_reaction',
    label: '😂 Biểu cảm cực mạnh',
    prompt:
      'A Vietnamese person using the product "{product}" with a wildly exaggerated, ' +
      'jaw-dropping comedic reaction (eyes popping, total disbelief), peak meme energy.' +
      PUNCH + RULES,
  },
  {
    id: 'troll_situation',
    label: '🤪 Tình huống troll',
    prompt:
      'A Vietnamese person using the product "{product}" in an absurd, unexpected, ' +
      'laugh-out-loud situation with a ridiculous twist, like a viral candid phone snapshot.' +
      PUNCH + RULES,
  },
  {
    id: 'ugc_phone',
    label: '📱 UGC kiểu tự quay',
    prompt:
      'Chaotic-funny user-generated selfie of a Vietnamese person excitedly showing off ' +
      'the product "{product}", messy real home/street background, authentic TikTok vibe.' +
      PUNCH + RULES,
  },
  {
    id: 'group_fun',
    label: '👫 Nhóm bạn quậy',
    prompt:
      'A group of young Vietnamese friends cracking up together while fighting over / ' +
      'showing the product "{product}", chaotic cheerful party energy, one clear funny hero moment.' +
      PUNCH + RULES,
  },
  {
    id: 'clean_studio',
    label: '🧼 Studio nền trắng (an toàn)',
    prompt:
      'Clean professional e-commerce studio photo of the product "{product}" on a pure ' +
      'white background, soft lighting, sharp focus (safe option, no people, no humor).' +
      RULES,
  },
];

export const VIDEO_PRESETS = [
  {
    id: 'person_demo',
    label: '🙋 Người demo vui nhộn',
    prompt:
      'Short funny clip: a Vietnamese person playfully using/showing the product ' +
      '"{product}" with one big comedic beat, lively viral TikTok energy. No text on screen.',
  },
  {
    id: 'reaction',
    label: '😂 Reaction phóng đại',
    prompt:
      'A Vietnamese person reacts to the product "{product}" with a wildly exaggerated, ' +
      'hilarious reaction and snappy comedic timing. No text on screen.',
  },
  {
    id: 'zoom_punch',
    label: '⚡ Zoom giật bắt trend',
    prompt:
      'Punchy short clip with rhythmic comedic zooms on the product "{product}" and a ' +
      'person, meme-style exaggerated motion, surprising funny beat at the end. No text.',
  },
];
