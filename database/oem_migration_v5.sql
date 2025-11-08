-- ============================================================================
-- 🧩 OEM Mini Database Schema (v5.1 - Full Clean Version)
-- Engine: MySQL 8.0.x+
-- Charset: utf8mb4 / utf8mb4_unicode_ci
-- ============================================================================

-- Tạo mới database từ đầu
DROP DATABASE IF EXISTS oem_mini;
CREATE DATABASE oem_mini CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE oem_mini;

-- ====================================================================
-- 1) USERS
-- ====================================================================
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

-- ====================================================================
-- 2) EXAMS (KHÔNG dùng bảng courses nữa; gắn trực tiếp instructor)
-- ====================================================================
CREATE TABLE exams (
  id INT AUTO_INCREMENT PRIMARY KEY,
  instructor_id INT UNSIGNED NOT NULL,
  title VARCHAR(100) NOT NULL,
  duration INT NOT NULL CHECK (duration > 0),
  exam_room_code VARCHAR(64) NULL,
  status ENUM('draft','published','archived') DEFAULT 'draft',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL,
  UNIQUE KEY uq_exams_room_code (exam_room_code),
  INDEX idx_exams_instructor (instructor_id),
  CONSTRAINT fk_exams_instructor
    FOREIGN KEY (instructor_id) REFERENCES users(id)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ====================================================================
-- 3) EXAM_QUESTIONS
-- ====================================================================
CREATE TABLE exam_questions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  exam_id INT NOT NULL,
  question_text TEXT NOT NULL,
  type ENUM('MCQ','Essay','Unknown') DEFAULT 'Unknown',
  model_answer TEXT NULL,
  points FLOAT DEFAULT 1 CHECK (points >= 0),
  order_index INT NULL,
  created_by INT UNSIGNED NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_exam_questions_exam (exam_id),
  INDEX idx_exam_questions_type (type),
  CONSTRAINT fk_exam_questions_exam
    FOREIGN KEY (exam_id) REFERENCES exams(id)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_exam_questions_user
    FOREIGN KEY (created_by) REFERENCES users(id)
    ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ====================================================================
-- 4) EXAM_OPTIONS
-- ====================================================================
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

-- ====================================================================
-- 5) SUBMISSIONS
-- ====================================================================
CREATE TABLE submissions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  exam_id INT NOT NULL,
  user_id INT UNSIGNED NOT NULL,
  submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  total_score FLOAT DEFAULT 0 CHECK (total_score >= 0),
  ai_score FLOAT NULL,
  suggested_total_score FLOAT NULL,
  instructor_confirmed BOOLEAN DEFAULT FALSE,
  status ENUM('pending','graded','confirmed') DEFAULT 'pending',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_submissions_exam (exam_id),
  INDEX idx_submissions_user (user_id),
  INDEX idx_submissions_status (status),
  CONSTRAINT fk_submissions_exam
    FOREIGN KEY (exam_id) REFERENCES exams(id)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_submissions_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ====================================================================
-- 6) STUDENT_ANSWERS
-- ====================================================================
CREATE TABLE student_answers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  student_id INT UNSIGNED NOT NULL,
  question_id INT NOT NULL,
  answer_text TEXT NULL,
  selected_option_id INT NULL,
  score FLOAT DEFAULT 0 CHECK (score >= 0),
  status ENUM('pending','graded','confirmed') DEFAULT 'pending',
  submission_id INT NULL,
  graded_at DATETIME NULL,
  INDEX idx_student_answers_student (student_id),
  INDEX idx_student_answers_question (question_id),
  INDEX idx_student_answers_submission (submission_id),
  INDEX idx_student_answers_selected_option (selected_option_id),
  INDEX idx_student_answers_graded_at (graded_at),
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

-- ====================================================================
-- 7) RESULTS
-- ====================================================================
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

