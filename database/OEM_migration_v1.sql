
-- OEM Mini Database Schema (Concept -> Logical -> Physical) - Migration
-- Engine: MySQL 8.0.x
-- Charset: utf8mb4 / utf8mb4_unicode_ci

-- === Safety reset (fresh start) ===
DROP DATABASE IF EXISTS oem_mini;
CREATE DATABASE oem_mini CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE oem_mini;

-- ============================================================================
-- PHYSICAL SCHEMA (Tables, Keys, FKs)
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
    duration INT NOT NULL,
    exam_room_code VARCHAR(20) NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
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
    points FLOAT DEFAULT 1,
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
    score FLOAT DEFAULT 0,
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
    total_score FLOAT DEFAULT 0,
    ai_score FLOAT NULL,
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
    total_score FLOAT DEFAULT 0,
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

-- Add FK for users.verify_room_code AFTER exams exists (references UNIQUE column)
ALTER TABLE users
ADD CONSTRAINT fk_users_verify_room_code
FOREIGN KEY (verify_room_code) REFERENCES exams(exam_room_code)
ON UPDATE CASCADE ON DELETE SET NULL;

-- Useful view for quick inspection (optional)
CREATE OR REPLACE VIEW v_exam_overview AS
SELECT e.id AS exam_id, e.title AS exam_title, e.exam_room_code, c.title AS course_title, u.full_name AS instructor
FROM exams e
JOIN courses c ON c.id = e.course_id
JOIN users u ON u.id = c.instructor_id;


-- ============================================================================
-- END OF SCRIPT
-- ============================================================================
