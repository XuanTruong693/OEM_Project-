-- ============================================================================
-- 🌱 OEM Mini Seed Data - REALISTIC FLUCTUATION + NAME-BASED EMAILS
-- User ID 1 = Instructor owns all exams
-- ============================================================================

USE oem_mini;

SET SQL_SAFE_UPDATES = 0;
SET FOREIGN_KEY_CHECKS = 0;

-- ============================================================================
-- 🧹 CLEAR ALL SEED DATA
-- ============================================================================

DELETE FROM student_answers WHERE submission_id IN (
    SELECT id FROM submissions WHERE exam_id IN (
        SELECT id FROM exams WHERE title LIKE '% - Kỳ thi T%'
    )
);

DELETE FROM cheating_logs WHERE submission_id IN (
    SELECT id FROM submissions WHERE exam_id IN (
        SELECT id FROM exams WHERE title LIKE '% - Kỳ thi T%'
    )
);

DELETE FROM results WHERE exam_id IN (
    SELECT id FROM exams WHERE title LIKE '% - Kỳ thi T%'
);

DELETE FROM submissions WHERE exam_id IN (
    SELECT id FROM exams WHERE title LIKE '% - Kỳ thi T%'
);

DELETE FROM user_verified_rooms WHERE exam_room_code IN (
    SELECT exam_room_code FROM exams WHERE title LIKE '% - Kỳ thi T%'
);

DELETE FROM exam_options WHERE question_id IN (
    SELECT id FROM exam_questions WHERE exam_id IN (
        SELECT id FROM exams WHERE title LIKE '% - Kỳ thi T%'
    )
);

DELETE FROM exam_questions WHERE exam_id IN (
    SELECT id FROM exams WHERE title LIKE '% - Kỳ thi T%'
);

DELETE FROM exams WHERE title LIKE '% - Kỳ thi T%';

DELETE FROM users WHERE email LIKE '%@dtu.edu.vn' AND id > 1;

SELECT 'Cleared seed data' AS status;

-- ============================================================================
-- 1️⃣ CREATE STUDENTS WITH REAL NAME-BASED EMAILS
-- T1:8, T2:3, T3:10, T4:4, T5:12, T6:2, T7:1, T8:6, T9:15, T10:7, T11:4, T12:8 = 80 total
-- Email format: lastnamefirstname + number @dtu.edu.vn
-- ============================================================================

-- January (T1) - 8 students
INSERT INTO users (full_name, email, password_hash, gender, role, created_at) VALUES
('Nguyễn Văn An', 'nguyenvanan1@dtu.edu.vn', '$2b$10$rGT6sQxF1CdLeV1kU3CuieWL/QI6FZfyhgYkGMbxQSoO6KJxPFP4W', 'male', 'student', '2025-01-03 09:00:00'),
('Trần Thị Hương', 'tranthihuong2@dtu.edu.vn', '$2b$10$rGT6sQxF1CdLeV1kU3CuieWL/QI6FZfyhgYkGMbxQSoO6KJxPFP4W', 'female', 'student', '2025-01-05 09:00:00'),
('Lê Văn Minh', 'levanminh3@dtu.edu.vn', '$2b$10$rGT6sQxF1CdLeV1kU3CuieWL/QI6FZfyhgYkGMbxQSoO6KJxPFP4W', 'male', 'student', '2025-01-08 09:00:00'),
('Phạm Thị Lan', 'phamthilan4@dtu.edu.vn', '$2b$10$rGT6sQxF1CdLeV1kU3CuieWL/QI6FZfyhgYkGMbxQSoO6KJxPFP4W', 'female', 'student', '2025-01-12 09:00:00'),
('Hoàng Văn Đức', 'hoangvanduc5@dtu.edu.vn', '$2b$10$rGT6sQxF1CdLeV1kU3CuieWL/QI6FZfyhgYkGMbxQSoO6KJxPFP4W', 'male', 'student', '2025-01-15 09:00:00'),
('Vũ Thị Mai', 'vuthimai6@dtu.edu.vn', '$2b$10$rGT6sQxF1CdLeV1kU3CuieWL/QI6FZfyhgYkGMbxQSoO6KJxPFP4W', 'female', 'student', '2025-01-18 09:00:00'),
('Đặng Văn Hùng', 'dangvanhung7@dtu.edu.vn', '$2b$10$rGT6sQxF1CdLeV1kU3CuieWL/QI6FZfyhgYkGMbxQSoO6KJxPFP4W', 'male', 'student', '2025-01-22 09:00:00'),
('Bùi Thị Ngọc', 'buithingoc8@dtu.edu.vn', '$2b$10$rGT6sQxF1CdLeV1kU3CuieWL/QI6FZfyhgYkGMbxQSoO6KJxPFP4W', 'female', 'student', '2025-01-25 09:00:00'),