-- ====================================================================
-- 8) AI_LOGS
-- ====================================================================
CREATE TABLE ai_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  question_id INT NOT NULL,
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
  CONSTRAINT fk_ai_logs_question
    FOREIGN KEY (question_id) REFERENCES exam_questions(id)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_ai_logs_student
    FOREIGN KEY (student_id) REFERENCES users(id)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ====================================================================
-- 9) ENROLLMENTS (đăng ký user vào exam)
-- ====================================================================
CREATE TABLE enrollments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  exam_id INT NOT NULL,
  enrolled_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  status ENUM('active','cancelled') DEFAULT 'active',
  UNIQUE KEY uq_enrollment_user_exam (user_id, exam_id),
  INDEX idx_enrollments_user (user_id),
  INDEX idx_enrollments_exam (exam_id),
  CONSTRAINT fk_enrollments_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_enrollments_exam
    FOREIGN KEY (exam_id) REFERENCES exams(id)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ====================================================================
-- 10) IMPORT JOBS & ROWS (phục vụ import đề từ Excel/JSON)
-- ====================================================================
CREATE TABLE import_jobs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  job_uuid VARCHAR(64) NOT NULL UNIQUE,
  exam_id INT NOT NULL,
  created_by INT UNSIGNED NULL,
  status ENUM('preview','processing','completed','failed') DEFAULT 'preview',
  preview_json LONGTEXT NULL,
  result_summary JSON NULL,
  error_text TEXT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_import_jobs_exam (exam_id),
  INDEX idx_import_jobs_user (created_by),
  CONSTRAINT fk_import_jobs_exam
    FOREIGN KEY (exam_id) REFERENCES exams(id)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_import_jobs_user
    FOREIGN KEY (created_by) REFERENCES users(id)
    ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS import_rows;

CREATE TABLE import_rows (
  id INT AUTO_INCREMENT PRIMARY KEY,
  job_id INT NOT NULL,
  `row_number` INT NOT NULL,
  row_data LONGTEXT NOT NULL,
  errors LONGTEXT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_import_rows_job (job_id),
  CONSTRAINT fk_import_rows_job
    FOREIGN KEY (job_id) REFERENCES import_jobs(id)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ====================================================================
-- 11) REFRESH TOKENS
-- ====================================================================
CREATE TABLE refresh_tokens (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  token VARCHAR(500) NOT NULL,
  revoked BOOLEAN DEFAULT FALSE,
  expires_at DATETIME NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_refresh_tokens_user (user_id),
  UNIQUE KEY uq_refresh_token_token (token),
  CONSTRAINT fk_refresh_tokens_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ====================================================================
-- 12) USER VERIFIED ROOMS (thay cho FK BOOLEAN verify_room_code)
-- ====================================================================
CREATE TABLE user_verified_rooms (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  exam_room_code VARCHAR(64) NOT NULL,
  verified_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_uvr_user FOREIGN KEY (user_id)
    REFERENCES users(id)
    ON UPDATE CASCADE ON DELETE CASCADE,
  UNIQUE KEY uq_user_room (user_id, exam_room_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ====================================================================
-- TRIGGERS
-- ====================================================================
DELIMITER $$

-- Cập nhật tổng điểm submission khi chấm điểm từng câu
DROP TRIGGER IF EXISTS trg_update_submission_score $$
CREATE TRIGGER trg_update_submission_score
AFTER UPDATE ON student_answers
FOR EACH ROW
BEGIN
  DECLARE total FLOAT;
  IF NEW.submission_id IS NOT NULL THEN
    SELECT COALESCE(SUM(score),0) INTO total
    FROM student_answers
    WHERE submission_id = NEW.submission_id;
    UPDATE submissions SET total_score = total WHERE id = NEW.submission_id;
  END IF;
END$$

-- Tự chuyển trạng thái submission sang 'graded' khi tất cả câu đã có graded_at
DROP TRIGGER IF EXISTS trg_check_submission_status $$
CREATE TRIGGER trg_check_submission_status
AFTER UPDATE ON student_answers
FOR EACH ROW
BEGIN
  DECLARE ungraded INT;
  IF NEW.submission_id IS NOT NULL THEN
    SELECT COUNT(*) INTO ungraded
    FROM student_answers
    WHERE submission_id = NEW.submission_id AND graded_at IS NULL;
    IF ungraded = 0 THEN
      UPDATE submissions SET status = 'graded' WHERE id = NEW.submission_id;
    END IF;
  END IF;
END$$

-- Khi instructor xác nhận bài thi, cập nhật kết quả cuối cùng
DROP TRIGGER IF EXISTS trg_confirmed_results_update $$
CREATE TRIGGER trg_confirmed_results_update
AFTER UPDATE ON submissions
FOR EACH ROW
BEGIN
  IF NEW.instructor_confirmed = TRUE AND NEW.status = 'graded' THEN
    UPDATE results
    SET total_score = COALESCE(NEW.suggested_total_score, NEW.total_score),
        status = 'confirmed'
    WHERE exam_id = NEW.exam_id
      AND student_id = NEW.user_id;
  END IF;
END$$

DELIMITER ;

-- ====================================================================
-- STORED PROCEDURES
-- ====================================================================
DELIMITER $$

-- 1) Sinh kết quả nếu chưa có và chốt điểm gợi ý
DROP PROCEDURE IF EXISTS sp_submit_exam $$
CREATE PROCEDURE sp_submit_exam(IN p_exam_id INT, IN p_student_id INT UNSIGNED)
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM results WHERE exam_id = p_exam_id AND student_id = p_student_id
  ) THEN
    INSERT INTO results (exam_id, student_id, status)
    VALUES (p_exam_id, p_student_id, 'pending');
  END IF;

  UPDATE submissions
  SET suggested_total_score = COALESCE(total_score,0) + COALESCE(ai_score,0),
      status = 'graded',
      updated_at = NOW()
  WHERE exam_id = p_exam_id AND user_id = p_student_id;
