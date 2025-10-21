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
-- Migrate existing verify_room_code data
USE oem_mini;

ALTER TABLE users
ADD COLUMN avatar VARCHAR(255) NULL AFTER password_hash,
ADD COLUMN gender ENUM('male', 'female', 'other') NULL AFTER avatar;
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

-- Update existing users with avatar and gender
USE oem_mini;
ALTER TABLE users
ADD COLUMN avatar VARCHAR(255) NULL AFTER password_hash,
ADD COLUMN gender ENUM('male', 'female', 'other') NULL AFTER avatar
-- ============================================================================
-- ✅ END OF SCRIPT (OEM Mini v5 - Instructor Final Version)
-- ============================================================================