-- February (T2) - 3 students
('Võ Văn Long', 'vovanlong9@dtu.edu.vn', '$2b$10$rGT6sQxF1CdLeV1kU3CuieWL/QI6FZfyhgYkGMbxQSoO6KJxPFP4W', 'male', 'student', '2025-02-10 09:00:00'),
('Đỗ Thị Linh', 'dothilinh10@dtu.edu.vn', '$2b$10$rGT6sQxF1CdLeV1kU3CuieWL/QI6FZfyhgYkGMbxQSoO6KJxPFP4W', 'female', 'student', '2025-02-15 09:00:00'),
('Ngô Văn Khoa', 'ngovankhoa11@dtu.edu.vn', '$2b$10$rGT6sQxF1CdLeV1kU3CuieWL/QI6FZfyhgYkGMbxQSoO6KJxPFP4W', 'male', 'student', '2025-02-25 09:00:00'),

-- March (T3) - 10 students
('Phan Thị Thảo', 'phanthithao12@dtu.edu.vn', '$2b$10$rGT6sQxF1CdLeV1kU3CuieWL/QI6FZfyhgYkGMbxQSoO6KJxPFP4W', 'female', 'student', '2025-03-02 09:00:00'),
('Đinh Văn Phong', 'dinhvanphong13@dtu.edu.vn', '$2b$10$rGT6sQxF1CdLeV1kU3CuieWL/QI6FZfyhgYkGMbxQSoO6KJxPFP4W', 'male', 'student', '2025-03-05 09:00:00'),
('Lý Thị Hà', 'lythiha14@dtu.edu.vn', '$2b$10$rGT6sQxF1CdLeV1kU3CuieWL/QI6FZfyhgYkGMbxQSoO6KJxPFP4W', 'female', 'student', '2025-03-08 09:00:00'),
('Mai Văn Thành', 'maivanthanh15@dtu.edu.vn', '$2b$10$rGT6sQxF1CdLeV1kU3CuieWL/QI6FZfyhgYkGMbxQSoO6KJxPFP4W', 'male', 'student', '2025-03-11 09:00:00'),
('Cao Thị Vy', 'caothivy16@dtu.edu.vn', '$2b$10$rGT6sQxF1CdLeV1kU3CuieWL/QI6FZfyhgYkGMbxQSoO6KJxPFP4W', 'female', 'student', '2025-03-14 09:00:00'),
('Thái Văn Kiên', 'thaivankien17@dtu.edu.vn', '$2b$10$rGT6sQxF1CdLeV1kU3CuieWL/QI6FZfyhgYkGMbxQSoO6KJxPFP4W', 'male', 'student', '2025-03-17 09:00:00'),
('Quách Thị Yến', 'quachthiyen18@dtu.edu.vn', '$2b$10$rGT6sQxF1CdLeV1kU3CuieWL/QI6FZfyhgYkGMbxQSoO6KJxPFP4W', 'female', 'student', '2025-03-20 09:00:00'),
('Lâm Văn Trí', 'lamvantri19@dtu.edu.vn', '$2b$10$rGT6sQxF1CdLeV1kU3CuieWL/QI6FZfyhgYkGMbxQSoO6KJxPFP4W', 'male', 'student', '2025-03-23 09:00:00'),
('Kiều Thị Diễm', 'kieuthidiem20@dtu.edu.vn', '$2b$10$rGT6sQxF1CdLeV1kU3CuieWL/QI6FZfyhgYkGMbxQSoO6KJxPFP4W', 'female', 'student', '2025-03-26 09:00:00'),
('Trịnh Văn Huy', 'trinhvanhuy21@dtu.edu.vn', '$2b$10$rGT6sQxF1CdLeV1kU3CuieWL/QI6FZfyhgYkGMbxQSoO6KJxPFP4W', 'male', 'student', '2025-03-29 09:00:00'),

-- April (T4) - 4 students
('Tô Thị Hằng', 'tothihang22@dtu.edu.vn', '$2b$10$rGT6sQxF1CdLeV1kU3CuieWL/QI6FZfyhgYkGMbxQSoO6KJxPFP4W', 'female', 'student', '2025-04-05 09:00:00'),
('Hà Văn Tùng', 'havantung23@dtu.edu.vn', '$2b$10$rGT6sQxF1CdLeV1kU3CuieWL/QI6FZfyhgYkGMbxQSoO6KJxPFP4W', 'male', 'student', '2025-04-12 09:00:00'),
('Dương Thị Uyên', 'duongthiuyen24@dtu.edu.vn', '$2b$10$rGT6sQxF1CdLeV1kU3CuieWL/QI6FZfyhgYkGMbxQSoO6KJxPFP4W', 'female', 'student', '2025-04-19 09:00:00'),
('Lương Văn Sơn', 'luongvanson25@dtu.edu.vn', '$2b$10$rGT6sQxF1CdLeV1kU3CuieWL/QI6FZfyhgYkGMbxQSoO6KJxPFP4W', 'male', 'student', '2025-04-26 09:00:00'),

