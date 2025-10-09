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
| `migration_oem_mini.sql` | Tạo cấu trúc database (bảng, khóa, view, v.v.) |
| `seed_oem_mini.sql` | Thêm dữ liệu mẫu ban đầu (admin, instructor, student, v.v.) |
| `test_seed_oem_mini.sql` | Kiểm tra dữ liệu sau khi import |

---

## 🧱 3️⃣ Các bước import database

### 🔹 Cách 1 — Dùng **MySQL Workbench**

1. Mở **MySQL Workbench**
2. Kết nối đến server MySQL (user: `root` hoặc user của bạn)
3. Vào menu **File → Open SQL Script...**
4. Chọn file `migration_oem_mini.sql` → nhấn **Run (Ctrl+Shift+Enter)**
5. Làm tương tự với file `seed_oem_mini.sql`
6. Cuối cùng, có thể chạy `test_seed_oem_mini.sql` để kiểm tra dữ liệu mẫu

> Sau khi hoàn tất, bạn sẽ thấy database **`oem_mini`** xuất hiện trong sidebar.

---

### 🔹 Cách 2 — Dùng **Command Line (CMD / PowerShell)**

Mở terminal tại thư mục `/database` và chạy:

```bash
mysql -u root -p < migration_oem_mini.sql
mysql -u root -p < seed_oem_mini.sql

---