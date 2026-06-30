# Cài đặt Shopee Trend Studio (cho người dùng)

Extension cho **Google Chrome / Microsoft Edge / Cốc Cốc** (Chromium 111+).

## Cách cài (Load unpacked)
1. **Giải nén** file `shopee-trend-studio.zip` ra một thư mục (nhớ chỗ để, đừng xoá sau khi cài).
2. Mở trình duyệt, vào địa chỉ: `chrome://extensions`
   (Edge: `edge://extensions`, Cốc Cốc: `coccoc://extensions`).
3. Bật **Developer mode / Chế độ nhà phát triển** (góc trên bên phải).
4. Bấm **Load unpacked / Tải tiện ích đã giải nén** → chọn thư mục vừa giải nén
   (thư mục chứa file `manifest.json`).
5. Ghim icon 🛒 lên thanh công cụ cho dễ bấm.

> Chrome có thể hiện thông báo "Tắt tiện ích ở chế độ nhà phát triển" mỗi lần mở —
> cứ bấm **Giữ lại / Keep**, extension vẫn chạy bình thường.

## Cấu hình API key (để tạo ảnh/video bằng AI)
1. Bấm icon 🛒 → **⚙︎ Cài đặt**.
2. Dán **BytePlus ModelArk API key** của bạn (mỗi người tự đăng ký key riêng tại
   console ModelArk; model Seedream + Seedance phải được bật).
3. (Tuỳ chọn) Tải **ảnh khuôn mặt** của bạn để người trong ảnh/video mang mặt bạn.
4. Bấm **Lưu**.

> Không có API key vẫn dùng được phần **hút sản phẩm + export CSV/JSON**;
> chỉ phần tạo ảnh/video mới cần key.

## Dùng
1. Mở **https://shopee.vn/top_products** (hoặc trang tìm kiếm/danh mục), cuộn trang
   → sản phẩm tự xuất hiện trong popup (icon 🛒).
2. Tick chọn sản phẩm → **🎨 Ảnh** hoặc **🎬 Video** → chọn phong cách → tạo (chạy nền).
3. Xem ở **🖼 Kết quả** → Tải / Mở / Tạo lại.

## Gỡ cài đặt
`chrome://extensions` → tìm **Shopee Trend Studio** → **Remove**.