-- May (T5) - 12 students
('Tạ Thị Nhung', 'tathinhung26@dtu.edu.vn', '$2b$10$rGT6sQxF1CdLeV1kU3CuieWL/QI6FZfyhgYkGMbxQSoO6KJxPFP4W', 'female', 'student', '2025-05-02 09:00:00'),
('Châu Văn Bình', 'chauvanbinh27@dtu.edu.vn', '$2b$10$rGT6sQxF1CdLeV1kU3CuieWL/QI6FZfyhgYkGMbxQSoO6KJxPFP4W', 'male', 'student', '2025-05-04 09:00:00'),
('Từ Thị Nga', 'tuthinga28@dtu.edu.vn', '$2b$10$rGT6sQxF1CdLeV1kU3CuieWL/QI6FZfyhgYkGMbxQSoO6KJxPFP4W', 'female', 'student', '2025-05-06 09:00:00'),
('Huỳnh Văn Phúc', 'huynhvanphuc29@dtu.edu.vn', '$2b$10$rGT6sQxF1CdLeV1kU3CuieWL/QI6FZfyhgYkGMbxQSoO6KJxPFP4W', 'male', 'student', '2025-05-08 09:00:00'),
('Nguyễn Thị Quỳnh', 'nguyenthiquynh30@dtu.edu.vn', '$2b$10$rGT6sQxF1CdLeV1kU3CuieWL/QI6FZfyhgYkGMbxQSoO6KJxPFP4W', 'female', 'student', '2025-05-10 09:00:00'),
('Trần Văn Cường', 'tranvancuong31@dtu.edu.vn', '$2b$10$rGT6sQxF1CdLeV1kU3CuieWL/QI6FZfyhgYkGMbxQSoO6KJxPFP4W', 'male', 'student', '2025-05-12 09:00:00'),
('Lê Thị Hoa', 'lethihoa32@dtu.edu.vn', '$2b$10$rGT6sQxF1CdLeV1kU3CuieWL/QI6FZfyhgYkGMbxQSoO6KJxPFP4W', 'female', 'student', '2025-05-14 09:00:00'),
('Phạm Văn Dũng', 'phamvandung33@dtu.edu.vn', '$2b$10$rGT6sQxF1CdLeV1kU3CuieWL/QI6FZfyhgYkGMbxQSoO6KJxPFP4W', 'male', 'student', '2025-05-18 09:00:00'),
('Hoàng Thị Thu', 'hoangthithu34@dtu.edu.vn', '$2b$10$rGT6sQxF1CdLeV1kU3CuieWL/QI6FZfyhgYkGMbxQSoO6KJxPFP4W', 'female', 'student', '2025-05-22 09:00:00'),
('Vũ Văn Tiến', 'vuvantien35@dtu.edu.vn', '$2b$10$rGT6sQxF1CdLeV1kU3CuieWL/QI6FZfyhgYkGMbxQSoO6KJxPFP4W', 'male', 'student', '2025-05-24 09:00:00'),
('Đặng Thị Xuân', 'dangthixuan36@dtu.edu.vn', '$2b$10$rGT6sQxF1CdLeV1kU3CuieWL/QI6FZfyhgYkGMbxQSoO6KJxPFP4W', 'female', 'student', '2025-05-26 09:00:00'),
('Bùi Văn Hoàng', 'buivanhoang37@dtu.edu.vn', '$2b$10$rGT6sQxF1CdLeV1kU3CuieWL/QI6FZfyhgYkGMbxQSoO6KJxPFP4W', 'male', 'student', '2025-05-28 09:00:00'),

-- June (T6) - 2 students
('Võ Thị Thanh', 'vothithanh38@dtu.edu.vn', '$2b$10$rGT6sQxF1CdLeV1kU3CuieWL/QI6FZfyhgYkGMbxQSoO6KJxPFP4W', 'female', 'student', '2025-06-10 09:00:00'),
('Đỗ Văn Việt', 'dovanviet39@dtu.edu.vn', '$2b$10$rGT6sQxF1CdLeV1kU3CuieWL/QI6FZfyhgYkGMbxQSoO6KJxPFP4W', 'male', 'student', '2025-06-20 09:00:00'),

-- July (T7) - 1 student
('Ngô Thị Kim', 'ngothikim40@dtu.edu.vn', '$2b$10$rGT6sQxF1CdLeV1kU3CuieWL/QI6FZfyhgYkGMbxQSoO6KJxPFP4W', 'female', 'student', '2025-07-15 09:00:00'),

