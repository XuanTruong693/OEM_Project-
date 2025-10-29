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
    id INT AUTO_INCREMENT PRIMARY KEY,
    full_name VARCHAR(100) NOT NULL,
    email VARCHAR(120) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role ENUM('admin','instructor','student') NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    verify_room_code VARCHAR(20) NULL,
    INDEX idx_users_role (role)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2) courses
CREATE TABLE courses (
    id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(100) NOT NULL,
    description TEXT NULL,
    instructor_id INT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_courses_instructor (instructor_id),
    CONSTRAINT fk_courses_instructor
        FOREIGN KEY (instructor_id) REFERENCES users(id)
        ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3) exams
CREATE TABLE exams (
    id INT AUTO_INCREMENT PRIMARY KEY,
    course_id INT NOT NULL,
    title VARCHAR(100) NOT NULL,
    duration INT NOT NULL CHECK (duration > 0),
    exam_room_code VARCHAR(20) NULL,
    status ENUM('draft','published','archived') DEFAULT 'draft',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_exams_room_code (exam_room_code),
    INDEX idx_exams_course (course_id),
    CONSTRAINT fk_exams_course
        FOREIGN KEY (course_id) REFERENCES courses(id)
        ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4) exam_questions
CREATE TABLE exam_questions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    exam_id INT NOT NULL,
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
    id INT AUTO_INCREMENT PRIMARY KEY,
    question_id INT NOT NULL,
    option_text TEXT NOT NULL,
    is_correct BOOLEAN DEFAULT FALSE,
    INDEX idx_exam_options_question (question_id),
    CONSTRAINT fk_exam_options_question
        FOREIGN KEY (question_id) REFERENCES exam_questions(id)
        ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6) student_answers
CREATE TABLE student_answers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    student_id INT NOT NULL,
    question_id INT NOT NULL,
    answer_text TEXT NULL,
    selected_option_id INT NULL,
    score FLOAT DEFAULT 0 CHECK (score >= 0),
    status ENUM('pending','graded','confirmed') DEFAULT 'pending',
    submission_id INT NULL,
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
    id INT AUTO_INCREMENT PRIMARY KEY,
    exam_id INT NOT NULL,
    user_id INT NOT NULL,
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
    student_id INT NOT NULL,
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
    id INT AUTO_INCREMENT PRIMARY KEY,
    question_id INT NOT NULL,
    student_id INT NOT NULL,
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

-- FK verify_room_code
ALTER TABLE users
ADD CONSTRAINT fk_users_verify_room_code
FOREIGN KEY (verify_room_code) REFERENCES exams(exam_room_code)
ON UPDATE CASCADE ON DELETE SET NULL;

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
    user_id INT NOT NULL,
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
-- Migrate existing user avatars
USE oem_mini;
ALTER TABLE users
ADD COLUMN avatar VARCHAR(255) NULL AFTER password_hash,
ADD COLUMN gender ENUM('male', 'female', 'other') NULL AFTER avatar,
ADD COLUMN address VARCHAR(255) AFTER full_name,
ADD COLUMN phone_number VARCHAR(20) AFTER address;


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
    row_number INT NOT NULL,
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

--thêm 2 cột avatar vào bảng users
ALTER TABLE oem_mini.users
  ADD COLUMN avatar_blob LONGBLOB NULL, 
  ADD COLUMN avatar_mimetype VARCHAR(100) NULL;
