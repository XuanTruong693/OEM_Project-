# 🎓 OEM - Online Examination Management System

Hệ thống quản lý thi trực tuyến với AI chấm điểm tự động và xác minh khuôn mặt.

## 📋 Yêu cầu hệ thống

| Component | Version |
|-----------|---------|
| Node.js | >= 18.x |
| Python | 3.11.x (Bắt buộc trên Windows để tránh lỗi Crash) |
| MySQL | >= 8.0 |
| Tesseract OCR | >= 5.0 (cho đọc thẻ sinh viên) |

---

## 🚀 Cài đặt nhanh

### Bước 1: Clone repository
```bash
git clone https://github.com/XuanTruong693/OEM_Project-.git
cd OEM_Project-
```

### Bước 2: Cài đặt tất cả dependencies
```bash
# Cài root dependencies
npm install

# Cài Backend dependencies
cd backend && npm install && cd ..

# Cài Frontend dependencies
cd frontend && npm install && cd ..

# Cài AI dependencies (xem chi tiết bên dưới)
```

---

## 🤖 Cài đặt AI Services (Python)

> [!IMPORTANT]
> **Lưu ý:**
> Phải sử dụng **Python 3.11**. Tuyệt đối **không** dùng Python 3.12 hoặc 3.13 vì thư viện `underthesea` (bản mới) và `pytorch` chưa hỗ trợ tốt, sẽ gây Crash ứng dụng.
> File `requirements.txt` đã được cấu hình để tự động cài phiên bản ổn định (`underthesea<7`).

### Windows PowerShell:
```powershell
cd ai_services

# Tạo virtual environment
python -m venv .venv

# Kích hoạt venv
.\.venv\Scripts\Activate.ps1

# Cài đặt tất cả thư viện
pip install --upgrade pip
pip install -r requirements.txt
```

### Linux/macOS:
```bash
cd ai_services

# Tạo virtual environment
python3 -m venv .venv

# Kích hoạt venv
source .venv/bin/activate

# Cài đặt tất cả thư viện
pip install --upgrade pip
pip install -r requirements.txt
```

### Thư viện AI bao gồm:
| Library | Mục đích |
|---------|----------|
| `fastapi` | API Framework |
| `uvicorn` | ASGI Server |
| `sentence-transformers` | AI Embedding & Similarity |
| `torch` | Deep Learning Framework |
| `underthesea` | Vietnamese NLP |
| `uniface` | Face Detection & Recognition |
| `opencv-python` | Image Processing |
| `pytesseract` | OCR (đọc thẻ sinh viên) |
| `mysql-connector-python` | Database Access |

---

## 🏃 Chạy ứng dụng

### Development Mode (localhost):
```bash
# Từ thư mục root - chạy cả BE + FE + AI
npm run dev
```
| Service | URL |
|---------|-----|
| Frontend | http://localhost:4000 |
| Backend | http://localhost:5000 |
| AI Service | http://localhost:8000 |
| AI Docs | http://localhost:8000/docs |

### Production Mode (Cloudflare Tunnel):
```bash
# Từ thư mục root
npm start
```
| Service | URL |
|---------|-----|
| Frontend | https://oes.io.vn |
| Backend | https://api.oes.io.vn |
| AI Service | https://ai.oes.io.vn |

### Chạy riêng từng phần:

**Frontend:**
```bash
cd frontend
npm run dev
```

**Backend:**
```bash
cd backend
npm run dev
```

**AI Service:**
```bash
cd ai_services
.\.venv\Scripts\Activate.ps1  # Windows
# hoặc: source .venv/bin/activate  # Linux/Mac
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

---

## 🗄️ Cấu hình Database

### 1. Tạo database MySQL:
```sql
CREATE DATABASE oem_mini CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE DATABASE oem_admin CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

### 2. Import schema:
```bash
mysql -u root -p oem_mini < database/oem_migration_v5.sql
mysql -u root -p oem_admin < database/oem_admin_complete.sql
```

### 3. Cấu hình file `.env` (backend/.env):
```env
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=oem_mini
ADMIN_DB_NAME=oem_admin
JWT_SECRET=your_jwt_secret
```

---

## 👤 Tạo tài khoản Admin

```bash
cd backend

# Cấu hình UTF-8 (Windows)
chcp 65001
[Console]::InputEncoding = [System.Text.Encoding]::UTF8
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

# Chạy script tạo admin
npm run taoTK
```

---

## 📁 Cấu trúc thư mục

```
OEM_Project/
├── frontend/           # React + Vite
├── backend/            # Node.js + Express
├── ai_services/        # Python FastAPI
│   ├── app/
│   │   ├── nlp/        # AI Grading modules
│   │   ├── main.py     # FastAPI endpoints
│   │   └── learning.py # AI Learning module
│   ├── .venv/          # Python virtual environment
│   └── requirements.txt
├── database/           # SQL schemas
├── dev.js              # Development runner
├── start.js            # Production runner
└── package.json
```

---

## 🔧 Git Commands

```bash
# Clone project
git clone https://github.com/XuanTruong693/OEM_Project-.git

# Cập nhật từ remote
git pull origin main

# Tạo branch mới
git checkout -b feature/ten-tinh-nang

# Commit và push
git add .
git commit -m "Mô tả thay đổi"
git push origin feature/ten-tinh-nang
```

---

## 📞 API Endpoints

### AI Grading:
```bash
POST /grade
Content-Type: application/json

{
  "student_answer": "Câu trả lời của sinh viên",
  "model_answer": "Đáp án mẫu",
  "max_points": 10
}
```

### Response:
```json
{
  "score": 9.24,
  "confidence": 1.0,
  "explanation": "Great answer! Good logic match."
}
```

---

## ⚠️ Troubleshooting

### Lỗi Python không tìm thấy:
```bash
# Tạo lại virtual environment
cd ai_services
rm -rf .venv
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

### Lỗi port đang bị sử dụng:
```powershell
# Tìm và kill process
Get-NetTCPConnection -LocalPort 5000 | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }
```

### Lỗi tiếng Việt trong terminal:
```powershell
chcp 65001
[Console]::InputEncoding = [System.Text.Encoding]::UTF8
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
```

---

## 📄 License