-- August (T8) - 6 students
('Phan Văn Quang', 'phanvanquang41@dtu.edu.vn', '$2b$10$rGT6sQxF1CdLeV1kU3CuieWL/QI6FZfyhgYkGMbxQSoO6KJxPFP4W', 'male', 'student', '2025-08-05 09:00:00'),
('Đinh Thị Hồng', 'dinhthihong42@dtu.edu.vn', '$2b$10$rGT6sQxF1CdLeV1kU3CuieWL/QI6FZfyhgYkGMbxQSoO6KJxPFP4W', 'female', 'student', '2025-08-10 09:00:00'),
('Lý Văn Nam', 'lyvannam43@dtu.edu.vn', '$2b$10$rGT6sQxF1CdLeV1kU3CuieWL/QI6FZfyhgYkGMbxQSoO6KJxPFP4W', 'male', 'student', '2025-08-15 09:00:00'),
('Mai Thị Tuyết', 'maithituyet44@dtu.edu.vn', '$2b$10$rGT6sQxF1CdLeV1kU3CuieWL/QI6FZfyhgYkGMbxQSoO6KJxPFP4W', 'female', 'student', '2025-08-20 09:00:00'),
('Cao Văn Lộc', 'caovanloc45@dtu.edu.vn', '$2b$10$rGT6sQxF1CdLeV1kU3CuieWL/QI6FZfyhgYkGMbxQSoO6KJxPFP4W', 'male', 'student', '2025-08-25 09:00:00'),
('Thái Thị Vân', 'thaithivan46@dtu.edu.vn', '$2b$10$rGT6sQxF1CdLeV1kU3CuieWL/QI6FZfyhgYkGMbxQSoO6KJxPFP4W', 'female', 'student', '2025-08-28 09:00:00'),

-- September (T9) - 15 students
('Quách Văn Thắng', 'quachvanthang47@dtu.edu.vn', '$2b$10$rGT6sQxF1CdLeV1kU3CuieWL/QI6FZfyhgYkGMbxQSoO6KJxPFP4W', 'male', 'student', '2025-09-02 09:00:00'),
('Lâm Thị Bảo', 'lamthibao48@dtu.edu.vn', '$2b$10$rGT6sQxF1CdLeV1kU3CuieWL/QI6FZfyhgYkGMbxQSoO6KJxPFP4W', 'female', 'student', '2025-09-03 09:00:00'),
('Kiều Văn Anh', 'kieuvananh49@dtu.edu.vn', '$2b$10$rGT6sQxF1CdLeV1kU3CuieWL/QI6FZfyhgYkGMbxQSoO6KJxPFP4W', 'male', 'student', '2025-09-05 09:00:00'),
('Trịnh Thị Phương', 'trinhthiphuong50@dtu.edu.vn', '$2b$10$rGT6sQxF1CdLeV1kU3CuieWL/QI6FZfyhgYkGMbxQSoO6KJxPFP4W', 'female', 'student', '2025-09-07 09:00:00'),
('Tô Văn Khánh', 'tovankhanh51@dtu.edu.vn', '$2b$10$rGT6sQxF1CdLeV1kU3CuieWL/QI6FZfyhgYkGMbxQSoO6KJxPFP4W', 'male', 'student', '2025-09-09 09:00:00'),
('Hà Thị Chi', 'hathichi52@dtu.edu.vn', '$2b$10$rGT6sQxF1CdLeV1kU3CuieWL/QI6FZfyhgYkGMbxQSoO6KJxPFP4W', 'female', 'student', '2025-09-11 09:00:00'),
('Dương Văn Đạt', 'duongvandat53@dtu.edu.vn', '$2b$10$rGT6sQxF1CdLeV1kU3CuieWL/QI6FZfyhgYkGMbxQSoO6KJxPFP4W', 'male', 'student', '2025-09-13 09:00:00'),
('Lương Thị Giang', 'luongthigiang54@dtu.edu.vn', '$2b$10$rGT6sQxF1CdLeV1kU3CuieWL/QI6FZfyhgYkGMbxQSoO6KJxPFP4W', 'female', 'student', '2025-09-15 09:00:00'),
('Tạ Văn Hải', 'tavanhai55@dtu.edu.vn', '$2b$10$rGT6sQxF1CdLeV1kU3CuieWL/QI6FZfyhgYkGMbxQSoO6KJxPFP4W', 'male', 'student', '2025-09-17 09:00:00'),
('Châu Thị Liên', 'chauthilien56@dtu.edu.vn', '$2b$10$rGT6sQxF1CdLeV1kU3CuieWL/QI6FZfyhgYkGMbxQSoO6KJxPFP4W', 'female', 'student', '2025-09-19 09:00:00'),
('Từ Văn Hiếu', 'tuvanhieu57@dtu.edu.vn', '$2b$10$rGT6sQxF1CdLeV1kU3CuieWL/QI6FZfyhgYkGMbxQSoO6KJxPFP4W', 'male', 'student', '2025-09-21 09:00:00'),
('Huỳnh Thị My', 'huynthimy58@dtu.edu.vn', '$2b$10$rGT6sQxF1CdLeV1kU3CuieWL/QI6FZfyhgYkGMbxQSoO6KJxPFP4W', 'female', 'student', '2025-09-23 09:00:00'),
('Nguyễn Văn Trung', 'nguyenvantrung59@dtu.edu.vn', '$2b$10$rGT6sQxF1CdLeV1kU3CuieWL/QI6FZfyhgYkGMbxQSoO6KJxPFP4W', 'male', 'student', '2025-09-25 09:00:00'),
('Trần Thị Nhàn', 'tranthinhann60@dtu.edu.vn', '$2b$10$rGT6sQxF1CdLeV1kU3CuieWL/QI6FZfyhgYkGMbxQSoO6KJxPFP4W', 'female', 'student', '2025-09-27 09:00:00'),
('Lê Văn Tài', 'levantai61@dtu.edu.vn', '$2b$10$rGT6sQxF1CdLeV1kU3CuieWL/QI6FZfyhgYkGMbxQSoO6KJxPFP4W', 'male', 'student', '2025-09-29 09:00:00'),

