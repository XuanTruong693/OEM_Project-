-- ============================================================================
-- 🧩 OEM Mini Database Schema (v5 - Instructor Final Version)
-- Engine: MySQL 8.0.x
-- Charset: utf8mb4 / utf8mb4_unicode_ci
-- Author: OEM Mini Team (Capstone Project 2025 - CMU-SE)
-- ============================================================================

DROP DATABASE IF EXISTS oem_mini;
CREATE DATABASE oem_mini CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE oem_mini;

-- ============================================================================
-- TABLES
-- ============================================================================

-- 1) users
CREATE TABLE users (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    full_name VARCHAR(100) NOT NULL,
    email VARCHAR(120) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    avatar VARCHAR(255) NULL,
    avatar_blob LONGBLOB NULL,
    avatar_mimetype VARCHAR(100) NULL,
    gender ENUM('male','female','other') NULL,
    address VARCHAR(255) NULL,
    phone_number VARCHAR(20) NULL,
    role ENUM('admin','instructor','student') NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    verify_room_code BOOLEAN DEFAULT FALSE,
    INDEX idx_users_role (role)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2) courses
CREATE TABLE courses (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(100) NOT NULL,
    description TEXT NULL,
    instructor_id INT UNSIGNED NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_courses_instructor (instructor_id),
    CONSTRAINT fk_courses_instructor
        FOREIGN KEY (instructor_id) REFERENCES users(id)
        ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- 3) exams
CREATE TABLE exams (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    course_id INT UNSIGNED NULL,                
    instructor_id INT UNSIGNED NULL,            
    title VARCHAR(100) NOT NULL,
    duration INT NOT NULL CHECK (duration > 0),
    exam_room_code VARCHAR(64) NULL,
    status ENUM('draft','published','archived') DEFAULT 'draft',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_exams_room_code (exam_room_code),
    INDEX idx_exams_course (course_id),
    INDEX idx_exams_instructor (instructor_id),
    CONSTRAINT fk_exams_course
        FOREIGN KEY (course_id) REFERENCES courses(id)
        ON UPDATE CASCADE ON DELETE SET NULL,
    CONSTRAINT fk_exams_instructor
        FOREIGN KEY (instructor_id) REFERENCES users(id)
        ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4) exam_questions
CREATE TABLE exam_questions (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    exam_id INT UNSIGNED NOT NULL,
    question_text TEXT NOT NULL,
    type ENUM('MCQ','Essay') NOT NULL,
    model_answer TEXT NULL,
    points FLOAT DEFAULT 1 CHECK (points >= 0),
    order_index INT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_exam_questions_exam (exam_id),
    CONSTRAINT fk_exam_questions_exam
        FOREIGN KEY (exam_id) REFERENCES exams(id)
        ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5) exam_options
CREATE TABLE exam_options (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    question_id INT UNSIGNED NOT NULL,
    option_text TEXT NOT NULL,
    is_correct BOOLEAN DEFAULT FALSE,
    INDEX idx_exam_options_question (question_id),
    CONSTRAINT fk_exam_options_question
        FOREIGN KEY (question_id) REFERENCES exam_questions(id)
        ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6) student_answers
CREATE TABLE student_answers (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    student_id INT UNSIGNED NOT NULL,
    question_id INT UNSIGNED NOT NULL,
    answer_text TEXT NULL,
    selected_option_id INT UNSIGNED NULL,
    score FLOAT DEFAULT 0 CHECK (score >= 0),
    status ENUM('pending','graded','confirmed') DEFAULT 'pending',
    submission_id INT UNSIGNED NULL,
    INDEX idx_student_answers_student (student_id),
    INDEX idx_student_answers_question (question_id),
    INDEX idx_student_answers_submission (submission_id),
    INDEX idx_student_answers_selected_option (selected_option_id),
    CONSTRAINT fk_student_answers_student
        FOREIGN KEY (student_id) REFERENCES users(id)
        ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT fk_student_answers_question
        FOREIGN KEY (question_id) REFERENCES exam_questions(id)
        ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT fk_student_answers_selected_option
        FOREIGN KEY (selected_option_id) REFERENCES exam_options(id)
        ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 7) submissions
CREATE TABLE submissions (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    exam_id INT UNSIGNED NOT NULL,
    user_id INT UNSIGNED NOT NULL,
    submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    total_score FLOAT DEFAULT 0 CHECK (total_score >= 0),
    ai_score FLOAT NULL,
    suggested_total_score FLOAT NULL,
    instructor_confirmed BOOLEAN DEFAULT FALSE,
    status ENUM('pending','graded','confirmed') DEFAULT 'pending',
    INDEX idx_submissions_exam (exam_id),
    INDEX idx_submissions_user (user_id),
    CONSTRAINT fk_submissions_exam
        FOREIGN KEY (exam_id) REFERENCES exams(id)
        ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT fk_submissions_user
        FOREIGN KEY (user_id) REFERENCES users(id)
        ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 8) results
CREATE TABLE results (
    id INT AUTO_INCREMENT PRIMARY KEY,
    exam_id INT NOT NULL,
    student_id INT UNSIGNED NOT NULL,
    total_score FLOAT DEFAULT 0 CHECK (total_score >= 0),
    status ENUM('pending','graded','confirmed') DEFAULT 'pending',
    INDEX idx_results_exam (exam_id),
    INDEX idx_results_student (student_id),
    CONSTRAINT fk_results_exam
        FOREIGN KEY (exam_id) REFERENCES exams(id)
        ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT fk_results_student
        FOREIGN KEY (student_id) REFERENCES users(id)
        ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 9) ai_logs
CREATE TABLE ai_logs (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    question_id INT UNSIGNED NOT NULL,
    student_id INT UNSIGNED NOT NULL,
    student_answer TEXT NOT NULL,
    model_answer TEXT NOT NULL,
    similarity_score FLOAT NULL,
    ai_suggested_score FLOAT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_ai_logs_question (question_id),
    INDEX idx_ai_logs_student (student_id),
    CONSTRAINT fk_ai_logs_question
        FOREIGN KEY (question_id) REFERENCES exam_questions(id)
        ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT fk_ai_logs_student
        FOREIGN KEY (student_id) REFERENCES users(id)
        ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 10) user_verified_rooms 