END$$

-- 2) Lấy kết quả theo vai trò (không còn courses)
DROP PROCEDURE IF EXISTS sp_get_exam_results $$
CREATE PROCEDURE sp_get_exam_results(IN examId INT, IN userRole VARCHAR(20), IN userId INT UNSIGNED)
BEGIN
  IF userRole = 'student' THEN
    SELECT r.id,
           e.title AS exam_title,
           COALESCE(r.total_score, s.suggested_total_score) AS display_score,
           CASE 
             WHEN r.status='confirmed' THEN 'Final Score (Confirmed)'
             WHEN s.status='graded' THEN 'Suggested Score (Awaiting Instructor Approval)'
             ELSE 'Pending Grading'
           END AS score_status
    FROM results r
    JOIN exams e ON e.id = r.exam_id
    JOIN submissions s ON s.exam_id = e.id AND s.user_id = r.student_id
    WHERE r.exam_id = examId AND r.student_id = userId;

  ELSEIF userRole = 'instructor' THEN
    SELECT r.id,
           u.full_name AS student_name,
           r.total_score,
           r.status,
           s.total_score AS mcq_score,
           s.ai_score AS ai_score,
           s.suggested_total_score
    FROM results r
    JOIN users u ON u.id = r.student_id
    JOIN submissions s ON s.exam_id = r.exam_id AND s.user_id = r.student_id
    WHERE r.exam_id = examId;

  ELSEIF userRole = 'admin' THEN
    SELECT r.*, u.full_name AS student_name, e.title AS exam_title
    FROM results r
    JOIN users u ON u.id = r.student_id
    JOIN exams e ON e.id = r.exam_id
    WHERE r.exam_id = examId;
  END IF;
END$$

