-- ============================================================================
-- 🧩 OEM Mini Database Schema (v5 - Instructor Final Version)
-- Engine: MySQL 8.0.x
-- Charset: utf8mb4 / utf8mb4_unicode_ci
-- Author: OEM Mini Team (Capstone Project 2025 - CMU-SE)
-- ============================================================================

DROP DATABASE IF EXISTS oem_mini;

CREATE DATABASE oem_mini CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE oem_mini;

/* 2) Tables */

-- 2.1 users
CREATE TABLE users (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    full_name VARCHAR(100) NOT NULL,
    email VARCHAR(120) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    avatar VARCHAR(255) NULL,
    avatar_blob LONGBLOB NULL,
    avatar_mimetype VARCHAR(100) NULL,
    gender ENUM('male', 'female', 'other') NULL,
    address VARCHAR(255) NULL,
    phone_number VARCHAR(20) NULL,
    role ENUM(
        'admin',
        'instructor',
        'student'
    ) NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    verify_room_code BOOLEAN DEFAULT FALSE,
    failed_login_attempts INT DEFAULT 0 NOT NULL,
    is_locked BOOLEAN DEFAULT FALSE NOT NULL,
    INDEX idx_users_role (role)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

-- 2.2 exams
CREATE TABLE exams (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    instructor_id INT UNSIGNED NOT NULL,
    title VARCHAR(100) NOT NULL,
    duration INT NOT NULL CHECK (duration > 0),
    duration_minutes INT NOT NULL DEFAULT 60,
    time_open DATETIME NULL,
    time_close DATETIME NULL,
    max_points DECIMAL(10, 2) NULL,
    require_face_check TINYINT(1) NOT NULL DEFAULT 0,
    require_student_card TINYINT(1) NOT NULL DEFAULT 0,
    monitor_screen TINYINT(1) NOT NULL DEFAULT 0,
    max_attempts INT UNSIGNED NOT NULL DEFAULT 0 COMMENT '0 = unlimited, >0 = limit retake attempts',
    exam_room_code VARCHAR(64) NULL,
    status ENUM(
        'draft',
        'published',
        'archived'
    ) DEFAULT 'draft',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_exams_room_code (exam_room_code),
    INDEX idx_exams_instructor (instructor_id),
    INDEX idx_exams_status_room (status, exam_room_code),
    INDEX idx_exams_time_open (time_open),
    CONSTRAINT fk_exams_instructor FOREIGN KEY (instructor_id) REFERENCES users (id) ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

-- 2.3 exam_questions
CREATE TABLE exam_questions (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    exam_id INT UNSIGNED NOT NULL,
    question_text TEXT NOT NULL,
    type ENUM('MCQ', 'Essay', 'Unknown') DEFAULT 'Unknown',
    model_answer TEXT NULL,
    points FLOAT DEFAULT 1 CHECK (points >= 0),
    order_index INT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    created_by INT UNSIGNED NULL,
    INDEX idx_exam_questions_exam (exam_id),
    INDEX idx_exam_questions_type (type),
    CONSTRAINT fk_exam_questions_exam FOREIGN KEY (exam_id) REFERENCES exams (id) ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT fk_exam_questions_created_by FOREIGN KEY (created_by) REFERENCES users (id) ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

-- 2.4 exam_options
CREATE TABLE exam_options (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    question_id INT UNSIGNED NOT NULL,
    option_text TEXT NOT NULL,
    is_correct BOOLEAN DEFAULT FALSE,
    INDEX idx_exam_options_question (question_id),
    CONSTRAINT fk_exam_options_question FOREIGN KEY (question_id) REFERENCES exam_questions (id) ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

-- 2.5 submissions
CREATE TABLE submissions (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    exam_id INT UNSIGNED NOT NULL,
    user_id INT UNSIGNED NOT NULL,
    attempt_no INT NOT NULL DEFAULT 1,
    started_at DATETIME NULL,
    submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    total_score FLOAT DEFAULT 0 CHECK (total_score >= 0),
    ai_score FLOAT NULL,
    suggested_total_score FLOAT NULL,
    instructor_confirmed BOOLEAN DEFAULT FALSE,
    status ENUM(
        'pending',
        'in_progress',
        'submitted',
        'graded',
        'confirmed',
        'cancelled'
    ) NOT NULL DEFAULT 'pending',
    -- AI Grading Status for guaranteed delivery
    ai_grading_status ENUM(
        'not_required',  -- No essay questions in exam
        'pending',       -- Waiting to be graded by AI
        'in_progress',   -- Currently being processed
        'completed',     -- Successfully graded
        'failed'         -- Failed, needs retry
    ) DEFAULT 'not_required',
    ai_grading_retry_count INT DEFAULT 0,
    ai_grading_error TEXT NULL,
    ai_grading_started_at DATETIME NULL,
    -- Verification images
    face_image_blob LONGBLOB NULL,
    face_image_mimetype VARCHAR(100) NULL,
    face_image_url VARCHAR(500) NULL,
    student_card_blob LONGBLOB NULL,
    student_card_mimetype VARCHAR(100) NULL,
    student_card_url VARCHAR(500) NULL,
    proctor_flags JSON NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    cheating_count INT NOT NULL DEFAULT 0,
    UNIQUE KEY uq_submissions_exam_user_attempt (exam_id, user_id, attempt_no),
    INDEX idx_submissions_exam (exam_id),
    INDEX idx_submissions_user (user_id),
    INDEX idx_submissions_exam_user (exam_id, user_id),
    INDEX idx_submissions_status (status),
    INDEX idx_ai_grading_status (ai_grading_status),
    CONSTRAINT fk_submissions__exams FOREIGN KEY (exam_id) REFERENCES exams (id) ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT fk_submissions__users FOREIGN KEY (user_id) REFERENCES users (id) ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

-- 2.6 student_answers
CREATE TABLE student_answers (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    student_id INT UNSIGNED NOT NULL,
    question_id INT UNSIGNED NOT NULL,
    submission_id INT UNSIGNED NOT NULL,
    answer_text TEXT NULL,
    selected_option_id INT UNSIGNED NULL,
    score FLOAT DEFAULT 0 CHECK (score >= 0),
    status ENUM(
        'pending',
        'graded',
        'confirmed'
    ) DEFAULT 'pending',
    graded_at DATETIME NULL,
    INDEX idx_student_answers_student (student_id),
    INDEX idx_student_answers_question (question_id),
    INDEX idx_student_answers_submission (submission_id),
    INDEX idx_student_answers_selected_option (selected_option_id),
    CONSTRAINT fk_student_answers_student FOREIGN KEY (student_id) REFERENCES users (id) ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT fk_student_answers_question FOREIGN KEY (question_id) REFERENCES exam_questions (id) ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT fk_student_answers_selected_option FOREIGN KEY (selected_option_id) REFERENCES exam_options (id) ON UPDATE CASCADE ON DELETE SET NULL,
    CONSTRAINT fk_student_answers_submission FOREIGN KEY (submission_id) REFERENCES submissions (id) ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

-- 2.7 results
CREATE TABLE results (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    exam_id INT UNSIGNED NOT NULL,
    student_id INT UNSIGNED NOT NULL,
    total_score FLOAT DEFAULT 0 CHECK (total_score >= 0),
    status ENUM(
        'pending',
        'graded',
        'confirmed'
    ) DEFAULT 'pending',
    INDEX idx_results_exam (exam_id),
    INDEX idx_results_student (student_id),
    CONSTRAINT fk_results_exam FOREIGN KEY (exam_id) REFERENCES exams (id) ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT fk_results_student FOREIGN KEY (student_id) REFERENCES users (id) ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

-- 2.8 ai_logs
CREATE TABLE ai_logs (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    question_id INT UNSIGNED NOT NULL,
    student_id INT UNSIGNED NOT NULL,
    student_answer TEXT NOT NULL,
    model_answer TEXT NOT NULL,
    similarity_score FLOAT NULL,
    ai_suggested_score FLOAT NULL,
    request_payload LONGTEXT NULL,
    response_payload LONGTEXT NULL,
    error_text TEXT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_ai_logs_question (question_id),
    INDEX idx_ai_logs_student (student_id),
    CONSTRAINT fk_ai_logs_question FOREIGN KEY (question_id) REFERENCES exam_questions (id) ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT fk_ai_logs_student FOREIGN KEY (student_id) REFERENCES users (id) ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

-- 2.9 user_verified_rooms
CREATE TABLE user_verified_rooms (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id INT UNSIGNED NOT NULL,
    exam_room_code VARCHAR(64) NOT NULL,
    verified_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_uvr_user FOREIGN KEY (user_id) REFERENCES users (id) ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT fk_uvr_exam FOREIGN KEY (exam_room_code) REFERENCES exams (exam_room_code) ON UPDATE CASCADE ON DELETE CASCADE,
    UNIQUE KEY uq_user_room (user_id, exam_room_code)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

-- 2.10 cheating_logs
CREATE TABLE cheating_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    submission_id INT NOT NULL,
    student_id INT NOT NULL,
    exam_id INT NOT NULL,
    event_type VARCHAR(100) NOT NULL COMMENT 'tab_switch, window_blur, multiple_faces, etc.',
    event_details JSON NULL COMMENT 'Additional event details',
    detected_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    severity ENUM('low', 'medium', 'high') DEFAULT 'medium',
    INDEX idx_cheating_logs_submission (submission_id),
    INDEX idx_cheating_logs_student (student_id),
    INDEX idx_cheating_logs_exam (exam_id),
    INDEX idx_cheating_logs_detected_at (detected_at),
    CONSTRAINT fk_cheating_logs_submission FOREIGN KEY (submission_id) REFERENCES submissions (id) ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT fk_cheating_logs_student FOREIGN KEY (student_id) REFERENCES users (id) ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT fk_cheating_logs_exam FOREIGN KEY (exam_id) REFERENCES exams (id) ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

/* 3) Triggers */
DELIMITER $$

CREATE TRIGGER trg_confirmed_results_update
AFTER UPDATE ON submissions
FOR EACH ROW
BEGIN
  IF NEW.instructor_confirmed = TRUE AND NEW.status = 'graded' THEN
    UPDATE results
       SET total_score = COALESCE(NEW.suggested_total_score, NEW.total_score),
           status = 'confirmed'
     WHERE results.exam_id = NEW.exam_id
       AND results.student_id = NEW.user_id;
  END IF;
END$$

CREATE TRIGGER trg_update_submission_score
AFTER UPDATE ON student_answers
FOR EACH ROW
BEGIN
  DECLARE total FLOAT DEFAULT 0;
  SELECT COALESCE(SUM(score),0) INTO total
    FROM student_answers WHERE submission_id = NEW.submission_id;

  UPDATE submissions
     SET total_score = total,
         suggested_total_score = total + COALESCE(ai_score,0)
   WHERE id = NEW.submission_id;
END$$

CREATE TRIGGER trg_check_submission_status
AFTER UPDATE ON student_answers
FOR EACH ROW
BEGIN
  DECLARE ungraded INT DEFAULT 0;
  SELECT COUNT(*) INTO ungraded
    FROM student_answers
   WHERE submission_id = NEW.submission_id
     AND graded_at IS NULL;
  IF ungraded = 0 THEN
    UPDATE submissions SET status = 'graded' WHERE id = NEW.submission_id;
  END IF;
END$$

CREATE TRIGGER trg_update_cheating_count
AFTER INSERT ON cheating_logs
FOR EACH ROW
BEGIN
  UPDATE submissions
  SET cheating_count = (
    SELECT COUNT(*) FROM cheating_logs WHERE submission_id = NEW.submission_id
  )
  WHERE id = NEW.submission_id;
END$$

DELIMITER;

/* 4) Stored Procedures */
DELIMITER $$

CREATE PROCEDURE finalize_submission(IN p_submission_id INT)
BEGIN
  DECLARE total FLOAT DEFAULT 0;
  SELECT COALESCE(SUM(score),0) INTO total
    FROM student_answers WHERE submission_id = p_submission_id;

  UPDATE submissions
     SET total_score = total,
         suggested_total_score = total + COALESCE(ai_score,0),
         status = 'graded',
         updated_at = NOW()
   WHERE id = p_submission_id;
END$$

CREATE PROCEDURE sp_submit_exam(IN p_exam_id INT, IN p_student_id INT)
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM results WHERE exam_id = p_exam_id AND student_id = p_student_id
  ) THEN
    INSERT INTO results (exam_id, student_id, status)
    VALUES (p_exam_id, p_student_id, 'pending');
  END IF;

  UPDATE submissions
     SET suggested_total_score = total_score + COALESCE(ai_score,0),
         status = 'graded'
   WHERE exam_id = p_exam_id
     AND user_id = p_student_id;
END$$

CREATE PROCEDURE sp_get_exam_results(IN p_exam_id INT, IN p_role VARCHAR(20), IN p_instructor_id INT)
BEGIN
  SELECT u.full_name AS student_name,
         s.user_id    AS student_id,
         s.status,
         COALESCE(SUM(CASE WHEN q.type='MCQ' THEN COALESCE(sa.score,0) ELSE 0 END),0) AS mcq_score,
         s.ai_score,
         COALESCE(s.suggested_total_score,
                  COALESCE(SUM(CASE WHEN q.type='MCQ' THEN COALESCE(sa.score,0) ELSE 0 END),0) + COALESCE(s.ai_score,0)) AS suggested_total_score,
         s.total_score,
         s.started_at,
         s.submitted_at,
         TIMESTAMPDIFF(MINUTE, s.started_at, s.submitted_at) AS duration_minutes,
         s.proctor_flags, s.face_image_url, s.student_card_url
  FROM submissions s
  JOIN users u ON u.id = s.user_id
  LEFT JOIN student_answers sa ON sa.submission_id = s.id
  LEFT JOIN exam_questions q ON q.id = sa.question_id
  WHERE s.exam_id = p_exam_id
  GROUP BY s.id
  ORDER BY u.full_name;
END$$

CREATE PROCEDURE sp_update_student_exam_record(
  IN p_exam_id INT,
  IN p_student_id INT,
  IN p_student_name VARCHAR(255),
  IN p_mcq_score DECIMAL(10,2),
  IN p_ai_score DECIMAL(10,2)
)
BEGIN
  START TRANSACTION;

  UPDATE submissions
     SET total_score = COALESCE(p_mcq_score, 0),
         ai_score = COALESCE(p_ai_score, 0),
         suggested_total_score = COALESCE(p_mcq_score, 0) + COALESCE(p_ai_score, 0),
         instructor_confirmed = TRUE,
         status = 'confirmed'
   WHERE exam_id = p_exam_id
     AND user_id  = p_student_id;

  UPDATE results r
  JOIN submissions s
    ON s.exam_id = r.exam_id
   AND s.user_id = r.student_id
     SET r.total_score = s.total_score,
         r.status = 'confirmed'
   WHERE r.exam_id    = p_exam_id
     AND r.student_id = p_student_id;

  IF p_student_name IS NOT NULL AND LENGTH(TRIM(p_student_name)) > 0 THEN
    UPDATE users SET full_name = p_student_name WHERE id = p_student_id;
  END IF;

  COMMIT;
END$$

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
     AND question_id IN (SELECT id FROM exam_questions WHERE exam_id = p_exam_id);

  DELETE FROM student_answers
   WHERE student_id = p_student_id
     AND question_id IN (SELECT id FROM exam_questions WHERE exam_id = p_exam_id);

  DELETE FROM submissions
   WHERE user_id = p_student_id
     AND exam_id  = p_exam_id;

  DELETE FROM results
   WHERE student_id = p_student_id
     AND exam_id    = p_exam_id;

  UPDATE users
     SET full_name = CONCAT('(Đã xóa khỏi bài thi #', p_exam_id, ')')
   WHERE id = p_student_id AND role = 'student';

  COMMIT;
END$$

CREATE PROCEDURE sp_get_exam_results(
  IN p_exam_id INT, 
  IN p_role VARCHAR(20), 
  IN p_instructor_id INT
)
BEGIN
  SELECT 
    u.full_name AS student_name,
    s.user_id AS student_id,
    s.id AS submission_id,
    s.status,
    COALESCE(SUM(CASE WHEN q.type='MCQ' THEN COALESCE(sa.score,0) ELSE 0 END), 0) AS mcq_score,
    s.ai_score,
    COALESCE(s.suggested_total_score,
             COALESCE(SUM(CASE WHEN q.type='MCQ' THEN COALESCE(sa.score,0) ELSE 0 END), 0) + COALESCE(s.ai_score, 0)) AS suggested_total_score,
    s.total_score,
    s.started_at,
    s.submitted_at,
    -- Calculate duration in seconds for better precision
    CASE 
      WHEN s.started_at IS NULL OR s.submitted_at IS NULL THEN NULL
      ELSE TIMESTAMPDIFF(SECOND, s.started_at, s.submitted_at)
    END AS duration_seconds,
    -- Keep minutes for backward compatibility
    CASE 
      WHEN s.started_at IS NULL OR s.submitted_at IS NULL THEN NULL
      ELSE TIMESTAMPDIFF(MINUTE, s.started_at, s.submitted_at)
    END AS duration_minutes,
    COALESCE(s.cheating_count, 0) AS cheating_count,
    s.proctor_flags, 
    s.face_image_url, 
    s.student_card_url,
    s.instructor_confirmed,
    CASE 
      WHEN s.face_image_url IS NOT NULL OR s.face_image_blob IS NOT NULL THEN TRUE 
      ELSE FALSE 
    END AS has_face_image,
    CASE 
      WHEN s.student_card_url IS NOT NULL OR s.student_card_blob IS NOT NULL THEN TRUE 
      ELSE FALSE 
    END AS has_student_card,
    CASE 
      WHEN COALESCE(s.cheating_count, 0) > 0 THEN TRUE 
      ELSE FALSE 
    END AS has_cheating_flag
  FROM submissions s
  JOIN users u ON u.id = s.user_id
  LEFT JOIN student_answers sa ON sa.submission_id = s.id
  LEFT JOIN exam_questions q ON q.id = sa.question_id
  WHERE s.exam_id = p_exam_id
  GROUP BY s.id, u.full_name, s.user_id, s.status, s.ai_score, s.suggested_total_score,
           s.total_score, s.started_at, s.submitted_at, s.cheating_count,
           s.proctor_flags, s.face_image_url, s.student_card_url, s.instructor_confirmed,
           s.face_image_blob, s.student_card_blob
  ORDER BY u.full_name;
END$$

DROP PROCEDURE IF EXISTS sp_get_exam_results_with_cheating$$

CREATE PROCEDURE sp_get_exam_results_with_cheating(
  IN p_exam_id INT,
  IN p_instructor_id INT
)
BEGIN
  SELECT 
    u.full_name AS student_name,
    s.user_id AS student_id,
    s.id AS submission_id,
    
    -- Scores
    COALESCE(SUM(CASE WHEN q.type='MCQ' THEN COALESCE(sa.score,0) ELSE 0 END), 0) AS mcq_score,
    s.ai_score,
    s.suggested_total_score,
    s.total_score,
    
    -- Times
    s.started_at,
    s.submitted_at,
    TIMESTAMPDIFF(MINUTE, s.started_at, s.submitted_at) AS duration_minutes,
    
    -- Cheating info
    COALESCE(s.cheating_count, 0) AS cheating_count,
    (SELECT COUNT(*) FROM cheating_logs WHERE submission_id = s.id) AS total_cheating_incidents,
    (SELECT JSON_ARRAYAGG(
      JSON_OBJECT(
        'event_type', event_type,
        'detected_at', detected_at,
        'severity', severity,
        'details', event_details
      )
    ) FROM cheating_logs WHERE submission_id = s.id ORDER BY detected_at DESC) AS cheating_details,
    
    -- Images
    s.face_image_url,
    s.face_image_blob,
    s.face_image_mimetype,
    s.student_card_url,
    s.student_card_blob,
    s.student_card_mimetype,
    
    -- Status
    s.status,
    s.instructor_confirmed,
    s.proctor_flags,
    
    -- Flags for UI
    CASE 
      WHEN s.face_image_url IS NOT NULL OR s.face_image_blob IS NOT NULL THEN TRUE 
      ELSE FALSE 
    END AS has_face_image,
    CASE 
      WHEN s.student_card_url IS NOT NULL OR s.student_card_blob IS NOT NULL THEN TRUE 
      ELSE FALSE 
    END AS has_student_card,
    CASE 
      WHEN COALESCE(s.cheating_count, 0) > 0 THEN TRUE 
      ELSE FALSE 
    END AS has_cheating_flag
    
  FROM submissions s
  JOIN users u ON u.id = s.user_id
  LEFT JOIN student_answers sa ON sa.submission_id = s.id
  LEFT JOIN exam_questions q ON q.id = sa.question_id
  WHERE s.exam_id = p_exam_id
  GROUP BY s.id, u.id, u.full_name, s.user_id, s.ai_score, s.suggested_total_score, 
           s.total_score, s.started_at, s.submitted_at, s.status, s.instructor_confirmed,
           s.cheating_count, s.face_image_url, s.face_image_blob, s.face_image_mimetype,
           s.student_card_url, s.student_card_blob, s.student_card_mimetype, s.proctor_flags
  ORDER BY u.full_name;
END$$

CREATE PROCEDURE sp_get_exam_results(
  IN p_exam_id INT,
  IN p_role VARCHAR(20),
  IN p_instructor_id INT
)
BEGIN
  -- Validate ownership if instructor
  IF p_role = 'instructor' THEN
    IF NOT EXISTS (
      SELECT 1 
      FROM exams 
      WHERE id = p_exam_id 
        AND instructor_id = p_instructor_id
    ) THEN
      SIGNAL SQLSTATE '45000' 
      SET MESSAGE_TEXT = 'Not authorized to view this exam';
    END IF;
  END IF;

  -- Return ONE BEST submission per student with all required columns
  SELECT
    u.full_name AS student_name,
    s.user_id AS student_id,
    s.id AS submission_id,
    s.status,
    s.total_score,
    s.ai_score,
    s.suggested_total_score,
    s.started_at,
    s.submitted_at,
    s.instructor_confirmed,
    TIMESTAMPDIFF(SECOND, s.started_at, s.submitted_at) AS duration_seconds,
    TIMESTAMPDIFF(MINUTE, s.started_at, s.submitted_at) AS duration_minutes,
    -- Cheating: lấy số lần gian lận cao nhất trong các lần thi
    (SELECT MAX(cheating_count) FROM submissions s2 WHERE s2.exam_id = s.exam_id AND s2.user_id = s.user_id) AS cheating_count,
    CASE WHEN (SELECT MAX(cheating_count) FROM submissions s2 WHERE s2.exam_id = s.exam_id AND s2.user_id = s.user_id) > 0 THEN TRUE ELSE FALSE END AS has_cheating_flag,
    CASE WHEN s.face_image_url IS NOT NULL OR s.face_image_blob IS NOT NULL THEN TRUE ELSE FALSE END AS has_face_image,
    CASE WHEN s.student_card_url IS NOT NULL OR s.student_card_blob IS NOT NULL THEN TRUE ELSE FALSE END AS has_student_card
  FROM submissions s
  JOIN users u ON u.id = s.user_id
  WHERE s.exam_id = p_exam_id
    AND s.id = (
      SELECT s2.id FROM submissions s2
      WHERE s2.exam_id = s.exam_id AND s2.user_id = s.user_id
      ORDER BY COALESCE(s2.total_score, s2.suggested_total_score, 0) DESC, s2.id DESC
      LIMIT 1
    )
  ORDER BY u.full_name ASC;

END$$

DELIMITER;

/* 5) Views */

-- 5.1 Tổng quan exam
CREATE OR REPLACE VIEW v_exam_overview AS
SELECT
    e.id AS exam_id,
    e.title AS exam_title,
    e.status,
    e.exam_room_code,
    e.instructor_id,
    u.full_name AS instructor_name,
    COUNT(s.id) AS total_submissions,
    AVG(s.total_score) AS avg_score,
    MAX(s.updated_at) AS last_activity
FROM
    exams e
    LEFT JOIN users u ON u.id = e.instructor_id
    LEFT JOIN submissions s ON s.exam_id = e.id
GROUP BY
    e.id,
    e.title,
    e.status,
    e.exam_room_code,
    e.instructor_id,
    u.full_name;

-- 5.2 Ngân hàng đề
CREATE OR REPLACE VIEW v_instructor_exam_bank AS
SELECT
    e.id AS exam_id,
    e.title AS exam_title,
    e.status AS exam_status,
    e.created_at,
    e.updated_at,
    u.full_name AS instructor_name,
    COUNT(eq.id) AS total_questions
FROM
    exams e
    JOIN users u ON u.id = e.instructor_id
    LEFT JOIN exam_questions eq ON eq.exam_id = e.id
GROUP BY
    e.id,
    e.title,
    e.status,
    e.created_at,
    e.updated_at,
    u.full_name
ORDER BY e.updated_at DESC;

-- 5.3 Danh sách bài nộp cho instructor
CREATE OR REPLACE VIEW v_instructor_assigned_exams AS
SELECT
    e.id AS exam_id,
    e.title AS exam_title,
    u.full_name AS instructor_name,
    s.user_id AS student_id,
    stu.full_name AS student_name,
    s.total_score AS mcq_score,
    s.ai_score AS ai_score,
    r.total_score AS final_score,
    s.status AS submission_status,
    s.submitted_at AS student_submitted_at
FROM
    submissions s
    JOIN exams e ON s.exam_id = e.id
    JOIN users u ON e.instructor_id = u.id
    JOIN users stu ON stu.id = s.user_id
    LEFT JOIN results r ON r.exam_id = e.id
    AND r.student_id = stu.id
ORDER BY e.id, s.submitted_at DESC;

-- 5.4 Dashboard sinh viên
CREATE OR REPLACE VIEW v_student_results AS
SELECT
    e.title AS exam_title,
    COALESCE(
        r.total_score,
        s.suggested_total_score
    ) AS display_score,
    CASE
        WHEN r.status = 'confirmed' THEN 'Final Score (Confirmed)'
        WHEN s.status = 'graded' THEN 'Suggested Score (Awaiting Instructor Approval)'
        ELSE 'Pending Grading'
    END AS score_status,
    s.submitted_at,
    e.duration_minutes AS duration
FROM
    submissions s
    JOIN exams e ON e.id = s.exam_id
    LEFT JOIN results r ON r.exam_id = e.id
    AND r.student_id = s.user_id
WHERE
    s.user_id IN (
        SELECT id
        FROM users
        WHERE
            role = 'student'
    );

-- 5.5 Admin overview
CREATE OR REPLACE VIEW v_admin_overview AS
SELECT
    e.instructor_id,
    u.full_name AS instructor_name,
    e.title AS exam_title,
    COUNT(s.id) AS total_submissions,
    AVG(s.suggested_total_score) AS avg_score,
    SUM(
        CASE
            WHEN s.status = 'confirmed' THEN 1
            ELSE 0
        END
    ) AS confirmed_count
FROM
    exams e
    JOIN users u ON u.id = e.instructor_id
    LEFT JOIN submissions s ON s.exam_id = e.id
GROUP BY
    e.id,
    e.instructor_id,
    u.full_name,
    e.title;

-- 5.6 Chi tiết câu hỏi
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

-- 5.7 View tiện ích
CREATE OR REPLACE VIEW v_student_result_overview AS
SELECT
    u.id AS student_id,
    u.full_name,
    e.title AS exam_title,
    s.id AS submission_id,
    s.total_score,
    s.status,
    s.updated_at AS graded_at
FROM
    submissions s
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

CREATE OR REPLACE VIEW v_instructor_stats AS
SELECT
    e.instructor_id,
    COUNT(DISTINCT e.id) AS total_exams,
    COUNT(s.id) AS total_submissions,
    COUNT(DISTINCT s.user_id) AS total_students
FROM exams e
    LEFT JOIN submissions s ON s.exam_id = e.id
GROUP BY
    e.instructor_id;

CREATE OR REPLACE VIEW v_exam_cheating_summary AS
SELECT
    e.id AS exam_id,
    e.title AS exam_title,
    s.id AS submission_id,
    u.id AS student_id,
    u.full_name AS student_name,
    s.cheating_count,
    COUNT(cl.id) AS total_incidents,
    GROUP_CONCAT(
        DISTINCT cl.event_type
        ORDER BY cl.detected_at SEPARATOR ', '
    ) AS incident_types,
    MIN(cl.detected_at) AS first_incident,
    MAX(cl.detected_at) AS last_incident,
    SUM(
        CASE
            WHEN cl.severity = 'high' THEN 1
            ELSE 0
        END
    ) AS high_severity_count,
    SUM(
        CASE
            WHEN cl.severity = 'medium' THEN 1
            ELSE 0
        END
    ) AS medium_severity_count,
    SUM(
        CASE
            WHEN cl.severity = 'low' THEN 1
            ELSE 0
        END
    ) AS low_severity_count
FROM
    submissions s
    JOIN exams e ON e.id = s.exam_id
    JOIN users u ON u.id = s.user_id
    LEFT JOIN cheating_logs cl ON cl.submission_id = s.id
GROUP BY
    e.id,
    e.title,
    s.id,
    u.id,
    u.full_name,
    s.cheating_count
HAVING
    s.cheating_count > 0
    OR COUNT(cl.id) > 0
ORDER BY total_incidents DESC, s.submitted_at DESC;
/* 6) Finish */
SELECT '✅ Schema created/updated successfully (MySQL 8.0, no syntax errors)' AS message;

-- collating cheating_count column addition and related objects
SET @col_exists = 0;

SELECT COUNT(*) INTO @col_exists
FROM information_schema.COLUMNS
WHERE
    TABLE_SCHEMA = 'oem_mini'
    AND TABLE_NAME = 'submissions'
    AND COLUMN_NAME = 'cheating_count';

SET
    @sql = IF(
        @col_exists = 0,
        'ALTER TABLE submissions ADD COLUMN cheating_count INT DEFAULT 0 COMMENT "Total number of cheating incidents"',
        'SELECT "Column cheating_count already exists" AS message'
    );

PREPARE stmt FROM @sql;

EXECUTE stmt;

DEALLOCATE PREPARE stmt;
-- End of oem_migration_v5.sql


/* ----------------------------------------------------------------
   Updated: sp_delete_student_exam_record (Safe Delete - No User Rename)
   ---------------------------------------------------------------- */
DELIMITER $$

DROP PROCEDURE IF EXISTS sp_delete_student_exam_record$$

CREATE PROCEDURE sp_delete_student_exam_record(
  IN p_exam_id INT,
  IN p_student_id INT
)
BEGIN
  DECLARE exit HANDLER FOR SQLEXCEPTION
  BEGIN
    ROLLBACK;
    RESIGNAL;
  END;

  START TRANSACTION;

  DELETE FROM ai_logs
   WHERE student_id = p_student_id
     AND question_id IN (SELECT id FROM exam_questions WHERE exam_id = p_exam_id);

  DELETE FROM student_answers
   WHERE student_id = p_student_id
     AND question_id IN (SELECT id FROM exam_questions WHERE exam_id = p_exam_id);

  DELETE FROM submissions
   WHERE user_id = p_student_id
     AND exam_id  = p_exam_id;

  DELETE FROM results
   WHERE student_id = p_student_id
     AND exam_id    = p_exam_id;

  COMMIT;
END$$

DELIMITER ;