-- October (T10) - 7 students
('Phạm Thị Hạnh', 'phamthihanh62@dtu.edu.vn', '$2b$10$rGT6sQxF1CdLeV1kU3CuieWL/QI6FZfyhgYkGMbxQSoO6KJxPFP4W', 'female', 'student', '2025-10-05 09:00:00'),
('Hoàng Văn Lâm', 'hoangvanlam63@dtu.edu.vn', '$2b$10$rGT6sQxF1CdLeV1kU3CuieWL/QI6FZfyhgYkGMbxQSoO6KJxPFP4W', 'male', 'student', '2025-10-10 09:00:00'),
('Vũ Thị Diệu', 'vuthidieu64@dtu.edu.vn', '$2b$10$rGT6sQxF1CdLeV1kU3CuieWL/QI6FZfyhgYkGMbxQSoO6KJxPFP4W', 'female', 'student', '2025-10-14 09:00:00'),
('Đặng Văn Toàn', 'dangvantoan65@dtu.edu.vn', '$2b$10$rGT6sQxF1CdLeV1kU3CuieWL/QI6FZfyhgYkGMbxQSoO6KJxPFP4W', 'male', 'student', '2025-10-18 09:00:00'),
('Bùi Thị Duyên', 'buithiduyen66@dtu.edu.vn', '$2b$10$rGT6sQxF1CdLeV1kU3CuieWL/QI6FZfyhgYkGMbxQSoO6KJxPFP4W', 'female', 'student', '2025-10-22 09:00:00'),
('Võ Văn Thịnh', 'vovanthinh67@dtu.edu.vn', '$2b$10$rGT6sQxF1CdLeV1kU3CuieWL/QI6FZfyhgYkGMbxQSoO6KJxPFP4W', 'male', 'student', '2025-10-26 09:00:00'),
('Đỗ Thị Sen', 'dothisen68@dtu.edu.vn', '$2b$10$rGT6sQxF1CdLeV1kU3CuieWL/QI6FZfyhgYkGMbxQSoO6KJxPFP4W', 'female', 'student', '2025-10-30 09:00:00'),

-- November (T11) - 4 students
('Ngô Văn Định', 'ngovandinh69@dtu.edu.vn', '$2b$10$rGT6sQxF1CdLeV1kU3CuieWL/QI6FZfyhgYkGMbxQSoO6KJxPFP4W', 'male', 'student', '2025-11-05 09:00:00'),
('Phan Thị Cúc', 'phanthicuc70@dtu.edu.vn', '$2b$10$rGT6sQxF1CdLeV1kU3CuieWL/QI6FZfyhgYkGMbxQSoO6KJxPFP4W', 'female', 'student', '2025-11-12 09:00:00'),
('Đinh Văn Khải', 'dinhvankhai71@dtu.edu.vn', '$2b$10$rGT6sQxF1CdLeV1kU3CuieWL/QI6FZfyhgYkGMbxQSoO6KJxPFP4W', 'male', 'student', '2025-11-19 09:00:00'),
('Lý Thị Hằng', 'lythihang72@dtu.edu.vn', '$2b$10$rGT6sQxF1CdLeV1kU3CuieWL/QI6FZfyhgYkGMbxQSoO6KJxPFP4W', 'female', 'student', '2025-11-26 09:00:00'),

