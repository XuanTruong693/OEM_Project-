-Cài dependencies cho root project
npm install

-Cài dependencies cho frontend
cd frontend
npm install

-Cài dependencies cho backend  
cd ../backend
npm install

-Chạy Cả Frontend + Backend 
-Từ thư mục root
npm start
-Hoặc Chạy Riêng Từng Phần

-Frontend
cd frontend
npm run dev
-Backend
cd backend
npm run dev

--Cách lấy code về và đồng bộ project---
Clone repository
git clone https://github.com/USERNAME/OEM_Project-.git

Di chuyển vào thư mục project
cd OEM_Project-

Kiểm tra branch hiện tại
git branch

Nếu muốn tạo branch mới để làm việc, dùng:
git checkout -b feature-branch

Đồng bộ với repository chính
git pull origin main

Đẩy thay đổi lên GitHub nếu đã xong những phần trong ngày
-== đẩy code lên github
git add .
git commit -m "Mô tả thay đổi, ví dụ: Update LandingPage CSS"
git push

### khi bị lỗi tiếng việt khi đăng ký tài khoản admin, chạy lệnh terminal sau:
### ⚙️ Cấu hình terminal hiển thị tiếng Việt
Nếu chạy `npm run taoTK` mà thấy ký tự bị lỗi (VD: Hß╗ì...), hãy làm theo:
```bash
chcp 65001
[Console]::InputEncoding  = [System.Text.Encoding]::UTF8
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

