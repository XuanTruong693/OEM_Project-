# 🧩 OEM Mini Database Setup Guide

> Dành cho nhóm dự án **OEM Mini (Online Examination Management System)**  
> Hướng dẫn cài đặt và kết nối MySQL database cho toàn bộ thành viên trong team.

---

## ⚙️ 1️⃣ Yêu cầu môi trường

Trước khi bắt đầu, đảm bảo máy của bạn đã có:

- ✅ **MySQL Server** (phiên bản 8.0.x trở lên)
- ✅ **MySQL Workbench** hoặc **XAMPP / Laragon** (nếu bạn dùng MariaDB)
- ✅ **Node.js** (phiên bản 18.x hoặc 20.x)
- ✅ Đã clone repository của dự án về máy

---

## 📁 2️⃣ Cấu trúc thư mục `database/`

| File | Mô tả |
|------|-------|
| `oem_migration_v5` | Tạo cấu trúc database (bảng, khóa, view, v.v.) |
| `test_oem_v5` | Thêm dữ liệu mẫu ban đầu (admin, instructor, student, v.v.) 
|và Kiểm tra dữ liệu sau khi import |

---

## 🧱 3️⃣ Các bước import database

### 🔹 Cách 1 — Dùng **MySQL Workbench**

1. Mở **MySQL Workbench**
2. Kết nối đến server MySQL (user: `root` hoặc user của bạn)
3. Vào menu **File → Open SQL Script...**
4. Chọn file `oem_migration_v5` → nhấn **Run (Ctrl+Shift+Enter)**
5. Cuối cùng, làm tương tự với file `test_oem_v5` vàvà có thể chạy `test_oem_v5` để kiểm tra dữ liệu mẫu

> Sau khi hoàn tất, bạn sẽ thấy database **`oem_mini`** xuất hiện trong sidebar.

---

### 🔹 Cách 2 — Dùng **Command Line (CMD / PowerShell)**

Mở terminal tại thư mục `/database` và chạy:

```bash
mysql -u root -p < oem_migration_v5.sql
mysql -u root -p < test_oem_v5.sql
```

---

## 🧪 4️⃣ Test kết nối database

Sau khi đã import database thành công, bạn có thể test kết nối bằng cách chạy file `test_db.js`:

### 🔹 Cách test kết nối

1. Mở terminal tại thư mục gốc của dự án
2. Di chuyển vào thư mục `backend`:
   ```bash
   cd backend
   ```
3. Chạy lệnh test kết nối:
   ```bash
   node test_db.js
   ```

### 🔹 Kết quả mong đợi

**✅ Kết nối thành công:**
```
[dotenv@17.2.3] injecting env (5) from .env
✅ Đã kết nối tới MySQL Database: oem_mini
🕒 Kết nối thành công! Thời gian hiện tại: 2025-10-10T18:35:30.000Z
```

**❌ Lỗi kết nối:**
```
❌ Lỗi khi truy vấn: Error: Unknown database 'oem_mini'
❌ Kết nối MySQL thất bại: Unknown database 'oem_mini'
```

### 🔹 Xử lý lỗi

Nếu gặp lỗi "Unknown database 'oem_mini'":
- Kiểm tra xem đã import file `oem_migration_v5.sql` chưa
- Đảm bảo MySQL server đang chạy
- Kiểm tra file `.env` trong thư mục `backend` có đúng thông tin kết nối không

---