-- December (T12) - 8 students
('Mai Văn Hưng', 'maivanhung73@dtu.edu.vn', '$2b$10$rGT6sQxF1CdLeV1kU3CuieWL/QI6FZfyhgYkGMbxQSoO6KJxPFP4W', 'male', 'student', '2025-12-03 09:00:00'),
('Cao Thị Mỹ', 'caothimy74@dtu.edu.vn', '$2b$10$rGT6sQxF1CdLeV1kU3CuieWL/QI6FZfyhgYkGMbxQSoO6KJxPFP4W', 'female', 'student', '2025-12-06 09:00:00'),
('Thái Văn Bách', 'thaivanbach75@dtu.edu.vn', '$2b$10$rGT6sQxF1CdLeV1kU3CuieWL/QI6FZfyhgYkGMbxQSoO6KJxPFP4W', 'male', 'student', '2025-12-09 09:00:00'),
('Quách Thị Ngân', 'quachthingan76@dtu.edu.vn', '$2b$10$rGT6sQxF1CdLeV1kU3CuieWL/QI6FZfyhgYkGMbxQSoO6KJxPFP4W', 'female', 'student', '2025-12-12 09:00:00'),
('Lâm Văn Phú', 'lamvanphu77@dtu.edu.vn', '$2b$10$rGT6sQxF1CdLeV1kU3CuieWL/QI6FZfyhgYkGMbxQSoO6KJxPFP4W', 'male', 'student', '2025-12-15 09:00:00'),
('Kiều Thị Loan', 'kieuthiloan78@dtu.edu.vn', '$2b$10$rGT6sQxF1CdLeV1kU3CuieWL/QI6FZfyhgYkGMbxQSoO6KJxPFP4W', 'female', 'student', '2025-12-18 09:00:00'),
('Trịnh Văn Phát', 'trinhvanphat79@dtu.edu.vn', '$2b$10$rGT6sQxF1CdLeV1kU3CuieWL/QI6FZfyhgYkGMbxQSoO6KJxPFP4W', 'male', 'student', '2025-12-21 09:00:00'),
('Tô Thị Yến', 'tothiyen80@dtu.edu.vn', '$2b$10$rGT6sQxF1CdLeV1kU3CuieWL/QI6FZfyhgYkGMbxQSoO6KJxPFP4W', 'female', 'student', '2025-12-24 09:00:00');

SELECT CONCAT('✅ Students: ', COUNT(*)) AS status FROM users WHERE email LIKE '%@dtu.edu.vn';

-- ============================================================================
-- 2️⃣ CREATE 24 EXAMS (fluctuating per month)
-- ============================================================================

INSERT INTO exams (instructor_id, title, duration, duration_minutes, time_open, time_close, max_points, exam_room_code, status, created_at) VALUES
-- January (3 exams)
(1, 'Lập trình Python - Kỳ thi T1/1', 60, 60, '2025-01-15 08:00:00', '2025-01-31 23:59:00', 10, 'PYTH-01-01', 'published', '2025-01-10 07:00:00'),
(1, 'Nhập môn CNTT - Kỳ thi T1/2', 45, 45, '2025-01-18 08:00:00', '2025-01-31 23:59:00', 10, 'INTRO-01-02', 'published', '2025-01-12 07:00:00'),
(1, 'Toán cao cấp - Kỳ thi T1/3', 90, 90, '2025-01-22 08:00:00', '2025-01-31 23:59:00', 10, 'MATH-01-03', 'published', '2025-01-15 07:00:00'),

-- February (1 exam)
(1, 'Cơ sở dữ liệu - Kỳ thi T2/1', 60, 60, '2025-02-20 08:00:00', '2025-02-28 23:59:00', 10, 'SQL-02-01', 'published', '2025-02-15 07:00:00'),

-- March (4 exams)
(1, 'Mạng máy tính - Kỳ thi T3/1', 60, 60, '2025-03-05 08:00:00', '2025-03-15 23:59:00', 10, 'NET-03-01', 'published', '2025-03-01 07:00:00'),
(1, 'Lập trình C++ - Kỳ thi T3/2', 60, 60, '2025-03-12 08:00:00', '2025-03-22 23:59:00', 10, 'CPP-03-02', 'published', '2025-03-08 07:00:00'),
(1, 'Web Frontend - Kỳ thi T3/3', 60, 60, '2025-03-19 08:00:00', '2025-03-29 23:59:00', 10, 'WEB-03-03', 'published', '2025-03-15 07:00:00'),
(1, 'Kỹ năng mềm - Kỳ thi T3/4', 45, 45, '2025-03-25 08:00:00', '2025-03-31 23:59:00', 10, 'SOFT-03-04', 'published', '2025-03-20 07:00:00'),

-- April (1 exam)
(1, 'An toàn thông tin - Kỳ thi T4/1', 60, 60, '2025-04-15 08:00:00', '2025-04-30 23:59:00', 10, 'SEC-04-01', 'published', '2025-04-10 07:00:00'),

