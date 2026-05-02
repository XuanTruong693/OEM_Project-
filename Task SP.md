# Sheet1

|OEMS v3.0 - Task Assignment (Sprint Backlog)| | | | | | | | | | | | | | |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| | | | | | | | | | | | | | | |
|Sprint 1 (04/02 - 01/03) - AI Grading & Biometric Foundation| | | | | | | | | | | | | | |
|#|ID|Task Name|US|Khối|Start|Finish|Effort|Giờ|Role|Assignee|Name| | | |
|1|T1.1|Sprint 1 Planning Meeting|—|Scrum Ceremony|04/02|04/02|0.5d|3h|Scrum Master|SM+BE+AI Dev(Web)|All| | | |
|2|T1.2|Create Sprint 1 Backlog|—|Scrum Ceremony|04/02|04/02|0.5d|3h|Scrum Master|SM+BE+AI Dev(Web)|All| | |(US06-T1.5): implement instructor corrections → JSONL dataset pipeline|
|3|T1.3|Create Test Plan document for Sprint 1|—|Scrum Ceremony|05/02|05/02|0.5d|3h|QA|Design(Mobile)|All| | | |
|4|T1.4|Create Database document for Sprint 1|—|Scrum Ceremony|05/02|05/02|0.5d|3h|Backend|BE+AI Integration(Mobile)|All| | | |
|5|T1.5|Thiết kế data pipeline: instructor corrections → JSONL dataset|US06|Machine Learning Enhancement|06/02|07/02|2d|16h|AI Dev|SM+BE+AI Dev(Web)|Trường|v| | |
|6|T1.6|Cải tiến grader.py – thêm keyword extraction, scoring weights, Vietnamese essay rubric|US05|AI NLP/NLI Integration|06/02|08/02|3d|24h|AI Dev|SM+BE+AI Dev(Web)|Trường|v| | |
|7|T1.7|Cập nhật dataset_learning.py – lưu correction data|US06|Machine Learning Enhancement|08/02|10/02|3d|24h|AI Dev|SM+BE+AI Dev(Web)|Trường|v| | |
|8|T1.8|Cải tiến similarity.py – fine-tune PhoBERT embeddings, adjust similarity threshold, handle synonyms|US01|AI NLP/NLI Integration|09/02|11/02|3d|24h|AI Dev|SM+BE+AI Dev(Web)|Trường|v| | |
|9|T1.9|Tạo bảng student_cards trong MySQL schema|US10|MSSV Lookup & Student Card DB|10/02|10/02|1d|8h|Backend|BE+AI Integration(Mobile)|Trường|v| | |
|10|T1.10|Design: Biometric Verification 3-step flow wireframe (Web)|US04|Eye Blink Liveness Detection|10/02|11/02|2d|16h|Designer|FE+Design(Web)|Bảo| | | |
|11|T1.11|Auto-retrain AI model khi đủ 20 corrections + lưu version + tracking accuracy trước/sau|US06|Machine Learning Enhancement|11/02|14/02|4d|32h|AI Dev|SM+BE+AI Dev(Web)|Trường|v| | |
|12|T1.12|API: POST /api/verify/student-id – MSSV lookup|US07|MSSV Lookup & Student Card DB|11/02|12/02|2d|16h|Backend|BE+AI Integration(Mobile)|Trường|v| | |
|13|T1.13|Design: Admin Student Card Management page wireframe|US10|MSSV Lookup & Student Card DB|12/02|12/02|1d|8h|Designer|FE+Design(Web)|Bảo| | | |
|14|T1.14|Cải tiến contradiction.py – NLI detection + noise filtering tiếng Việt|US03|AI NLP/NLI Integration|12/02|14/02|3d|24h|AI Dev|SM+BE+AI Dev(Web)|Trường|v| | |
|15|T1.15|Admin API: CRUD student cards (single/batch upload)|US10|MSSV Lookup & Student Card DB|13/02|14/02|2d|16h|Backend|BE+AI Integration(Mobile)|Trường|v| | |
|16|T1.16|Tích hợp MediaPipe Face Mesh vào Frontend|US08|Eye Blink Liveness Detection|14/02|16/02|3d|24h|Frontend|FE+Design(Web)|Bảo| | | |
|17|T1.17|Tạo API /api/learn/batch-train & /api/learn/stats|US06|Machine Learning Enhancement|15/02|16/02|2d|8h|Backend|BE+AI Integration(Mobile)|Trường|v| | |
|18|T1.18|Admin API: Import student cards từ Excel hoặc upload ảnh|US10|MSSV Lookup & Student Card DB|15/02|16/02|2d|16h|Backend|BE+AI Integration(Mobile)|T.Bảo| | | |
|19|T1.19|Cải tiến tokenizer.py – xử lý tokenize tiếng Việt chính xác hơn|US01|AI NLP/NLI Integration|15/02|16/02|2d|16h|AI Dev|SM+BE+AI Dev(Web)|Trường|v| | |
|20|T1.20|Training AI model với ai_training_data.json|US05|Machine Learning Enhancement|17/02|20/02|4d|32h|AI Dev|BE+AI Integration(Mobile)|Trường|v| | |
|21|T1.21|Frontend: MSSV input form component cho Student|US07|MSSV Lookup & Student Card DB|17/02|17/02|1d|8h|Frontend|FE+Design(Web)|Bảo| | | |
|22|T1.22|Implement blink detection algorithm (EAR - Eye Aspect Ratio)|US08|Eye Blink Liveness Detection|17/02|18/02|2d|16h|Frontend|FE+Design(Web)|Bảo| | | |
|23|T1.23|Cải tiến important_patterns.py – mở rộng pattern matching|US03|AI NLP/NLI Integration|17/02|18/02|2d|16h|AI Dev|SM+BE+AI Dev(Web)|Trường|v| | |
|24|T1.24|Frontend: Admin UI quản lý student card (list, search, filter)|US10|MSSV Lookup & Student Card DB|18/02|19/02|2d|16h|Frontend|FE+Design(Web)|Bảo| | | |
|25|T1.25|Cải tiến code_analyzer.py – phân tích code trong essay|US05|AI NLP/NLI Integration|19/02|19/02|1d|8h|AI Dev|SM+BE+AI Dev(Web)|Trường|v| | |
|26|T1.26|Cập nhật API endpoint /api/ai/grade – FastAPI service|US02|AI NLP/NLI Integration|20/02|21/02|2d|16h|Backend|BE+AI Integration(Mobile)|Trường|v| | |
|27|T1.27|Test MSSV lookup (lookup time < 1s)|US07|MSSV Lookup & Student Card DB|20/02|20/02|1d|8h|QA|Design(Mobile)|Quý| | | |
|28|T1.28|Wireframes cho tất cả màn hình Mobile (Figma)|US11|Mobile UX/UI Design|20/02|21/02|2d|16h|Designer|Design(Mobile)|Hùng| | | |
|29|T1.29|Training bổ sung với university_training_data.json|US06|Machine Learning Enhancement|21/02|24/02|4d|32h|AI Dev|BE+AI Integration(Mobile)|Trường|v| | |
|30|T1.30|Test blink detection (accuracy ≥ 95%, 3 blinks/5s)|US08|Eye Blink Liveness Detection|21/02|22/02|2d|16h|QA|Design(Mobile)|Hùng| | | |
|31|T1.31|Trigger AI grading tự động khi student submit|US02|AI NLP/NLI Integration|22/02|22/02|1d|8h|Backend|BE+AI Integration(Mobile)|Trường|v| | |
|32|T1.32|Frontend: Face Capture UI – giữ im 3 giây, chụp ảnh khuôn mặt|US04|Eye Blink Liveness Detection|22/02|22/02|1d|8h|Frontend|FE+Design(Web)|Trường|v| | |
|33|T1.33|High-fidelity mockups: Login, Dashboard, Exam, Results|US11|Mobile UX/UI Design|22/02|24/02|3d|24h|Designer|Design(Mobile)|Hùng| | | |
|34|T1.34|Backend: UniFace face matching API – so sánh ảnh chụp vs ảnh thẻ (threshold ≥ 65%)|US04|Eye Blink Liveness Detection|23/02|24/02|2d|16h|AI Dev|BE+AI Integration(Mobile)|Trường|v| | |
|35|T1.35|Frontend: AI Grading Results Display – NLI feedback, confidence %, similarity breakdown|US05|AI NLP/NLI Integration|23/02|24/02|2d|16h|Frontend|FE+Design(Web)|Trường|v| | |
|36|T1.36|Test ML feedback loop: correction → retrain → accuracy check|US06|Machine Learning Enhancement|25/02|26/02|2d|16h|AI Dev|SM+BE+AI Dev(Web), BE+AI Integration(Mobile)|Trường|v| | |
|37|T1.37|Frontend: Audio recording component (3-5s)|US04|Voice Verification AI|25/02|26/02|2d|16h|Frontend|FE+Design(Web)|Quý| | | |
|38|T1.38|Design system: colors, typography, component library|US11|Mobile UX/UI Design|25/02|25/02|1d|8h|Designer|Design(Mobile)|Quý| | | |
|39|T1.39|Frontend: Instructor Correction UI – sửa điểm AI → feedback ML system|US06|Machine Learning Enhancement|25/02|26/02|2d|16h|Frontend|FE+Design(Web)|Trường|v| | |
|40|T1.40|Flutter project setup: flutter create, folder structure|US12|Mobile UX/UI Design|26/02|26/02|1d|8h|Mobile Dev|FE(Mobile)|T,Bảo| | | |
|41|T1.41|Upload file Question to Word, PDF|—|Other|26/02|26/02|1d|6h|Frontend|FE+Design(Web)|Trường|v| | |
|42|T1.42|Benchmark AI accuracy & fine-tune model (target ≥ 90%)|US03|AI NLP/NLI Integration|27/02|28/02|2d|16h|AI Dev|SM+BE+AI Dev(Web)|Trường|v| | |
|43|T1.43|Cấu hình state management (Riverpod/Bloc), dependencies|US12|Mobile UX/UI Design|27/02|27/02|1d|8h|Mobile Dev|FE(Mobile)|T,Bảo| | | |
|44|T1.44|Setup CI/CD for mobile builds (iOS/Android)|US12|Mobile UX/UI Design|28/02|28/02|1d|8h|Mobile Dev|FE(Mobile)|T,Bảo| | | |
|45|T1.45|Testing & Fix Bug Sprint 1|—|Scrum Ceremony|27/02|28/02|2d|16h|All|All|All| | | |
|46|T1.46|Sprint 1 Review Meeting|—|Scrum Ceremony|01/03|01/03|0.5d|3h|Scrum Master|SM+BE+AI Dev(Web) (lead) + All|All| | | |
|47|T1.47|Sprint 1 Retrospective|—|Scrum Ceremony|01/03|01/03|0.5d|3h|All|All|All| | | |
|Sprint 1 Totals: 47 tasks "| 11 US "| 644 giờ| | | | | | | | | | | | | | |
|Sprint 2 (02/03 - 29/03) - AI Proctoring & Mobile App Core| | | | | | | | | | | | | | |
|#|ID|Task Name|US|Khối|Start|Finish|Effort|Giờ|Role|Assignee|Name| | | |
|1|T2.1|Sprint 2 Planning Meeting|—|Scrum Ceremony|02/03|02/03|0.5d|3h|Scrum Master|SM+BE+AI Dev(Web)| | | | |
|2|T2.2|Create Sprint 2 Backlog|—|Scrum Ceremony|02/03|02/03|0.5d|3h|Scrum Master|SM+BE+AI Dev(Web)| | | | |
|3|T2.3|Create Test Plan document for Sprint 2|—|Scrum Ceremony|03/03|03/03|0.5d|3h|QA|Design(Mobile)| | | | |
|4|T2.4|Create Database document for Sprint 2|—|Scrum Ceremony|03/03|03/03|0.5d|3h|Backend|BE+AI Integration(Mobile)| | | | |
|5|T2.5|Tạo Auth screens UI (Login/Register) trên Flutter|US17|Flutter App Setup & Auth|04/03|06/03|3d|24h|Mobile Dev|FE(Mobile)|Quý| | | |
|6|T2.6|API integration: Login/Register với backend|US17|Flutter App Setup & Auth|07/03|08/03|2d|16h|Mobile Dev|FE(Mobile)|T,Bảo| | | |
|7|T2.7|Setup Dio HTTP client với interceptors (token refresh)|US19|API Integration & Offline Cache|09/03|10/03|2d|16h|Mobile Dev|FE(Mobile)|T,Bảo| | | |
|8|T2.8|Implement JWT secure storage (flutter_secure_storage)|US17|Flutter App Setup & Auth|09/03|09/03|1d|8h|Mobile Dev|FE(Mobile)|Quý| | | |
|9|T2.9|Implement Remember Me & Auto-login|US17|Flutter App Setup & Auth|10/03|10/03|1d|8h|Mobile Dev|FE(Mobile)|T,Bảo| | | |
|10|T2.10|Implement API service classes (Auth, Exam, Submission)|US19|API Integration & Offline Cache|11/03|13/03|3d|24h|Mobile Dev|FE(Mobile)|T,Bảo| | | |
|11|T2.11|Implement biometric auth (fingerprint/faceID)|US17|Flutter App Setup & Auth|11/03|12/03|2d|16h|Mobile Dev|FE(Mobile)|Hùng| | | |
|12|T2.12|Exam list screen với room code entry|US18|Mobile Exam Taking|12/03|13/03|2d|16h|Mobile Dev|FE(Mobile)|Hùng| | | |
|13|T2.13|Test auth flow trên iOS & Android|US17|Flutter App Setup & Auth|13/03|14/03|2d|16h|QA|Design(Mobile)|Quý| | | |
|14|T2.14|Take Exam screen: MCQ (radio/checkbox, navigation)|US18|Mobile Exam Taking|14/03|16/03|3d|24h|Mobile Dev|FE(Mobile)|T,Bảo| | | |
|15|T2.15|Error handling với retry logic|US19|API Integration & Offline Cache|14/03|15/03|2d|16h|Mobile Dev|FE(Mobile)|T,Bảo| | | |
|16|T2.16|Offline caching layer (Hive/SQLite)|US19|API Integration & Offline Cache|16/03|18/03|3d|24h|Mobile Dev|FE(Mobile)|T,Bảo| | | |
|17|T2.17|Tạo behavior_detection.py – AI behavior model|US14|AI Behavior Detection|16/03|18/03|3d|24h|AI Dev|SM+BE+AI Dev(Web)|Trường| | | |
|18|T2.18|Take Exam screen: Essay (text input, word count)|US18|Mobile Exam Taking|17/03|18/03|2d|16h|Mobile Dev|FE(Mobile)|T,Bảo| | | |
|19|T2.19|Timer component synced với server|US18|Mobile Exam Taking|19/03|20/03|2d|16h|Mobile Dev|FE(Mobile)|T,Bảo| | | |
|20|T2.20|Socket.IO integration cho real-time events|US19|API Integration & Offline Cache|19/03|21/03|3d|24h|Mobile Dev|FE(Mobile), BE+AI Integration(Mobile)|T,Bảo| | | |
|21|T2.21|Browser event listeners: tab switch, blur, copy/paste|US13|AI Behavior Detection|19/03|20/03|2d|16h|Frontend|FE+Design(Web)|Trường| | | |
|22|T2.22|Integrate Screen Capture API (getDisplayMedia)|US15|Auto Screen Recording|20/03|21/03|2d|16h|Frontend|FE+Design(Web)|Bảo| | | |
|23|T2.23|Auto-save implementation (local cache + API sync)|US18|Mobile Exam Taking|21/03|22/03|2d|16h|Mobile Dev|FE(Mobile)|T,Bảo| | | |
|24|T2.24|AI behavior classification (pattern analysis)|US14|AI Behavior Detection|21/03|23/03|3d|24h|AI Dev|SM+BE+AI Dev(Web)|Trường| | | |
|25|T2.25|Mobile: Push notification integration (Firebase/APNs)|US19|API Integration & Offline Cache|22/03|22/03|1d|8h|Mobile Dev|FE(Mobile)|T,Bảo| | | |
|26|T2.26|MediaRecorder implementation: start/stop recording|US15|Auto Screen Recording|22/03|23/03|2d|16h|Frontend|FE+Design(Web)|Trường| | | |
|27|T2.27|Submit flow: confirmation dialog, loading, result|US18|Mobile Exam Taking|23/03|23/03|1d|8h|Mobile Dev|FE(Mobile)|T,Bảo| | | |
|28|T2.28|Test API sync & offline scenarios|US19|API Integration & Offline Cache|23/03|24/03|2d|16h|QA|Design(Mobile)|T,Bảo| | | |
|29|T2.29|Results display screen (MCQ + Essay)|US18|Mobile Exam Taking|24/03|24/03|1d|8h|Mobile Dev|FE(Mobile)|Quý| | | |
|30|T2.30|Real-time processing pipeline (event → classify → action)|US13|AI Behavior Detection|24/03|25/03|2d|16h|Backend|BE+AI Integration(Mobile)|Trường| | | |
|31|T2.31|Video chunking & upload service (720p minimum)|US15|Auto Screen Recording|24/03|25/03|2d|16h|Backend|BE+AI Integration(Mobile)|Trường| | | |
|32|T2.32|Mobile: Student dashboard screen (exam history, scores)|US18|Mobile Exam Taking|25/03|25/03|1d|8h|Mobile Dev|FE(Mobile)|Quý| | | |
|33|T2.33|Socket.IO event: broadcast cheating alert to instructor|US16|Real-time Notification|25/03|25/03|1d|8h|Backend|BE+AI Integration(Mobile)|T,Bảo| | | |
|34|T2.34|Test detection latency (< 500ms) & false positive (< 5%)|US14|AI Behavior Detection|26/03|26/03|1d|8h|QA|Design(Mobile)|Hùng| | | |
|35|T2.35|Database: bảng video_evidence / mở rộng cheating_logs|US15|Auto Screen Recording|26/03|26/03|1d|8h|Backend|BE+AI Integration(Mobile)|Trường| | | |
|36|T2.36|Notification UI component (student name, type, timestamp)|US16|Real-time Notification|26/03|26/03|1d|8h|Frontend|FE+Design(Web)|Bảo| | | |
|37|T2.37|Test: E2E proctoring flow (detect → record → notify)|US13|AI Behavior Detection|27/03|27/03|1d|8h|QA|Design(Mobile)|Bảo| | | |
|38|T2.38|Test recording trigger (< 1s delay from detection)|US15|Auto Screen Recording|27/03|27/03|1d|8h|QA|Design(Mobile)|Quý| | | |
|39|T2.39|Video player integration (link to evidence)|US16|Real-time Notification|27/03|27/03|1d|8h|Frontend|FE+Design(Web)|Bảo| | | |
|40|T2.40|Instructor dashboard: cheating summary panel|US16|Real-time Notification|28/03|28/03|1d|8h|Frontend|FE+Design(Web)|Bảo| | | |
|41|T2.41|Testing & Fix Bug Sprint 2|—|Scrum Ceremony|27/03|28/03|2d|16h|All|All| | | | |
|42|T2.42|Sprint 2 Review Meeting|—|Scrum Ceremony|29/03|29/03|0.5d|3h|Scrum Master|SM+BE+AI Dev(Web) (lead) + All| | | | |
|43|T2.43|Sprint 2 Retrospective|—|Scrum Ceremony|29/03|29/03|0.5d|3h|All|All| | | | |
|Sprint 2 Totals: 44 tasks "| 7 US "| 554 giờ| | | | | | | | | | | | | | |
|Sprint 3 (30/03 - 19/04) - Integration & Cross-Platform| | | | | | | | | | | | | | |
|#|ID|Task Name|US|Khối|Start|Finish|Effort|Giờ|Role|Assignee|Name| | | |
|1|T3.1|Sprint 3 Planning Meeting|—|Scrum Ceremony|30/03|30/03|0.5d|3h|Scrum Master|SM+BE+AI Dev(Web)| | | | |
|2|T3.2|Create Sprint 3 Backlog|—|Scrum Ceremony|30/03|30/03|0.5d|3h|Scrum Master|SM+BE+AI Dev(Web)| | | | |
|3|T3.3|Create Test Plan document for Sprint 3|—|Scrum Ceremony|31/03|31/03|0.5d|3h|QA|Design(Mobile)| | | | |
|4|T3.4|Create Database document for Sprint 3|—|Scrum Ceremony|31/03|31/03|0.5d|3h|Backend|BE+AI Integration(Mobile)| | | | |
|5|T3.5|API response standardization cho Web + Mobile|US01|Backend API Optimization|01/04|02/04|2d|16h|Backend|SM+BE+AI Dev(Web)|Trường| | | |
|6|T3.6|Mobile: MSSV entry form screen|US21|Mobile Biometric Integration|02/04|02/04|1d|8h|Mobile Dev|FE(Mobile)|T.bảo| | | |
|7|T3.7|Mobile: Camera package integration (image_picker/camera)|US21|Mobile Biometric Integration|03/04|04/04|2d|16h|Mobile Dev|FE(Mobile)|T.bảo| | | |
|8|T3.8|AI Grading Monitoring & Control Center|US01|AI NLP/NLI Integration|03/04|05/04|2d|24h|AI Dev|SM+BE+AI Dev(Web)|Trường| | | |
|9|T3.9|Database query optimization (indexes, slow query audit)|US02|Backend API Optimization|03/04|04/04|2d|16h|Backend|BE+AI Integration(Mobile)|Quý| | | |
|10|T3.10|Mobile: Face capture & detection (face detection plugin)|US21|Mobile Biometric Integration|05/04|07/04|3d|24h|Mobile Dev|FE(Mobile)|T.bảo| | | |
|11|T3.11|Connection pooling & rate limiting configuration|US01|Backend API Optimization|06/04|07/04|1d|8h|Backend|BE+AI Integration(Mobile)|Trường| | | |
|12|T3.12|Verify AI service handles mobile submissions|US20|AI Grading for Mobile|06/04|07/04|2d|16h|AI Dev|SM+BE+AI Dev(Web)|Trường| | | |
|13|T3.13|API caching layer (Redis/in-memory)|US02|Backend API Optimization|06/04|06/04|1d|8h|Backend|SM+BE+AI Dev(Web)|Trường| | | |
|14|T3.14|Chuẩn hóa error codes & response format|US01|Backend API Optimization|07/04|07/04|1d|8h|Backend|SM+BE+AI Dev(Web)|Trường| | | |
|15|T3.15|Load test API (300 concurrent users)|US02|Backend API Optimization|08/04|08/04|1d|8h|QA|Design(Mobile)|Quý| | | |
|16|T3.16|Mobile: Eye blink detection (native/webview)|US21|Mobile Biometric Integration|08/04|09/04|2d|16h|Mobile Dev|FE(Mobile)|Quý| | | |
|17|T3.17|Add device_type field tracking (web/ios/android)|US20|AI Grading for Mobile|08/04|08/04|1d|8h|Backend|BE+AI Integration(Mobile)| | | | |
|18|T3.18|Mobile: Results display component (AI feedback)|US20|AI Grading for Mobile|09/04|10/04|2d|16h|Mobile Dev|FE(Mobile)|T.bảo| | | |
|19|T3.19|Mobile: Grading progress indicator (real-time status)|US20|AI Grading for Mobile|11/04|12/04|2d|16h|Mobile Dev|FE(Mobile)|Hùng| | | |
|20|T3.20|Mobile: Verification flow screens (step-by-step wizard)|US21|Mobile Biometric Integration|12/04|13/04|2d|16h|Mobile Dev|FE(Mobile)|Hùng| | | |
|21|T3.21|Screen: Take Exam (Flutter)|US18|Mobile Exam Taking|13/04|15/04|3d|24h|Mobile Dev|FE(Mobile)|T.bảo| | | |
|22|T3.22|E2E test: Mobile submit → AI grade → result display|US20|AI Grading for Mobile|13/04|14/04|2d|16h|QA|Design(Mobile)|Quý| | | |
|23|T3.23|Web: Regression test chức năng + AI + Biometric|US20|Cross-Platform Testing|13/04|14/04|2d|16h|QA|FE+Design(Web)|Trường| | | |
|24|T3.24|Real-time Proctoring & Live Exam Intervention System(MB)|US23|Mobile AI Proctoring|14/04|17/04|2d|24h|Frontend|FE+Design(MB)|Bảo| | | |
|25|T3.25|Test biometric flow trên iOS & Android|US21|Mobile Biometric Integration|14/04|14/04|1d|8h|QA|Design(Mobile)|Bảo| | | |
|26|T3.26|Center Monitoring Control cho Giảng viên|US16|Real-time Notification|15/04|17/04|3d|20h|Mobile Dev|Design(Mobile)|Hùng| | | |
|27|T3.27|Mobile: Test trên iOS simulator + real device|US20|Cross-Platform Testing|15/04|15/04|1d|8h|QA|Design(Mobile)|Hùng| | | |
|28|T3.28|Mobile: Profile screen UI – hiển thị Avatar, Name, Email, Role|US27|Mobile Profile & Logout|15/04|15/04|1d|8h|Mobile Dev|FE(Mobile)|Hùng| | | |
|29|T3.29|Mobile: Test trên Android emulator + real device|US21|Cross-Platform Testing|16/04|16/04|1d|8h|QA|Design(Mobile)|Bảo| | | |
|30|T3.30|Mobile: Logout logic – xoá token, clear state, redirect Login, block Back button|US27|Mobile Profile & Logout|16/04|16/04|1d|8h|Mobile Dev|FE(Mobile)|Quý| | | |
|31|T3.31|Cross-platform: Verify consistent behavior Web ↔ Mobile|US21|Cross-Platform Testing|17/04|17/04|1d|8h|QA|FE+Design(Web)|Bảo| | | |
|32|T3.32|Testing & Fix Bug Sprint 3|—|Scrum Ceremony|17/04|18/04|2d|16h|All|All| | | | |
|33|T3.33|Sprint 3 Review Meeting|—|Scrum Ceremony|19/04|19/04|0.5d|3h|Scrum Master|SM+BE+AI Dev(Web) (lead) + All| | | | |
|34|T3.34|Sprint 3 Retrospective|—|Scrum Ceremony|19/04|19/04|0.5d|3h|All|All| | | | |
|Sprint 3 Totals: 32 tasks "| 5 US "| 406 giờ| | | | | | | | | | | | | | |
|Sprint 4 (20/04 - 10/05) - Polish, Security & Release| | | | | | | | | | | | | | |
|#|ID|Task Name|US|Khối|Start|Finish|Effort|Giờ|Role|Assignee|Name| | | |
|1|T4.1|Sprint 4 Planning Meeting|—|Scrum Ceremony|20/04|20/04|0.5d|3h|Scrum Master|SM+BE+AI Dev(Web)| | | | |
|2|T4.2|Create Sprint 4 Backlog|—|Scrum Ceremony|20/04|20/04|0.5d|3h|Scrum Master|SM+BE+AI Dev(Web)| | | | |
|3|T4.3|Create Test Plan document for Sprint 4|—|Scrum Ceremony|21/04|21/04|0.5d|3h|QA|Design(Mobile)| | | | |
|4|T4.4|Create Database document for Sprint 4|—|Scrum Ceremony|21/04|21/04|0.5d|3h|Backend|BE+AI Integration(Mobile)| | | | |
|5|T4.5|Model Behavior Detection|US23|Mobile AI Proctoring|22/04|24/04|3d|24h|Mobile Dev|FE(Mobile)|Quý| | | |
|6|T4.6|Platform channel: Native monitoring service (iOS/Android)|US23|Mobile AI Proctoring|22/04|24/04|3d|24h|Mobile Dev|FE(Mobile)|T.bảo| | | |
|7|T4.7|App switching detection (WidgetsBindingObserver)|US23|Mobile AI Proctoring|25/04|26/04|2d|16h|Mobile Dev|FE(Mobile)|Hùng| | | |
|8|T4.8|Frontend: Code splitting & lazy loading|US24|Performance Optimization|27/04|28/04|2d|16h|Frontend|FE+Design(Web)|Bảo| | | |
|9|T4.9|Split screen / multi-window detection|US23|Mobile AI Proctoring|27/04|28/04|2d|16h|Mobile Dev|FE(Mobile)| | | | |
|10|T4.10|Backend: API caching & database query optimization|US24|Performance Optimization|29/04|30/04|2d|16h|Backend|BE+AI Integration(Mobile)| | | | |
|11|T4.11|Native screen recording on violation|US23|Mobile AI Proctoring|29/04|30/04|2d|16h|Mobile Dev|FE(Mobile)| | | | |
|12|T4.12|Frontend: Image optimization & CDN configuration|US24|Performance Optimization|01/05|01/05|1d|8h|Frontend|FE+Design(Web)|Trường| | | |
|13|T4.13|SQL injection audit: convert raw queries → parameterized|US22|Security Enhancement|01/05|02/05|2d|16h|Backend|SM+BE+AI Dev(Web)|Trường| | | |
|14|T4.14|Video upload service với progress indicator|US23|Mobile AI Proctoring|01/05|01/05|1d|8h|Mobile Dev|FE(Mobile)| | | | |
|15|T4.15|Mobile: Widget tree optimization, lazy loading|US24|Performance Optimization|02/05|02/05|1d|8h|Mobile Dev|FE(Mobile)| | | | |
|16|T4.16|Mobile: Silent screenshot capture service – chụp ảnh mỗi 3s khi detect gian lận|US28|Mobile Silent Capture|02/05|03/05|2d|16h|Mobile Dev|FE(Mobile)| | | | |
|17|T4.17|Benchmark: FCP < 1.5s, TTI < 3s, API P95 < 500ms|US24|Performance Optimization|03/05|03/05|1d|8h|QA|Design(Mobile)| | | | |
|18|T4.18|Implement refresh token rotation|US25|Security Enhancement|03/05|03/05|1d|8h|Backend|BE+AI Integration(Mobile)| | | | |
|19|T4.19|Device fingerprinting implementation|US25|Security Enhancement|04/05|04/05|1d|8h|Backend|BE+AI Integration(Mobile)| | | | |
|20|T4.20|Mobile: Silent capture upload to AI endpoint + đính kèm evidence|US28|Mobile Silent Capture|04/05|05/05|2d|16h|Mobile Dev|FE(Mobile), BE+AI Integration(Mobile)| | | | |
|21|T4.21|Optional 2FA for instructors/admins|US25|Security Enhancement|05/05|05/05|1d|8h|Backend|SM+BE+AI Dev(Web)|Trường| | | |
|22|T4.22|Health check endpoints & process management|US26|Final Testing & Bug Fixes|05/05|05/05|1d|8h|Backend|BE+AI Integration(Mobile)| | | | |
|23|T4.23|Security headers & WAF rules (Cloudflare)|US22|Security Enhancement|06/05|06/05|1d|8h|Backend|SM+BE+AI Dev(Web)|Trường| | | |
|24|T4.24|Input validation & XSS prevention audit|US22|Security Enhancement|06/05|06/05|1d|8h|Backend|SM+BE+AI Dev(Web)|Trường| | | |
|25|T4.25|Error monitoring setup (Sentry/logging)|US26|Final Testing & Bug Fixes|06/05|06/05|1d|8h|Backend|BE+AI Integration(Mobile)| | | | |
|26|T4.26|OWASP Top 10 audit & penetration testing|US25|Security Enhancement|07/05|07/05|1d|8h|QA|Design(Mobile)| | | | |
|27|T4.27|Database connection pooling & graceful degradation|US26|Final Testing & Bug Fixes|07/05|07/05|1d|8h|Backend|BE+AI Integration(Mobile)| | | | |
|28|T4.28|Load balancing config & auto-restart setup|US26|Final Testing & Bug Fixes|07/05|07/05|1d|8h|DevOps|SM+BE+AI Dev(Web)|Trường| | | |
|29|T4.29|Full regression test (Web + Mobile)|US26|Final Testing & Bug Fixes|08/05|08/05|1d|8h|QA|Design(Mobile), FE+Design(Web)| | | | |
|30|T4.30|Production deployment (Web + Backend + AI Services)|US26|Release v3.0|10/05|10/05|0.5d|4h|DevOps|SM+BE+AI Dev(Web)| | | | |
|31|T4.31|Mobile app build & publish (APK/IPA)|US23|Release v3.0|10/05|10/05|0.5d|4h|Mobile Dev|FE(Mobile)| | | | |
|32|T4.32|Final documentation update & project close|US26|Release v3.0|10/05|10/05|0.5d|4h|All|All| | | | |
|33|T4.33|Testing & Fix Bug Sprint 4|—|Scrum Ceremony|08/05|09/05|2d|16h|All|All| | | | |
|34|T4.34|Sprint 4 Review Meeting|—|Scrum Ceremony|10/05|10/05|0.5d|3h|Scrum Master|SM+BE+AI Dev(Web) (lead) + All| | | | |
|35|T4.35|Sprint 4 Retrospective|—|Scrum Ceremony|10/05|10/05|0.5d|3h|All|All| | | | |
|Sprint 4 Totals: 34 tasks "| 6 US "| 342 giờ| | | | | | | | | | | | | | |
| | | | | | | | | | | | | | | |
|TỔNG KẾT| | | | | | | | | | | | | | |
|Sprint|Thời gian|Số US|Số Task|Tổng Giờ| | | | | | | | | | |
|Sprint 1|04/02 - 01/03|11|47|644| | | | | | | | | | |
|Sprint 2|02/03 - 29/03|7|44|554| | | | | | | | | | |
|Sprint 3|30/03 - 19/04|5|31|330| | | | | | | | | | |
|Sprint 4|20/04 - 10/05|6|34|318| | | | | | | | | | |
|TOTAL|14 weeks|28|156|1846| | | | | | | | | | |
| | | | | | | | | | | | | | | |
| | | | | | | | | | | | | | | |
|WORKLOAD THEO THÀNH VIÊN| | | | | | | | | | | | | | |
|TV|Name|Vai trò| | | | | | | | | | | | |
|TV1|Trường|SM+BE+AI Dev(Web)| | | | | | | | | | | | |
|TV2|Bảo|FE+Design(Web)| | | | | | | | | | | | |
|TV3|Quý|Design(Mobile) + FE| | | | | | | | | | | | |
|TV4|T.Bảo|BE(Mobile), AI Integration(Mobile)| | | | | | | | | | | | |
|TV5|Hùng|Design(Mobile) + FE| | | | | | | | | | | | |
| | | | | | | | | | | | | | | |
| | | | | | | | | | | | | | | |
|CHI PHÍ DỰ ÁN| | | | | | | | | | | | | | |
|Hạng mục|Công thức|Kết quả| | | | | | | | | | | | |
|Working Hours|5 × 8 × 96 ngày|3,840 giờ| | | | | | | | | | | | |
|Labor Cost|3,840 × $2/giờ|$7,680| | | | | | | | | | | | |
|Other Cost|5 × $100|$500| | | | | | | | | | | | |
|Total| |$8,180 USD| | | | | | | | | | | | |