-- 3) Cập nhật bản ghi của học viên trong một bài thi
DROP PROCEDURE IF EXISTS sp_update_student_exam_record $$
CREATE PROCEDURE sp_update_student_exam_record(
  IN p_exam_id INT,
  IN p_student_id INT UNSIGNED,
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
      status = 'confirmed',
      updated_at = NOW()
  WHERE exam_id = p_exam_id AND user_id = p_student_id;

  INSERT INTO results (exam_id, student_id, total_score, status)
  VALUES (p_exam_id, p_student_id, p_new_mcq_score + COALESCE(p_new_ai_score,0), 'confirmed')
  ON DUPLICATE KEY UPDATE
    total_score = VALUES(total_score),
    status = 'confirmed';

  COMMIT;
END$$

-- 4) Xóa dữ liệu của học viên trong một bài thi (ẩn tên)
DROP PROCEDURE IF EXISTS sp_delete_student_exam_record $$
CREATE PROCEDURE sp_delete_student_exam_record(
  IN p_exam_id INT,
  IN p_student_id INT UNSIGNED
)
BEGIN
  DECLARE EXIT HANDLER FOR SQLEXCEPTION
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
  WHERE user_id = p_student_id AND exam_id = p_exam_id;

  DELETE FROM results
  WHERE student_id = p_student_id AND exam_id = p_exam_id;

  UPDATE users
  SET full_name = CONCAT('(Đã xóa khỏi bài thi #', p_exam_id, ')')
  WHERE id = p_student_id AND role = 'student';

  COMMIT;
END$$

-- 5) finalize_submission: tổng hợp điểm và chốt trạng thái graded
DROP PROCEDURE IF EXISTS finalize_submission $$
CREATE PROCEDURE finalize_submission(IN submissionId INT)
BEGIN
  DECLARE total FLOAT;
  SELECT COALESCE(SUM(score),0) INTO total
  FROM student_answers
  WHERE submission_id = submissionId;

  UPDATE submissions
  SET total_score = total,
      status = 'graded',
      updated_at = NOW()
  WHERE id = submissionId;
END$$

-- 6) import_exam_from_job: import hàng loạt câu hỏi từ import_rows.row_data (JSON)
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
      COALESCE(JSON_UNQUOTE(JSON_EXTRACT(q, '$.type')), 'Unknown'),
      COALESCE(JSON_EXTRACT(q, '$.points'), 1),
      NOW()
    );
  END LOOP;
  CLOSE cur;

  UPDATE import_jobs
  SET status = 'completed', updated_at = NOW()
  WHERE id = jobId;
END$$

DELIMITER ;

-- ====================================================================
-- VIEWS
-- ====================================================================
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

CREATE OR REPLACE VIEW v_instructor_assigned_exams AS
SELECT 
  e.id AS exam_id,
  e.title AS exam_title,
  i.full_name AS instructor_name,
  s.user_id AS student_id,
  stu.full_name AS student_name,
  s.total_score AS mcq_score,
  s.ai_score AS ai_score,
  r.total_score AS final_score,
  s.status AS submission_status,
  s.submitted_at AS student_submitted_at
FROM submissions s
JOIN exams e ON s.exam_id = e.id
JOIN users i ON i.id = e.instructor_id
JOIN users stu ON stu.id = s.user_id
LEFT JOIN results r ON r.exam_id = e.id AND r.student_id = stu.id
WHERE e.status IN ('draft','published','archived') -- tùy nhu cầu lọc
ORDER BY e.id, s.submitted_at DESC;

CREATE OR REPLACE VIEW v_instructor_stats AS
SELECT
  e.instructor_id,
  COUNT(DISTINCT e.id) AS total_exams,
  COUNT(s.id) AS total_submissions,
  COUNT(DISTINCT s.user_id) AS total_students
FROM exams e
LEFT JOIN submissions s ON s.exam_id = e.id
GROUP BY e.instructor_id;

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

CREATE OR REPLACE VIEW v_ai_logs_trace AS
SELECT 
  id AS log_id,
  request_payload,
  response_payload,
  error_text,
  created_at
FROM ai_logs
ORDER BY created_at DESC;

-- Hoàn tất
SELECT '✅ OEM Mini database created/updated successfully (v5.1 full clean)' AS message;