-- May (5 exams)
(1, 'Java OOP - Kỳ thi T5/1', 60, 60, '2025-05-05 08:00:00', '2025-05-15 23:59:00', 10, 'JAVA-05-01', 'published', '2025-05-01 07:00:00'),
(1, 'Cấu trúc dữ liệu - Kỳ thi T5/2', 90, 90, '2025-05-10 08:00:00', '2025-05-20 23:59:00', 10, 'DSA-05-02', 'published', '2025-05-05 07:00:00'),
(1, 'Hệ điều hành - Kỳ thi T5/3', 60, 60, '2025-05-15 08:00:00', '2025-05-25 23:59:00', 10, 'OS-05-03', 'published', '2025-05-10 07:00:00'),
(1, 'Phân tích thiết kế - Kỳ thi T5/4', 60, 60, '2025-05-20 08:00:00', '2025-05-30 23:59:00', 10, 'SAD-05-04', 'published', '2025-05-15 07:00:00'),
(1, 'Kiểm thử PM - Kỳ thi T5/5', 45, 45, '2025-05-25 08:00:00', '2025-05-31 23:59:00', 10, 'TEST-05-05', 'published', '2025-05-20 07:00:00'),

-- August (2 exams)
(1, 'Linux cơ bản - Kỳ thi T8/1', 60, 60, '2025-08-15 08:00:00', '2025-08-25 23:59:00', 10, 'LINUX-08-01', 'published', '2025-08-10 07:00:00'),
(1, 'Mobile App - Kỳ thi T8/2', 60, 60, '2025-08-22 08:00:00', '2025-08-31 23:59:00', 10, 'MOBILE-08-02', 'published', '2025-08-18 07:00:00'),

-- September (4 exams)
(1, 'Trí tuệ nhân tạo - Kỳ thi T9/1', 60, 60, '2025-09-05 08:00:00', '2025-09-15 23:59:00', 10, 'AI-09-01', 'published', '2025-09-01 07:00:00'),
(1, 'Machine Learning - Kỳ thi T9/2', 90, 90, '2025-09-12 08:00:00', '2025-09-22 23:59:00', 10, 'ML-09-02', 'published', '2025-09-08 07:00:00'),
(1, 'Cloud Computing - Kỳ thi T9/3', 60, 60, '2025-09-19 08:00:00', '2025-09-29 23:59:00', 10, 'CLOUD-09-03', 'published', '2025-09-15 07:00:00'),
(1, 'DevOps - Kỳ thi T9/4', 60, 60, '2025-09-25 08:00:00', '2025-09-30 23:59:00', 10, 'DEVOPS-09-04', 'published', '2025-09-20 07:00:00'),

-- October (2 exams)
(1, 'Blockchain - Kỳ thi T10/1', 60, 60, '2025-10-10 08:00:00', '2025-10-20 23:59:00', 10, 'BLOCK-10-01', 'published', '2025-10-05 07:00:00'),
(1, 'UI/UX Design - Kỳ thi T10/2', 60, 60, '2025-10-20 08:00:00', '2025-10-31 23:59:00', 10, 'UIUX-10-02', 'published', '2025-10-15 07:00:00'),

-- November (1 exam)
(1, 'Quản lý dự án - Kỳ thi T11/1', 60, 60, '2025-11-15 08:00:00', '2025-11-30 23:59:00', 10, 'PM-11-01', 'published', '2025-11-10 07:00:00'),

-- December (3 exams)
(1, 'English for IT - Kỳ thi T12/1', 45, 45, '2025-12-05 08:00:00', '2025-12-15 23:59:00', 10, 'ENGIT-12-01', 'published', '2025-12-01 07:00:00'),
(1, 'Big Data - Kỳ thi T12/2', 90, 90, '2025-12-12 08:00:00', '2025-12-22 23:59:00', 10, 'BIGDATA-12-02', 'published', '2025-12-08 07:00:00'),
(1, 'Đồ án tốt nghiệp - Kỳ thi T12/3', 120, 120, '2025-12-18 08:00:00', '2025-12-28 23:59:00', 10, 'CAPSTONE-12-03', 'published', '2025-12-15 07:00:00');

SELECT CONCAT('✅ Exams: ', COUNT(*)) AS status FROM exams WHERE title LIKE '% - Kỳ thi T%';

-- ============================================================================
-- 3️⃣ CREATE QUESTIONS (5 per exam)
-- ============================================================================

INSERT INTO exam_questions (exam_id, question_text, type, model_answer, points, order_index, created_at, created_by)
SELECT 
    e.id,
    CONCAT('Câu ', n.num, ': ', CASE n.num WHEN 1 THEN 'Khái niệm cơ bản?' WHEN 2 THEN 'Công cụ phổ biến?' WHEN 3 THEN 'Ứng dụng thực tế?' WHEN 4 THEN 'Giải thích quy trình.' ELSE 'Phân tích ưu nhược điểm.' END),
    IF(n.num <= 3, 'MCQ', 'Essay'),
    IF(n.num > 3, 'Đáp án mẫu', NULL),
    IF(n.num <= 3, 1, 3.5),
    n.num,
    e.created_at,
    1
FROM exams e
CROSS JOIN (SELECT 1 AS num UNION SELECT 2 UNION SELECT 3 UNION SELECT 4 UNION SELECT 5) n
WHERE e.title LIKE '% - Kỳ thi T%';

