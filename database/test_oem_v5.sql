-- ============================================================================
-- 🧹 RESET DATA (OEM Mini v5 – Synced with Migration)
-- ============================================================================
USE oem_mini;
SET SQL_SAFE_UPDATES = 0;
SET FOREIGN_KEY_CHECKS = 0;

DELETE FROM ai_logs;
DELETE FROM student_answers;
DELETE FROM submissions;
DELETE FROM results;
DELETE FROM exam_options;
DELETE FROM exam_questions;
DELETE FROM exams;
DELETE FROM courses;
DELETE FROM users;
ALTER TABLE users AUTO_INCREMENT = 1;

SET FOREIGN_KEY_CHECKS = 1;
SET SQL_SAFE_UPDATES = 1;

-- ============================================================================
-- 👥 1️⃣ USERS
-- ============================================================================
INSERT INTO users (full_name, email, password_hash, role)
VALUES 
('Admin User', 'admin@oem.com', 'hash_admin', 'admin'),
('Dr. Smith', 'smith@uni.edu', 'hash_instructor', 'instructor'),
('Alice Nguyen', 'alice@student.com', 'hash_123', 'student'),
('Bob Tran', 'bob@student.com', 'hash_456', 'student'),
('Carol Pham', 'carol@student.com', 'hash_789', 'student');

-- ============================================================================
-- 📚 2️⃣ COURSES
-- ============================================================================
INSERT INTO courses (title, description, instructor_id)
VALUES
('Database Systems', 'Learn SQL, ERD, normalization.', 2),
('Web Development', 'Intro to HTML, CSS, JS.', 2);

-- ============================================================================
-- 🧾 3️⃣ EXAMS
-- ============================================================================
INSERT INTO exams (course_id, title, duration, exam_room_code, status)
VALUES
(1, 'DB Midterm', 60, 'ROOM123', 'published'),
(1, 'DB Final', 90, 'ROOM456', 'draft'),
(2, 'Web Quiz', 30, 'ROOM789', 'published');

-- ============================================================================
-- ❓ 4️⃣ QUESTIONS + OPTIONS
-- ============================================================================
INSERT INTO exam_questions (exam_id, question_text, type, model_answer, points)
VALUES
(1, 'What is SQL?', 'Essay', 'Structured Query Language', 2),
(1, 'Which are SQL commands?', 'MCQ', 'SELECT', 1);

INSERT INTO exam_options (question_id, option_text, is_correct)
VALUES
(2, 'SELECT', TRUE),
(2, 'WHERE', TRUE),
(2, 'HTML', FALSE),
(2, 'JOIN', TRUE);

-- ============================================================================
-- 🧮 5️⃣ RESULTS
-- ============================================================================
INSERT INTO results (exam_id, student_id, total_score, status)
VALUES
(1, 3, 0, 'pending'),
(1, 4, 0, 'pending'),
(1, 5, 0, 'pending');

-- ============================================================================
-- 📝 6️⃣ SUBMISSIONS
-- ============================================================================
INSERT INTO submissions (exam_id, user_id, total_score, ai_score, suggested_total_score, instructor_confirmed, status)
VALUES
(1, 3, 7, 1, 8, FALSE, 'graded'),
(1, 4, 6, 2, 8, FALSE, 'graded'),
(1, 5, 9, 0, 9, FALSE, 'graded');

-- ============================================================================
-- ⚡ 7️⃣ TRIGGER TEST
-- ============================================================================
UPDATE submissions
SET instructor_confirmed = TRUE, status = 'graded'
WHERE exam_id = 1 AND user_id = 3;

SELECT * FROM results WHERE exam_id = 1;

-- ============================================================================
-- ✏️ 8️⃣ PROCEDURE TEST – Update
-- ============================================================================
CALL sp_update_student_exam_record(1, 3, 'Alice Updated', 9.5, 1.5);

SELECT * FROM submissions WHERE exam_id = 1 AND user_id = 3;
SELECT * FROM results WHERE exam_id = 1 AND student_id = 3;
SELECT * FROM users WHERE id = 3;

-- ============================================================================
-- 🗑️ 9️⃣ PROCEDURE TEST – Delete
-- ============================================================================
CALL sp_delete_student_exam_record(1, 4);

SELECT * FROM submissions WHERE exam_id = 1 AND user_id = 4;
SELECT * FROM results WHERE exam_id = 1 AND student_id = 4;
SELECT * FROM users WHERE id = 4;

-- ============================================================================
-- 👀 🔟 VIEWS TEST
-- ============================================================================
SELECT * FROM v_instructor_exam_bank;
SELECT * FROM v_instructor_assigned_exams;
SELECT * FROM v_student_results;
SELECT * FROM v_admin_overview;

-- ============================================================================
-- 🧠 1️⃣1️⃣ CASCADE TEST
-- ============================================================================
DELETE FROM exams WHERE id = 1;
SELECT COUNT(*) AS remaining_questions FROM exam_questions WHERE exam_id = 1;
SELECT COUNT(*) AS remaining_submissions FROM submissions WHERE exam_id = 1;
SELECT COUNT(*) AS remaining_results FROM results WHERE exam_id = 1;