CREATE TABLE user_verified_rooms (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id INT UNSIGNED NOT NULL,
    exam_room_code VARCHAR(64) NOT NULL,
    verified_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_uvr_user FOREIGN KEY (user_id) REFERENCES users(id) ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT fk_uvr_exam FOREIGN KEY (exam_room_code) REFERENCES exams(exam_room_code) ON UPDATE CASCADE ON DELETE CASCADE,
    UNIQUE KEY uq_user_room (user_id, exam_room_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- TRIGGER
-- ============================================================================
DELIMITER $$

CREATE TRIGGER trg_confirmed_results_update
AFTER UPDATE ON submissions
FOR EACH ROW
BEGIN
    IF NEW.instructor_confirmed = TRUE AND NEW.status = 'graded' THEN
        UPDATE results
        SET total_score = NEW.suggested_total_score,
            status = 'confirmed'
        WHERE results.exam_id = NEW.exam_id
          AND results.student_id = NEW.user_id;
    END IF;
END$$

DELIMITER ;

-- ============================================================================
-- STORED PROCEDURES
-- ============================================================================
DELIMITER $$

-- 1️⃣ Student submit exam
CREATE PROCEDURE sp_submit_exam(IN p_exam_id INT, IN p_student_id INT)
BEGIN
    IF NOT EXISTS (SELECT 1 FROM results WHERE exam_id=p_exam_id AND student_id=p_student_id) THEN
        INSERT INTO results (exam_id, student_id, status)
        VALUES (p_exam_id, p_student_id, 'pending');
    END IF;

    UPDATE submissions
    SET suggested_total_score = total_score + COALESCE(ai_score,0),
        status = 'graded'
    WHERE exam_id = p_exam_id AND user_id = p_student_id;
END$$

-- 2️⃣ Get results by role
CREATE PROCEDURE sp_get_exam_results(IN examId INT, IN userRole VARCHAR(20), IN userId INT)
BEGIN
    IF userRole = 'student' THEN
        SELECT r.id, e.title AS exam_title, c.title AS course_title,
               COALESCE(r.total_score, s.suggested_total_score) AS display_score,
               CASE 
                   WHEN r.status='confirmed' THEN 'Final Score (Confirmed)'
                   WHEN s.status='graded' THEN 'Suggested Score (Awaiting Instructor Approval)'
                   ELSE 'Pending Grading'
               END AS score_status
        FROM results r
        JOIN exams e ON e.id = r.exam_id
        JOIN courses c ON c.id = e.course_id
        JOIN submissions s ON s.exam_id=e.id AND s.user_id=r.student_id
        WHERE r.exam_id = examId AND r.student_id = userId;

    ELSEIF userRole = 'instructor' THEN
        SELECT r.id, u.full_name AS student_name, r.total_score, r.status,
               s.total_score AS mcq_score, s.ai_score AS ai_score,
               s.suggested_total_score
        FROM results r
        JOIN users u ON u.id = r.student_id
        JOIN submissions s ON s.exam_id = r.exam_id AND s.user_id = r.student_id
        WHERE r.exam_id = examId;

    ELSEIF userRole = 'admin' THEN
        SELECT r.*, u.full_name AS student_name, e.title AS exam_title, c.title AS course_title
        FROM results r
        JOIN users u ON u.id = r.student_id
        JOIN exams e ON e.id = r.exam_id
        JOIN courses c ON c.id = e.course_id;
    END IF;
END$$

-- 3️⃣ Instructor: Update student record in an exam
CREATE PROCEDURE sp_update_student_exam_record(
    IN p_exam_id INT,
    IN p_student_id INT,
    IN p_new_name VARCHAR(100),
    IN p_new_mcq_score FLOAT,
    IN p_new_ai_score FLOAT
)
BEGIN
    START TRANSACTION;

    UPDATE users
    SET full_name = p_new_name
    WHERE id = p_student_id AND role = 'student';

    UPDATE submissions
    SET total_score = p_new_mcq_score,
        ai_score = p_new_ai_score,
        suggested_total_score = p_new_mcq_score + COALESCE(p_new_ai_score,0),
        instructor_confirmed = TRUE,
        status = 'confirmed'
    WHERE exam_id = p_exam_id AND user_id = p_student_id;

    UPDATE results
    SET total_score = p_new_mcq_score + COALESCE(p_new_ai_score,0),
        status = 'confirmed'
    WHERE exam_id = p_exam_id AND student_id = p_student_id;

    COMMIT;
END$$

-- 4️⃣ Instructor: Delete all data of a student in an exam (hide name)
CREATE PROCEDURE sp_delete_student_exam_record(
    IN p_exam_id INT,
    IN p_student_id INT
)
BEGIN
    DECLARE exit HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
    END;

    START TRANSACTION;

    DELETE FROM ai_logs
    WHERE student_id = p_student_id
      AND question_id IN (
        SELECT id FROM exam_questions WHERE exam_id = p_exam_id
      );

    DELETE FROM student_answers
    WHERE student_id = p_student_id
      AND question_id IN (
        SELECT id FROM exam_questions WHERE exam_id = p_exam_id
      );

    DELETE FROM submissions
    WHERE user_id = p_student_id AND exam_id = p_exam_id;

    DELETE FROM results
    WHERE student_id = p_student_id AND exam_id = p_exam_id;

    -- Ẩn tên học viên khỏi danh sách hiển thị của bài thi
    UPDATE users
    SET full_name = CONCAT('(Đã xóa khỏi bài thi #', p_exam_id, ')')
    WHERE id = p_student_id AND role = 'student';

    COMMIT;
END$$

DELIMITER ;

-- ============================================================================
-- VIEWS
-- ============================================================================
CREATE OR REPLACE VIEW v_exam_overview AS
SELECT e.id AS exam_id, e.title AS exam_title, e.exam_room_code, 
       c.title AS course_title, u.full_name AS instructor
FROM exams e
JOIN courses c ON c.id = e.course_id
JOIN users u ON u.id = c.instructor_id;

-- Instructor: Exam Bank
CREATE OR REPLACE VIEW v_instructor_exam_bank AS
SELECT 
    e.id AS exam_id,
    e.title AS exam_title,
    e.status AS exam_status,
    e.created_at,
    e.updated_at,
    c.title AS course_title,
    u.full_name AS instructor_name,
    COUNT(eq.id) AS total_questions
FROM exams e
JOIN courses c ON e.course_id = c.id
JOIN users u ON u.id = c.instructor_id
LEFT JOIN exam_questions eq ON eq.exam_id = e.id
WHERE u.role = 'instructor'
GROUP BY e.id
ORDER BY e.updated_at DESC;

-- Instructor: Assigned Exams (danh sách học viên đã thi)
CREATE OR REPLACE VIEW v_instructor_assigned_exams AS
SELECT 
    e.id AS exam_id,
    e.title AS exam_title,
    c.title AS course_title,
    u.full_name AS instructor_name,
    s.user_id AS student_id,
    stu.full_name AS student_name,
    s.total_score AS mcq_score,
    s.ai_score AS ai_score,
    r.total_score AS final_score,
    s.status AS submission_status,
    s.submitted_at AS student_submitted_at
FROM submissions s
JOIN exams e ON s.exam_id = e.id
JOIN courses c ON e.course_id = c.id
JOIN users u ON c.instructor_id = u.id
JOIN users stu ON stu.id = s.user_id
LEFT JOIN results r ON r.exam_id = e.id AND r.student_id = stu.id
WHERE e.status = 'published'
ORDER BY e.id, s.submitted_at DESC;

-- Student dashboard
CREATE OR REPLACE VIEW v_student_results AS
SELECT e.title AS exam_title,
       c.title AS course_title,
       COALESCE(r.total_score, s.suggested_total_score) AS display_score,
       CASE 
           WHEN r.status='confirmed' THEN 'Final Score (Confirmed)'
           WHEN s.status='graded' THEN 'Suggested Score (Awaiting Instructor Approval)'
           ELSE 'Pending Grading'
       END AS score_status,
       s.submitted_at,
       e.duration
FROM submissions s
JOIN exams e ON e.id = s.exam_id
JOIN courses c ON c.id = e.course_id
LEFT JOIN results r ON r.exam_id = e.id AND r.student_id = s.user_id
WHERE s.user_id IN (SELECT id FROM users WHERE role='student');

-- Admin overview
CREATE OR REPLACE VIEW v_admin_overview AS
SELECT u.full_name AS instructor_name,
       c.title AS course_title,
       e.title AS exam_title,
       COUNT(s.id) AS total_submissions,
       AVG(s.suggested_total_score) AS avg_score,
       SUM(CASE WHEN s.status='confirmed' THEN 1 ELSE 0 END) AS confirmed_count
FROM users u
JOIN courses c ON c.instructor_id = u.id
JOIN exams e ON e.course_id = c.id
LEFT JOIN submissions s ON s.exam_id = e.id
GROUP BY e.id;

-- Migrate existing verify_room_code data
ALTER TABLE users DROP FOREIGN KEY fk_users_verify_room_code;
ALTER TABLE users MODIFY COLUMN verify_room_code BOOLEAN DEFAULT FALSE;

use oem_mini;
ALTER TABLE users MODIFY COLUMN verify_room_code BOOLEAN DEFAULT FALSE;
CREATE TABLE user_verified_rooms (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT UNSIGNED NOT NULL,
    exam_room_code VARCHAR(20) NOT NULL,
    verified_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_uvr_user FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT fk_uvr_exam FOREIGN KEY (exam_room_code)
        REFERENCES exams(exam_room_code)
        ON UPDATE CASCADE ON DELETE CASCADE,
    UNIQUE KEY uq_user_room (user_id, exam_room_code)
);

-- View for instructor statistics
CREATE OR REPLACE VIEW v_instructor_stats AS
SELECT
  c.instructor_id,
  COUNT(DISTINCT e.id) AS total_exams,
  COUNT(s.id) AS total_submissions,
  COUNT(DISTINCT s.user_id) AS total_students
FROM courses c
LEFT JOIN exams e ON e.course_id = c.id
LEFT JOIN submissions s ON s.exam_id = e.id
GROUP BY c.instructor_id;

-- =================================================================
-- ✅ END OF SCRIPT (OEM Mini v5 - Instructor Final Version)
-- =================================================================

-- =================================================================
-- ✅Update database to Sprint 2
-- =================================================================
USE oem_mini;

-- =====================================================
-- 1️⃣ TABLES
-- =====================================================

-- (1) Enrollments
CREATE TABLE IF NOT EXISTS enrollments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    course_id INT NOT NULL,
    enrolled_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    status ENUM('active','cancelled') DEFAULT 'active',
    UNIQUE KEY uq_enrollment_user_course (user_id, course_id),
    INDEX idx_enrollments_user (user_id),
    INDEX idx_enrollments_course (course_id),
    CONSTRAINT fk_enrollments_user FOREIGN KEY (user_id) REFERENCES users(id) ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT fk_enrollments_course FOREIGN KEY (course_id) REFERENCES courses(id) ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- (2) Import Jobs
CREATE TABLE IF NOT EXISTS import_jobs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    job_uuid VARCHAR(64) NOT NULL UNIQUE,
    exam_id INT NOT NULL,
    created_by INT NULL,
    status ENUM('preview','processing','completed','failed') DEFAULT 'preview',
    preview_json LONGTEXT NULL,
    result_summary JSON NULL,
    error_text TEXT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_import_jobs_exam (exam_id),
    INDEX idx_import_jobs_user (created_by),
    CONSTRAINT fk_import_jobs_exam FOREIGN KEY (exam_id) REFERENCES exams(id) ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT fk_import_jobs_user FOREIGN KEY (created_by) REFERENCES users(id) ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- (3) Import Rows
CREATE TABLE IF NOT EXISTS import_rows (
    id INT AUTO_INCREMENT PRIMARY KEY,
    job_id INT NOT NULL,
    `row_number` INT NOT NULL,
    row_data LONGTEXT NOT NULL,
    errors LONGTEXT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_import_rows_job (job_id),
    CONSTRAINT fk_import_rows_job FOREIGN KEY (job_id)
        REFERENCES import_jobs (id)
        ON UPDATE CASCADE
        ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- (4) Refresh Tokens
CREATE TABLE IF NOT EXISTS refresh_tokens (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    token VARCHAR(500) NOT NULL,
    revoked BOOLEAN DEFAULT FALSE,
    expires_at DATETIME NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_refresh_tokens_user (user_id),
    UNIQUE KEY uq_refresh_token_token (token),
    CONSTRAINT fk_refresh_tokens_user FOREIGN KEY (user_id) REFERENCES users(id) ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- (5) Submissions (thêm cột nếu chưa có)
CALL add_column_if_missing('submissions', 'status', "ENUM('pending','graded','confirmed') DEFAULT 'pending'");
CALL add_column_if_missing('submissions', 'total_score', 'FLOAT DEFAULT 0');
CALL add_column_if_missing('submissions', 'created_at', 'DATETIME DEFAULT CURRENT_TIMESTAMP');
CALL add_column_if_missing('submissions', 'updated_at', 'DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP');
CREATE INDEX IF NOT EXISTS idx_submissions_status ON submissions (status);

-- (6) Student Answers
CALL add_column_if_missing('student_answers', 'score', 'FLOAT DEFAULT 0');
CALL add_column_if_missing('student_answers', 'graded_at', 'DATETIME NULL');
CREATE INDEX IF NOT EXISTS idx_student_answers_graded_at ON student_answers (graded_at);

-- (7) Exam Questions
ALTER TABLE exam_questions MODIFY COLUMN type ENUM('MCQ','Essay','Unknown') DEFAULT 'Unknown';
CALL add_column_if_missing('exam_questions', 'points', 'FLOAT DEFAULT 1');
CALL add_column_if_missing('exam_questions', 'created_at', 'DATETIME DEFAULT CURRENT_TIMESTAMP');
CALL add_column_if_missing('exam_questions', 'updated_at', 'DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP');
CREATE INDEX IF NOT EXISTS idx_exam_questions_type ON exam_questions (type);

-- (8) Exams
CALL add_column_if_missing('exams', 'exam_room_code', 'VARCHAR(64) NULL');
CALL add_column_if_missing('exams', 'status', "ENUM('draft','published','archived') DEFAULT 'draft'");
CALL add_column_if_missing('exams', 'created_at', 'DATETIME DEFAULT CURRENT_TIMESTAMP');
CALL add_column_if_missing('exams', 'updated_at', 'DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP');
CALL add_column_if_missing('exams', 'deleted_at', 'DATETIME NULL');
CREATE UNIQUE INDEX IF NOT EXISTS uq_exams_room_code ON exams (exam_room_code);

-- (9) AI Logs
CALL add_column_if_missing('ai_logs', 'request_payload', 'LONGTEXT NULL');
CALL add_column_if_missing('ai_logs', 'response_payload', 'LONGTEXT NULL');
CALL add_column_if_missing('ai_logs', 'error_text', 'TEXT NULL');
CALL add_column_if_missing('ai_logs', 'created_at', 'DATETIME DEFAULT CURRENT_TIMESTAMP');

-- (10) Soft delete courses
CALL add_column_if_missing('courses', 'deleted_at', 'DATETIME NULL');

-- =====================================================
-- 2️⃣ TRIGGERS
-- =====================================================
DELIMITER $$

DROP TRIGGER IF EXISTS trg_update_submission_score $$
CREATE TRIGGER trg_update_submission_score
AFTER UPDATE ON student_answers
FOR EACH ROW
BEGIN
  DECLARE total FLOAT;
  SELECT SUM(score) INTO total FROM student_answers WHERE submission_id = NEW.submission_id;
  UPDATE submissions SET total_score = total WHERE id = NEW.submission_id;
END$$

DROP TRIGGER IF EXISTS trg_check_submission_status $$
CREATE TRIGGER trg_check_submission_status
AFTER UPDATE ON student_answers
FOR EACH ROW
BEGIN
  DECLARE ungraded INT;
  SELECT COUNT(*) INTO ungraded FROM student_answers WHERE submission_id = NEW.submission_id AND graded_at IS NULL;
  IF ungraded = 0 THEN
    UPDATE submissions SET status = 'graded' WHERE id = NEW.submission_id;
  END IF;
END$$

DELIMITER ;

-- =====================================================
-- 3️⃣ PROCEDURES
-- =====================================================
DELIMITER $$

-- Helper: safely add a column if missing
DROP PROCEDURE IF EXISTS add_column_if_missing $$
CREATE PROCEDURE add_column_if_missing(IN tbl VARCHAR(64), IN col VARCHAR(64), IN coldef TEXT)
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = tbl AND COLUMN_NAME = col
  ) THEN
    SET @ddl = CONCAT('ALTER TABLE ', tbl, ' ADD COLUMN ', col, ' ', coldef);
    PREPARE stmt FROM @ddl;
    EXECUTE stmt;
    DEALLOCATE PREPARE stmt;
  END IF;
END$$

-- finalize_submission
DROP PROCEDURE IF EXISTS finalize_submission $$
CREATE PROCEDURE finalize_submission(IN submissionId INT)
BEGIN
  DECLARE total FLOAT;
  SELECT SUM(score) INTO total FROM student_answers WHERE submission_id = submissionId;
  UPDATE submissions SET total_score = total, status = 'graded', updated_at = NOW() WHERE id = submissionId;
END$$

-- import_exam_from_job
DROP PROCEDURE IF EXISTS import_exam_from_job $$
CREATE PROCEDURE import_exam_from_job(IN jobId INT)
BEGIN
  DECLARE done INT DEFAULT 0;
  DECLARE q JSON;
  DECLARE cur CURSOR FOR SELECT row_data FROM import_rows WHERE job_id = jobId;
  DECLARE CONTINUE HANDLER FOR NOT FOUND SET done = 1;
  
  OPEN cur;
  read_loop: LOOP
    FETCH cur INTO q;
    IF done THEN LEAVE read_loop; END IF;
    INSERT INTO exam_questions (exam_id, question_text, type, points, created_at)
    VALUES (
      (SELECT exam_id FROM import_jobs WHERE id = jobId),
      JSON_UNQUOTE(JSON_EXTRACT(q, '$.question_text')),
      JSON_UNQUOTE(JSON_EXTRACT(q, '$.type')),
      COALESCE(JSON_UNQUOTE(JSON_EXTRACT(q, '$.points')), 1),
      NOW()
    );
  END LOOP;
  CLOSE cur;
  UPDATE import_jobs SET status = 'completed', updated_at = NOW() WHERE id = jobId;
END$$

DELIMITER ;

-- =====================================================
-- 4️⃣ VIEWS
-- =====================================================
CREATE OR REPLACE VIEW v_exam_overview AS
SELECT 
  e.id AS exam_id,
  e.title AS exam_title,
  e.status,
  e.exam_room_code,
  COUNT(s.id) AS total_submissions,
  AVG(s.total_score) AS avg_score,
  MAX(s.updated_at) AS last_activity
FROM exams e
LEFT JOIN submissions s ON e.id = s.exam_id
GROUP BY e.id, e.title, e.status, e.exam_room_code;

CREATE OR REPLACE VIEW v_student_result_overview AS
SELECT 
  u.id AS student_id,
  u.full_name,
  e.title AS exam_title,
  s.id AS submission_id,
  s.total_score,
  s.status,
  s.updated_at AS graded_at
FROM submissions s
JOIN users u ON s.user_id = u.id
JOIN exams e ON s.exam_id = e.id;

CREATE OR REPLACE VIEW v_ai_logs_trace AS
SELECT 
  id AS log_id,
  request_payload,
  response_payload,
  error_text,
  created_at
FROM ai_logs
ORDER BY created_at DESC;

SELECT '✅ OEM Mini schema successfully updated (no warnings, MySQL-safe)' AS message;

----- sửa bổ sung id_instructor
USE oem_mini;
ALTER TABLE exams
    DROP FOREIGN KEY fk_exams_course,
    DROP COLUMN course_id,
    ADD COLUMN instructor_id INT UNSIGNED NOT NULL AFTER id,
    ADD CONSTRAINT fk_exams_instructor
        FOREIGN KEY (instructor_id) REFERENCES users(id)
        ON UPDATE CASCADE ON DELETE CASCADE;
-- nếu lỗi khóa ngoại thì chạy lệnh sau trước
SET SQL_SAFE_UPDATES = 0;

UPDATE exams SET instructor_id = 18;

SET SQL_SAFE_UPDATES = 1;
-- chạy để kiểm tra tồn tại
SELECT id, title, instructor_id FROM exams;
-- sửa bổ sung id_instructor khóa ngoại
ALTER TABLE exams
ADD CONSTRAINT fk_exams_instructor
FOREIGN KEY (instructor_id) REFERENCES users(id)
ON UPDATE CASCADE ON DELETE CASCADE;
-- bổ sung id_exam vào bảng exam_questions

USE oem_mini;

-- 1️⃣ Tạm tắt kiểm tra khóa ngoại
SET FOREIGN_KEY_CHECKS = 0;

-- 2️⃣ Kiểm tra xem cột exam_id đã tồn tại chưa
SET @col_exists := (
  SELECT COUNT(*) 
  FROM INFORMATION_SCHEMA.COLUMNS 
  WHERE TABLE_SCHEMA = 'oem_mini' 
    AND TABLE_NAME = 'exam_questions' 
    AND COLUMN_NAME = 'exam_id'
);

-- 3️⃣ Nếu chưa có cột thì thêm mới
SET @sql := IF(@col_exists = 0, 
  'ALTER TABLE exam_questions ADD COLUMN exam_id INT NULL AFTER id;', 
  'SELECT "Column exam_id already exists";'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 4️⃣ Cập nhật exam_id hợp lệ (giả sử đề thi có id = 2)
UPDATE exam_questions 
SET exam_id = 2 
WHERE exam_id IS NULL 
   OR exam_id NOT IN (SELECT id FROM exams);

-- 5️⃣ Xóa khóa ngoại cũ nếu có
SET @fk_name := (
  SELECT CONSTRAINT_NAME
  FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
  WHERE TABLE_SCHEMA = 'oem_mini'
    AND TABLE_NAME = 'exam_questions'
    AND COLUMN_NAME = 'exam_id'
    AND REFERENCED_TABLE_NAME = 'exams'
  LIMIT 1
);
SET @sql := IF(@fk_name IS NOT NULL, 
  CONCAT('ALTER TABLE exam_questions DROP FOREIGN KEY ', @fk_name, ';'), 
  'SELECT "No old FK found";'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 6️⃣ Tạo lại khóa ngoại mới đúng chuẩn
ALTER TABLE exam_questions
ADD CONSTRAINT fk_exam_questions_exam
FOREIGN KEY (exam_id) REFERENCES exams(id)
ON UPDATE CASCADE ON DELETE CASCADE;

-- 7️⃣ Bật lại kiểm tra khóa ngoại
SET FOREIGN_KEY_CHECKS = 1;

-- 8️⃣ Kiểm tra kết quả
SELECT 
  CONSTRAINT_NAME, TABLE_NAME, COLUMN_NAME, 
  REFERENCED_TABLE_NAME, REFERENCED_COLUMN_NAME
FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
WHERE TABLE_SCHEMA = 'oem_mini' 
  AND TABLE_NAME = 'exam_questions' 
  AND REFERENCED_TABLE_NAME = 'exams';
--- view instructor exam bank quản lý đề thi
CREATE OR REPLACE VIEW v_exam_questions_detail AS
SELECT 
  q.id AS question_id,
  e.id AS exam_id,
  e.title AS exam_title,
  q.question_text,
  q.type,
  q.model_answer,
  q.points,
  q.created_by
FROM exam_questions q
JOIN exams e ON q.exam_id = e.id;
-- kiểm tra view
SELECT * FROM v_exam_questions_detail WHERE created_by = ? AND exam_id = ?;

-- xóa bảng courses k cần nữa
USE oem_mini;
SET FOREIGN_KEY_CHECKS = 0;
ALTER TABLE enrollments
DROP FOREIGN KEY fk_enrollments_course;
ALTER TABLE exams
DROP FOREIGN KEY fk_exams_course;
ALTER TABLE exams
DROP COLUMN course_id;
DROP TABLE IF EXISTS courses;
SET FOREIGN_KEY_CHECKS = 1;
SELECT '✅ Đã xóa khóa ngoại, cột course_id trong exams và các bảng courses, enrollments thành công.' AS message;

-- update exams table + submission table cho phòng thi
USE oem_mini;
SET @db := DATABASE();

-- exam_id (INT UNSIGNED, NOT NULL)
SELECT COUNT(*) INTO @c FROM INFORMATION_SCHEMA.COLUMNS
 WHERE TABLE_SCHEMA=@db AND TABLE_NAME='submissions' AND COLUMN_NAME='exam_id';
SET @sql := IF(@c=0,
  'ALTER TABLE submissions ADD COLUMN exam_id INT UNSIGNED NULL',
  'SELECT 1'); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- user_id (INT UNSIGNED, NOT NULL)
SELECT COUNT(*) INTO @c FROM INFORMATION_SCHEMA.COLUMNS
 WHERE TABLE_SCHEMA=@db AND TABLE_NAME='submissions' AND COLUMN_NAME='user_id';
SET @sql := IF(@c=0,
  'ALTER TABLE submissions ADD COLUMN user_id INT UNSIGNED NULL',
  'SELECT 1'); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- attempt_no
SELECT COUNT(*) INTO @c FROM INFORMATION_SCHEMA.COLUMNS
 WHERE TABLE_SCHEMA=@db AND TABLE_NAME='submissions' AND COLUMN_NAME='attempt_no';
SET @sql := IF(@c=0,
  'ALTER TABLE submissions ADD COLUMN attempt_no INT NOT NULL DEFAULT 1',
  'SELECT 1'); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- started_at
SELECT COUNT(*) INTO @c FROM INFORMATION_SCHEMA.COLUMNS
 WHERE TABLE_SCHEMA=@db AND TABLE_NAME='submissions' AND COLUMN_NAME='started_at';
SET @sql := IF(@c=0,
  'ALTER TABLE submissions ADD COLUMN started_at DATETIME NULL',
  'SELECT 1'); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- submitted_at
SELECT COUNT(*) INTO @c FROM INFORMATION_SCHEMA.COLUMNS
 WHERE TABLE_SCHEMA=@db AND TABLE_NAME='submissions' AND COLUMN_NAME='submitted_at';
SET @sql := IF(@c=0,
  'ALTER TABLE submissions ADD COLUMN submitted_at DATETIME NULL',
  'SELECT 1'); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- status
SELECT COUNT(*) INTO @c FROM INFORMATION_SCHEMA.COLUMNS
 WHERE TABLE_SCHEMA=@db AND TABLE_NAME='submissions' AND COLUMN_NAME='status';
SET @sql := IF(@c=0,
  'ALTER TABLE submissions ADD COLUMN status ENUM(''pending'',''in_progress'',''submitted'',''graded'',''cancelled'') NOT NULL DEFAULT ''pending''',
  'SELECT 1'); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- face_image_blob
SELECT COUNT(*) INTO @c FROM INFORMATION_SCHEMA.COLUMNS
 WHERE TABLE_SCHEMA=@db AND TABLE_NAME='submissions' AND COLUMN_NAME='face_image_blob';
SET @sql := IF(@c=0,
  'ALTER TABLE submissions ADD COLUMN face_image_blob LONGBLOB NULL',
  'SELECT 1'); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- face_image_mimetype
SELECT COUNT(*) INTO @c FROM INFORMATION_SCHEMA.COLUMNS
 WHERE TABLE_SCHEMA=@db AND TABLE_NAME='submissions' AND COLUMN_NAME='face_image_mimetype';
SET @sql := IF(@c=0,
  'ALTER TABLE submissions ADD COLUMN face_image_mimetype VARCHAR(100) NULL',
  'SELECT 1'); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- face_image_url
SELECT COUNT(*) INTO @c FROM INFORMATION_SCHEMA.COLUMNS
 WHERE TABLE_SCHEMA=@db AND TABLE_NAME='submissions' AND COLUMN_NAME='face_image_url';
SET @sql := IF(@c=0,
  'ALTER TABLE submissions ADD COLUMN face_image_url VARCHAR(500) NULL',
  'SELECT 1'); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- student_card_blob
SELECT COUNT(*) INTO @c FROM INFORMATION_SCHEMA.COLUMNS
 WHERE TABLE_SCHEMA=@db AND TABLE_NAME='submissions' AND COLUMN_NAME='student_card_blob';
SET @sql := IF(@c=0,
  'ALTER TABLE submissions ADD COLUMN student_card_blob LONGBLOB NULL',
  'SELECT 1'); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- student_card_mimetype
SELECT COUNT(*) INTO @c FROM INFORMATION_SCHEMA.COLUMNS
 WHERE TABLE_SCHEMA=@db AND TABLE_NAME='submissions' AND COLUMN_NAME='student_card_mimetype';
SET @sql := IF(@c=0,
  'ALTER TABLE submissions ADD COLUMN student_card_mimetype VARCHAR(100) NULL',
  'SELECT 1'); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- student_card_url
SELECT COUNT(*) INTO @c FROM INFORMATION_SCHEMA.COLUMNS
 WHERE TABLE_SCHEMA=@db AND TABLE_NAME='submissions' AND COLUMN_NAME='student_card_url';
SET @sql := IF(@c=0,
  'ALTER TABLE submissions ADD COLUMN student_card_url VARCHAR(500) NULL',
  'SELECT 1'); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- proctor_flags (JSON)
SELECT COUNT(*) INTO @c FROM INFORMATION_SCHEMA.COLUMNS
 WHERE TABLE_SCHEMA=@db AND TABLE_NAME='submissions' AND COLUMN_NAME='proctor_flags';
SET @sql := IF(@c=0,
  'ALTER TABLE submissions ADD COLUMN proctor_flags JSON NULL',
  'SELECT 1'); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

/* ---------- Backfill nhỏ ---------- */
UPDATE submissions SET attempt_no = 1 WHERE attempt_no IS NULL;

/* ---------- Đảm bảo kiểu cột đúng để gắn FK ---------- */
-- (Nếu trước đó lỡ tạo BIGINT thì đổi về INT UNSIGNED)
ALTER TABLE submissions
  MODIFY COLUMN exam_id INT UNSIGNED NULL,
  MODIFY COLUMN user_id INT UNSIGNED NULL;

/* ---------- Foreign Keys (thêm nếu chưa có) ---------- */
-- Xoá trước nếu đã tồn tại để tránh va
SET FOREIGN_KEY_CHECKS = 0;
SELECT COUNT(*) INTO @fk_exists
FROM INFORMATION_SCHEMA.REFERENTIAL_CONSTRAINTS
WHERE CONSTRAINT_SCHEMA=@db AND CONSTRAINT_NAME='fk_submissions__exams';
SET @sql := IF(@fk_exists>0, 'ALTER TABLE submissions DROP FOREIGN KEY fk_submissions__exams','SELECT 1');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SELECT COUNT(*) INTO @fk_exists
FROM INFORMATION_SCHEMA.REFERENTIAL_CONSTRAINTS
WHERE CONSTRAINT_SCHEMA=@db AND CONSTRAINT_NAME='fk_submissions__users';
SET @sql := IF(@fk_exists>0, 'ALTER TABLE submissions DROP FOREIGN KEY fk_submissions__users','SELECT 1');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
SET FOREIGN_KEY_CHECKS = 1;

-- Thêm lại FK
ALTER TABLE submissions
  ADD CONSTRAINT fk_submissions__exams
    FOREIGN KEY (exam_id) REFERENCES exams(id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT fk_submissions__users
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE ON UPDATE CASCADE;

/* ---------- Indexes (tạo nếu thiếu) ---------- */
-- Unique (exam_id, user_id, attempt_no)
SELECT COUNT(*) INTO @idx_exists
FROM INFORMATION_SCHEMA.STATISTICS
WHERE TABLE_SCHEMA=@db AND TABLE_NAME='submissions' AND INDEX_NAME='uq_submissions_exam_user_attempt';
SET @sql := IF(@idx_exists=0,
  'CREATE UNIQUE INDEX uq_submissions_exam_user_attempt ON submissions (exam_id, user_id, attempt_no)',
  'SELECT 1'); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- Index (exam_id, user_id)
SELECT COUNT(*) INTO @idx_exists
FROM INFORMATION_SCHEMA.STATISTICS
WHERE TABLE_SCHEMA=@db AND TABLE_NAME='submissions' AND INDEX_NAME='idx_submissions_exam_user';
SET @sql := IF(@idx_exists=0,
  'CREATE INDEX idx_submissions_exam_user ON submissions (exam_id, user_id)',
  'SELECT 1'); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- Index (status)
SELECT COUNT(*) INTO @idx_exists
FROM INFORMATION_SCHEMA.STATISTICS
WHERE TABLE_SCHEMA=@db AND TABLE_NAME='submissions' AND INDEX_NAME='idx_submissions_status';
SET @sql := IF(@idx_exists=0,
  'CREATE INDEX idx_submissions_status ON submissions (status)',
  'SELECT 1'); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- Index (user_id)
SELECT COUNT(*) INTO @idx_exists
FROM INFORMATION_SCHEMA.STATISTICS
WHERE TABLE_SCHEMA=@db AND TABLE_NAME='submissions' AND INDEX_NAME='idx_submissions_user';
SET @sql := IF(@idx_exists=0,
  'CREATE INDEX idx_submissions_user ON submissions (user_id)',
  'SELECT 1'); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;


--
ALTER TABLE exams
  MODIFY COLUMN duration_minutes INT NOT NULL DEFAULT 60,
  MODIFY COLUMN max_points DECIMAL(10,2) NULL,
  MODIFY COLUMN require_face_check TINYINT(1) NOT NULL DEFAULT 0,
  MODIFY COLUMN require_student_card TINYINT(1) NOT NULL DEFAULT 0,
  MODIFY COLUMN monitor_screen TINYINT(1) NOT NULL DEFAULT 0;


USE oem_mini;

/* Drop target columns if exist */
-- duration_minutes
SELECT COUNT(*) INTO @c FROM INFORMATION_SCHEMA.COLUMNS
 WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='exams' AND COLUMN_NAME='duration_minutes';
SET @sql := IF(@c=1, 'ALTER TABLE exams DROP COLUMN duration_minutes', 'SELECT 1');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- time_open
SELECT COUNT(*) INTO @c FROM INFORMATION_SCHEMA.COLUMNS
 WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='exams' AND COLUMN_NAME='time_open';
SET @sql := IF(@c=1, 'ALTER TABLE exams DROP COLUMN time_open', 'SELECT 1');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- time_close
SELECT COUNT(*) INTO @c FROM INFORMATION_SCHEMA.COLUMNS
 WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='exams' AND COLUMN_NAME='time_close';
SET @sql := IF(@c=1, 'ALTER TABLE exams DROP COLUMN time_close', 'SELECT 1');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- max_points
SELECT COUNT(*) INTO @c FROM INFORMATION_SCHEMA.COLUMNS
 WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='exams' AND COLUMN_NAME='max_points';
SET @sql := IF(@c=1, 'ALTER TABLE exams DROP COLUMN max_points', 'SELECT 1');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- require_face_check
SELECT COUNT(*) INTO @c FROM INFORMATION_SCHEMA.COLUMNS
 WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='exams' AND COLUMN_NAME='require_face_check';
SET @sql := IF(@c=1, 'ALTER TABLE exams DROP COLUMN require_face_check', 'SELECT 1');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- require_student_card
SELECT COUNT(*) INTO @c FROM INFORMATION_SCHEMA.COLUMNS
 WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='exams' AND COLUMN_NAME='require_student_card';
SET @sql := IF(@c=1, 'ALTER TABLE exams DROP COLUMN require_student_card', 'SELECT 1');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- monitor_screen
SELECT COUNT(*) INTO @c FROM INFORMATION_SCHEMA.COLUMNS
 WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='exams' AND COLUMN_NAME='monitor_screen';
SET @sql := IF(@c=1, 'ALTER TABLE exams DROP COLUMN monitor_screen', 'SELECT 1');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

/* Add fresh columns */
ALTER TABLE exams
  ADD COLUMN duration_minutes INT NOT NULL DEFAULT 60,
  ADD COLUMN time_open DATETIME NULL,
  ADD COLUMN time_close DATETIME NULL,
  ADD COLUMN max_points DECIMAL(10,2) NULL,
  ADD COLUMN require_face_check TINYINT(1) NOT NULL DEFAULT 0,
  ADD COLUMN require_student_card TINYINT(1) NOT NULL DEFAULT 0,
  ADD COLUMN monitor_screen TINYINT(1) NOT NULL DEFAULT 0;

/* Recreate indexes for EXAMS */
-- idx_exams_status_room
SELECT COUNT(*) INTO @idx_exists
FROM INFORMATION_SCHEMA.STATISTICS
WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='exams' AND INDEX_NAME='idx_exams_status_room';
SET @sql := IF(@idx_exists>0, 'DROP INDEX idx_exams_status_room ON exams', 'SELECT 1');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
CREATE INDEX idx_exams_status_room ON exams (status, exam_room_code);

-- idx_exams_time_open
SELECT COUNT(*) INTO @idx_exists
FROM INFORMATION_SCHEMA.STATISTICS
WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='exams' AND INDEX_NAME='idx_exams_time_open';
SET @sql := IF(@idx_exists>0, 'DROP INDEX idx_exams_time_open ON exams', 'SELECT 1');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
CREATE INDEX idx_exams_time_open ON exams (time_open);

/* Ensure submissions table exists (id only) */
CREATE TABLE IF NOT EXISTS submissions (
  id BIGINT PRIMARY KEY AUTO_INCREMENT
);

/* Drop FKs first to allow dropping columns safely */
SET FOREIGN_KEY_CHECKS = 0;

-- drop FK exams
SELECT COUNT(*) INTO @fk_exists
FROM INFORMATION_SCHEMA.REFERENTIAL_CONSTRAINTS
WHERE CONSTRAINT_SCHEMA=DATABASE() AND CONSTRAINT_NAME='fk_submissions__exams';
SET @sql := IF(@fk_exists>0, 'ALTER TABLE submissions DROP FOREIGN KEY fk_submissions__exams', 'SELECT 1');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- drop FK users
SELECT COUNT(*) INTO @fk_exists
FROM INFORMATION_SCHEMA.REFERENTIAL_CONSTRAINTS
WHERE CONSTRAINT_SCHEMA=DATABASE() AND CONSTRAINT_NAME='fk_submissions__users';
SET @sql := IF(@fk_exists>0, 'ALTER TABLE submissions DROP FOREIGN KEY fk_submissions__users', 'SELECT 1');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET FOREIGN_KEY_CHECKS = 1;

/* Drop indexes so we can rebuild clean */
-- unique attempt index
SELECT COUNT(*) INTO @idx_exists
FROM INFORMATION_SCHEMA.STATISTICS
WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='submissions' AND INDEX_NAME='uq_submissions_exam_user_attempt';
SET @sql := IF(@idx_exists>0, 'DROP INDEX uq_submissions_exam_user_attempt ON submissions', 'SELECT 1');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- other indexes
SELECT COUNT(*) INTO @idx_exists
FROM INFORMATION_SCHEMA.STATISTICS
WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='submissions' AND INDEX_NAME='idx_submissions_exam_user';
SET @sql := IF(@idx_exists>0, 'DROP INDEX idx_submissions_exam_user ON submissions', 'SELECT 1');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SELECT COUNT(*) INTO @idx_exists
FROM INFORMATION_SCHEMA.STATISTICS
WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='submissions' AND INDEX_NAME='idx_submissions_status';
SET @sql := IF(@idx_exists>0, 'DROP INDEX idx_submissions_status ON submissions', 'SELECT 1');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SELECT COUNT(*) INTO @idx_exists
FROM INFORMATION_SCHEMA.STATISTICS
WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='submissions' AND INDEX_NAME='idx_submissions_user';
SET @sql := IF(@idx_exists>0, 'DROP INDEX idx_submissions_user ON submissions', 'SELECT 1');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

/* Drop target columns (if exist) and add fresh ones */
-- exam_id
SELECT COUNT(*) INTO @c FROM INFORMATION_SCHEMA.COLUMNS
 WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='submissions' AND COLUMN_NAME='exam_id';
SET @sql := IF(@c=1, 'ALTER TABLE submissions DROP COLUMN exam_id', 'SELECT 1');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
ALTER TABLE submissions ADD COLUMN exam_id BIGINT NULL;

-- user_id
SELECT COUNT(*) INTO @c FROM INFORMATION_SCHEMA.COLUMNS
 WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='submissions' AND COLUMN_NAME='user_id';
SET @sql := IF(@c=1, 'ALTER TABLE submissions DROP COLUMN user_id', 'SELECT 1');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
ALTER TABLE submissions ADD COLUMN user_id BIGINT NULL;

-- attempt_no
SELECT COUNT(*) INTO @c FROM INFORMATION_SCHEMA.COLUMNS
 WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='submissions' AND COLUMN_NAME='attempt_no';
SET @sql := IF(@c=1, 'ALTER TABLE submissions DROP COLUMN attempt_no', 'SELECT 1');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
ALTER TABLE submissions ADD COLUMN attempt_no INT NOT NULL DEFAULT 1;

-- started_at
SELECT COUNT(*) INTO @c FROM INFORMATION_SCHEMA.COLUMNS
 WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='submissions' AND COLUMN_NAME='started_at';
SET @sql := IF(@c=1, 'ALTER TABLE submissions DROP COLUMN started_at', 'SELECT 1');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
ALTER TABLE submissions ADD COLUMN started_at DATETIME NULL;

-- submitted_at
SELECT COUNT(*) INTO @c FROM INFORMATION_SCHEMA.COLUMNS
 WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='submissions' AND COLUMN_NAME='submitted_at';
SET @sql := IF(@c=1, 'ALTER TABLE submissions DROP COLUMN submitted_at', 'SELECT 1');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
ALTER TABLE submissions ADD COLUMN submitted_at DATETIME NULL;

-- status
SELECT COUNT(*) INTO @c FROM INFORMATION_SCHEMA.COLUMNS
 WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='submissions' AND COLUMN_NAME='status';
SET @sql := IF(@c=1, 'ALTER TABLE submissions DROP COLUMN status', 'SELECT 1');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
ALTER TABLE submissions
  ADD COLUMN status ENUM('pending','in_progress','submitted','graded','cancelled')
  NOT NULL DEFAULT 'pending';

-- face_image_blob
SELECT COUNT(*) INTO @c FROM INFORMATION_SCHEMA.COLUMNS
 WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='submissions' AND COLUMN_NAME='face_image_blob';
SET @sql := IF(@c=1, 'ALTER TABLE submissions DROP COLUMN face_image_blob', 'SELECT 1');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
ALTER TABLE submissions ADD COLUMN face_image_blob LONGBLOB NULL;

-- face_image_mimetype
SELECT COUNT(*) INTO @c FROM INFORMATION_SCHEMA.COLUMNS
 WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='submissions' AND COLUMN_NAME='face_image_mimetype';
SET @sql := IF(@c=1, 'ALTER TABLE submissions DROP COLUMN face_image_mimetype', 'SELECT 1');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
ALTER TABLE submissions ADD COLUMN face_image_mimetype VARCHAR(100) NULL;

-- face_image_url
SELECT COUNT(*) INTO @c FROM INFORMATION_SCHEMA.COLUMNS
 WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='submissions' AND COLUMN_NAME='face_image_url';
SET @sql := IF(@c=1, 'ALTER TABLE submissions DROP COLUMN face_image_url', 'SELECT 1');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
ALTER TABLE submissions ADD COLUMN face_image_url VARCHAR(500) NULL;

-- student_card_blob
SELECT COUNT(*) INTO @c FROM INFORMATION_SCHEMA.COLUMNS
 WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='submissions' AND COLUMN_NAME='student_card_blob';
SET @sql := IF(@c=1, 'ALTER TABLE submissions DROP COLUMN student_card_blob', 'SELECT 1');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
ALTER TABLE submissions ADD COLUMN student_card_blob LONGBLOB NULL;

-- student_card_mimetype
SELECT COUNT(*) INTO @c FROM INFORMATION_SCHEMA.COLUMNS
 WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='submissions' AND COLUMN_NAME='student_card_mimetype';
SET @sql := IF(@c=1, 'ALTER TABLE submissions DROP COLUMN student_card_mimetype', 'SELECT 1');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
ALTER TABLE submissions ADD COLUMN student_card_mimetype VARCHAR(100) NULL;

-- student_card_url
SELECT COUNT(*) INTO @c FROM INFORMATION_SCHEMA.COLUMNS
 WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='submissions' AND COLUMN_NAME='student_card_url';
SET @sql := IF(@c=1, 'ALTER TABLE submissions DROP COLUMN student_card_url', 'SELECT 1');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
ALTER TABLE submissions ADD COLUMN student_card_url VARCHAR(500) NULL;

-- proctor_flags
SELECT COUNT(*) INTO @c FROM INFORMATION_SCHEMA.COLUMNS
 WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='submissions' AND COLUMN_NAME='proctor_flags';
SET @sql := IF(@c=1, 'ALTER TABLE submissions DROP COLUMN proctor_flags', 'SELECT 1');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
ALTER TABLE submissions ADD COLUMN proctor_flags JSON NULL;

/* Recreate FKs */
SET FOREIGN_KEY_CHECKS = 1;
ALTER TABLE submissions
  ADD CONSTRAINT fk_submissions__exams
    FOREIGN KEY (exam_id) REFERENCES exams(id)
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE submissions
  ADD CONSTRAINT fk_submissions__users
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE ON UPDATE CASCADE;
/* NOTE: nếu bảng user của bạn KHÔNG phải 'users', hãy đổi tên ở dòng trên. */

/* Recreate Indexes */
CREATE UNIQUE INDEX uq_submissions_exam_user_attempt
  ON submissions (exam_id, user_id, attempt_no);

CREATE INDEX idx_submissions_exam_user
  ON submissions (exam_id, user_id);

CREATE INDEX idx_submissions_status
  ON submissions (status);

CREATE INDEX idx_submissions_user
  ON submissions (user_id);
---
DELIMITER $$

DROP PROCEDURE IF EXISTS sp_get_exam_results $$
CREATE PROCEDURE sp_get_exam_results(IN p_exam_id INT, IN p_role VARCHAR(20), IN p_instructor_id INT)
BEGIN
    SELECT u.full_name AS student_name, s.user_id AS student_id, s.status,
           COALESCE(SUM(CASE WHEN q.type='MCQ' THEN COALESCE(sa.score,0) ELSE 0 END),0) AS mcq_score,
           s.ai_score,
           COALESCE(s.suggested_total_score,
                    COALESCE(SUM(CASE WHEN q.type='MCQ' THEN COALESCE(sa.score,0) ELSE 0 END),0) + COALESCE(s.ai_score,0)) AS suggested_total_score,
           s.total_score, s.started_at, s.submitted_at,
           TIMESTAMPDIFF(MINUTE, s.started_at, s.submitted_at) AS duration_minutes,
           s.proctor_flags, s.face_image_url, s.student_card_url
    FROM submissions s
    JOIN users u ON u.id = s.user_id
    LEFT JOIN student_answers sa ON sa.submission_id = s.id
    LEFT JOIN exam_questions q ON q.id = sa.question_id
    WHERE s.exam_id = p_exam_id
    GROUP BY s.id
    ORDER BY u.full_name;
END $$
DELIMITER ;
--
DELIMITER $$

DROP PROCEDURE IF EXISTS sp_update_student_exam_record $$
CREATE PROCEDURE sp_update_student_exam_record(
    IN p_exam_id INT,
    IN p_student_id INT,
    IN p_student_name VARCHAR(255),
    IN p_mcq_score DECIMAL(10,2),
    IN p_ai_score DECIMAL(10,2)
)
BEGIN
    -- (tuỳ chọn) gói trong transaction
    START TRANSACTION;

    -- 1) Cập nhật submissions
    UPDATE submissions
    SET
        total_score = COALESCE(p_mcq_score, 0),
        ai_score = COALESCE(p_ai_score, 0),
        suggested_total_score = COALESCE(p_mcq_score, 0) + COALESCE(p_ai_score, 0),
        instructor_confirmed = TRUE,
        status = 'confirmed'
    WHERE exam_id = p_exam_id
      AND user_id = p_student_id;

    -- 2) Cập nhật results bằng JOIN để tránh subquery trả nhiều dòng
    UPDATE results r
    JOIN submissions s
      ON s.exam_id = r.exam_id
     AND s.user_id  = r.student_id
    SET
        r.total_score = s.total_score,
        r.status = 'confirmed'
    WHERE r.exam_id = p_exam_id
      AND r.student_id = p_student_id;

    -- 3) Cập nhật tên sinh viên nếu có
    IF p_student_name IS NOT NULL AND LENGTH(TRIM(p_student_name)) > 0 THEN
        UPDATE users
        SET full_name = p_student_name
        WHERE id = p_student_id;
    END IF;

    COMMIT;
END $$
DELIMITER ;




-- =================================================================
-- ✅ END OF SCRIPT (OEM Mini v5.1 - Sprint 2 Update)