SELECT CONCAT('✅ Questions: ', COUNT(*)) AS status FROM exam_questions;

-- ============================================================================
-- 4️⃣ CREATE OPTIONS FOR MCQ
-- ============================================================================

INSERT INTO exam_options (question_id, option_text, is_correct)
SELECT eq.id, 'Đáp án A', FALSE FROM exam_questions eq WHERE eq.type = 'MCQ' AND eq.exam_id IN (SELECT id FROM exams WHERE title LIKE '% - Kỳ thi T%')
UNION ALL SELECT eq.id, 'Đáp án B (đúng)', TRUE FROM exam_questions eq WHERE eq.type = 'MCQ' AND eq.exam_id IN (SELECT id FROM exams WHERE title LIKE '% - Kỳ thi T%')
UNION ALL SELECT eq.id, 'Đáp án C', FALSE FROM exam_questions eq WHERE eq.type = 'MCQ' AND eq.exam_id IN (SELECT id FROM exams WHERE title LIKE '% - Kỳ thi T%')
UNION ALL SELECT eq.id, 'Đáp án D', FALSE FROM exam_questions eq WHERE eq.type = 'MCQ' AND eq.exam_id IN (SELECT id FROM exams WHERE title LIKE '% - Kỳ thi T%');

SELECT CONCAT('✅ Options: ', COUNT(*)) AS status FROM exam_options;

-- ============================================================================
-- 5️⃣ CREATE SUBMISSIONS
-- ============================================================================

INSERT INTO submissions (exam_id, user_id, attempt_no, started_at, submitted_at, total_score, ai_score, suggested_total_score, status, cheating_count, created_at)
SELECT 
    e.id,
    u.id,
    1,
    DATE_ADD(e.time_open, INTERVAL FLOOR(RAND() * 60) MINUTE),
    DATE_ADD(e.time_open, INTERVAL (40 + FLOOR(RAND() * 30)) MINUTE),
    ROUND(1 + RAND() * 2, 2),
    ROUND(2 + RAND() * 4.5, 2),
    ROUND(4 + RAND() * 5.5, 2),
    ELT(1 + FLOOR(RAND() * 3), 'submitted', 'graded', 'confirmed'),
    IF(RAND() > 0.92, FLOOR(RAND() * 3) + 1, 0),
    e.created_at
FROM exams e
JOIN users u ON u.role = 'student' AND u.email LIKE '%@dtu.edu.vn'
WHERE e.title LIKE '% - Kỳ thi T%'
  AND u.created_at <= e.time_open
ORDER BY RAND()
LIMIT 150;

SELECT CONCAT('✅ Submissions: ', COUNT(*)) AS status FROM submissions;

-- ============================================================================
-- 6️⃣ CREATE STUDENT_ANSWERS
-- ============================================================================

INSERT INTO student_answers (student_id, question_id, submission_id, answer_text, selected_option_id, score, status, graded_at)
SELECT 
    s.user_id, q.id, s.id,
    CASE WHEN q.type = 'MCQ' THEN NULL ELSE 'Câu trả lời.' END,
    CASE WHEN q.type = 'MCQ' THEN (SELECT id FROM exam_options WHERE question_id = q.id AND is_correct = TRUE LIMIT 1) ELSE NULL END,
    CASE WHEN q.type = 'MCQ' THEN IF(RAND() > 0.3, q.points, 0) ELSE ROUND(q.points * (0.5 + RAND() * 0.5), 2) END,
    CASE s.status WHEN 'confirmed' THEN 'confirmed' WHEN 'graded' THEN 'graded' ELSE 'pending' END,
    CASE WHEN s.status IN ('graded', 'confirmed') THEN s.submitted_at ELSE NULL END
FROM submissions s
JOIN exam_questions q ON q.exam_id = s.exam_id;

SELECT CONCAT('✅ Answers: ', COUNT(*)) AS status FROM student_answers;

-- ============================================================================
-- 7️⃣ CREATE RESULTS
-- ============================================================================

INSERT INTO results (exam_id, student_id, total_score, status)
SELECT exam_id, user_id, suggested_total_score, 'graded' FROM submissions;

SELECT CONCAT('✅ Results: ', COUNT(*)) AS status FROM results;

-- ============================================================================
-- SUMMARY
-- ============================================================================

SET FOREIGN_KEY_CHECKS = 1;
SET SQL_SAFE_UPDATES = 1;

SELECT '✅ SEED DATA WITH NAME-BASED EMAILS COMPLETE!' AS '';
SELECT CONCAT('👥 Students: ', COUNT(*)) AS '' FROM users WHERE email LIKE '%@dtu.edu.vn';
SELECT CONCAT('📝 Exams: ', COUNT(*)) AS '' FROM exams WHERE title LIKE '% - Kỳ thi T%';
SELECT CONCAT('📤 Submissions: ', COUNT(*)) AS '' FROM submissions;
