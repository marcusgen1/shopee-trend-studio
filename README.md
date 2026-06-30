# Shopee Trend Studio (extension)

Extension Chrome hút danh sách sản phẩm từ **shopee.vn/top_products** (và các trang
tìm kiếm/danh mục), sau đó (Phase 2–3) dùng AI **BytePlus Seedream/Seedance** chế
ảnh & video theo phong cách **hài hước / troll / dễ viral** cho POD.

## Vì sao làm dạng extension?
Web app thường **không lấy được** dữ liệu Shopee: API bị **CORS** chặn + **anti-bot 403**
(cần header ký từ JS của Shopee). Extension chạy *ngay trên trang shopee.vn* nên:
- "Ăn ké" chính request đã ký của Shopee (không tự gọi API → không dính 403).
- Service worker MV3 có `host_permissions` nên gọi API AI (Ark) **không bị CORS**.

## Cách hoạt động
1. `inject.js` (MAIN world) wrap `fetch`/`XHR` của trang → bắt JSON Shopee trả về.
2. `content.js` lọc ra các object sản phẩm → gửi về `background.js`.
3. `background.js` de-dup + lưu `chrome.storage.local`, cập nhật badge số lượng.
4. `popup` hiển thị bảng sản phẩm: lọc, sắp xếp, chọn, **Export CSV/JSON**.

## Cài đặt (Load unpacked)
1. Chrome cần **v111+**. Mở `chrome://extensions`.
2. Bật **Developer mode** (góc trên phải).
3. **Load unpacked** → chọn thư mục `shopee-trend-studio`.
4. Ghim icon 🛒 cho dễ bấm.

## Test Phase 1 (quan trọng — kiểm chứng capture)
1. Mở **https://shopee.vn/top_products**, để trang load xong rồi **cuộn** một chút.
   (Có thể mở thêm trang tìm kiếm bất kỳ, vd `shopee.vn/search?keyword=áo`.)
2. Badge đỏ trên icon sẽ tăng số → bấm icon mở popup, thấy danh sách sản phẩm.
3. Bấm **Export CSV/JSON** để lấy dữ liệu.
4. Nếu badge **không** tăng: mở DevTools (F12) → Console, tìm log
   `[Shopee Trend Studio] interceptor installed`. Báo lại mình các request
   `/api/...` mà trang gọi (tab Network) để mình chỉnh bộ lọc `isInteresting`.

## Cài đặt API key (cho Phase 2–3)
Mở **⚙︎ Cài đặt** trong popup → dán **BytePlus ModelArk API key** + model id.
Key chỉ lưu local (`chrome.storage.local`), không gửi đi đâu.

## Dùng Phase 2 — tạo ảnh viral (chạy nền)
1. Mở **⚙︎ Cài đặt** → dán **ModelArk API key** (model mặc định `seedream-4-0-250828`) → Lưu.
2. Bấm **🎨** trên 1 sản phẩm → chọn phong cách (đều là "người dùng sản phẩm", hài hước) → **➕ Tạo ảnh (chạy nền)**.
3. Job vào **hàng đợi** và chạy nền — **đóng popup vẫn chạy tiếp**.
4. Mở lại popup → **🖼 Kết quả** để xem trạng thái (⏳ Chờ / 🎨 Đang tạo / ✅ Xong / ⚠ Lỗi) → **Tải / Mở / Tạo lại**.

Kiến trúc (vì sao chạy nền được):
- **popup** chỉ đẩy job vào `chrome.storage` (`sts_jobs`) rồi báo service worker.
- **service worker** tạo **Offscreen Document** (`src/offscreen.html`) — trang ẩn, không bị kill như SW.
- **offscreen** (`src/offscreen.js` + `src/ai.js`) rút hàng đợi, gọi `POST /api/v3/images/generations`
  (image-to-image, `size:2K`, `watermark:false`), ghi kết quả vào storage; xong thì SW đóng offscreen.
- popup cập nhật **trực tiếp** qua `chrome.storage.onChanged`. Job dở dang (offscreen bị đóng) được
  `requeueStale()` đưa lại 'queued' và chạy lại lần sau → không mất job.

Prompt: tiếng Anh, bắt buộc **NO text** (Seedream không viết được tiếng Việt) + **giữ sản phẩm
y ảnh gốc** + nhấn mạnh **một điểm nhấn gây cười**. Caption tiếng Việt thật để Phase 4 (overlay canvas).

## Khuôn mặt của bạn (face reference)
Vào **⚙︎ Cài đặt** → **📸 Ảnh khuôn mặt** → chọn ảnh chính diện rõ mặt (tự thu nhỏ ≤1024px, lưu local).
- **Ảnh:** Seedream nhận 2 ảnh tham chiếu — `[ảnh sản phẩm, ảnh mặt bạn]` — người trong ảnh sẽ mang mặt bạn, sản phẩm giữ nguyên.
- **Video:** trước tiên compose 1 khung hình tĩnh có mặt bạn + sản phẩm (Seedream), rồi mới dùng nó làm `first_frame` cho Seedance → video mang mặt bạn. (Mỗi video = 1 lần gen ảnh + 1 lần gen video.)
- Không đặt ảnh mặt → vẫn chạy như cũ (người chung chung). Nút 🎨 riêng từng sản phẩm đã bỏ; dùng nút batch ở footer.

## Batch (sản phẩm đã tick)
Tick chọn nhiều sản phẩm → footer:
- **🎨 Ảnh** → chọn preset → tạo ảnh cho TẤT CẢ sản phẩm đã chọn (mỗi cái 1 job).
- **🎬 Video** → chọn preset video → tạo video cho các sản phẩm đã chọn.
Tất cả vào cùng hàng đợi, chạy nền tuần tự; xem ở **🖼 Kết quả**.

## Video (Seedance, Phase 3)
- **⚠ Vào ⚙︎ Cài đặt nhập đúng `vidModel`** (copy id Seedance từ console ModelArk, phải đã bật) — sai id → Ark 400/404.
- Luồng: `POST /api/v3/contents/generations/tasks` (content = text + image_url role `first_frame`,
  `ratio:adaptive`, `720p`, `5s`) → poll `GET .../tasks/{id}` tới `succeeded` → `content.video_url` (MP4).
- Poll chạy trong offscreen (bền), nên video 1–3 phút vẫn xong dù đóng popup. URL Ark hết hạn ~24h → tải sớm.

## Lộ trình
- [x] **Phase 1** — capture top_products + list + export
- [x] **Phase 2** — Seedream: sinh ảnh viral (preset trong `src/prompts.js`)
- [x] **Phase 3** — Seedance: ảnh → video clip (task async + poll) + batch theo tick chọn
- [ ] **Phase 4** — overlay caption tiếng Việt (canvas) / đẩy Google Sheet–Drive, polish

## Lưu ý
- Dùng trên phiên duyệt cá nhân của bạn = rủi ro thấp. Ảnh gốc thuộc về shop khác;
  chế lại bằng AI để tham khảo/ý tưởng thì ổn, bê nguyên đi bán có rủi ro bản quyền.
- Giá hiển thị = `price / 100000` (chuẩn mã hoá giá VND của Shopee) — nếu lệch, báo mình chỉnh.
