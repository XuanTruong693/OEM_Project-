-- ============================================================================
-- 🔐 OEM Admin Database - Complete Setup Script
-- Gộp: Schema + Views
-- Chạy 1 lần duy nhất, không lỗi
-- Engine: MySQL 8.0.x
-- Author: OEM Mini Team (Capstone Project 2025 - CMU-SE)
-- ============================================================================

-- ============================================================================
-- PHẦN 1: TẠO DATABASE OEM_ADMIN VÀ CÁC BẢNG
-- ============================================================================

-- Tạo database admin nếu chưa tồn tại
CREATE DATABASE IF NOT EXISTS oem_admin 
CHARACTER SET utf8mb4 
COLLATE utf8mb4_unicode_ci;

USE oem_admin;

-- ============================================================================
-- 1. admin_activity_logs - Log hoạt động Admin
-- ============================================================================
CREATE TABLE IF NOT EXISTS admin_activity_logs (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    admin_id INT UNSIGNED NOT NULL COMMENT 'ID từ oem_mini.users',
    admin_email VARCHAR(120) NOT NULL COMMENT 'Email admin (denormalized)',
    action_type ENUM('login','logout','create','update','delete','backup','restore','view') NOT NULL,
    target_table VARCHAR(50) NULL COMMENT 'Bảng bị tác động',
    target_id INT UNSIGNED NULL COMMENT 'ID record bị tác động',
    old_value JSON NULL COMMENT 'Giá trị cũ (cho update/delete)',
    new_value JSON NULL COMMENT 'Giá trị mới (cho create/update)',
    ip_address VARCHAR(45) NULL COMMENT 'Địa chỉ IP',
    user_agent VARCHAR(500) NULL COMMENT 'Browser/Device info',
    description TEXT NULL COMMENT 'Mô tả chi tiết hành động',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_admin_id (admin_id),
    INDEX idx_action_type (action_type),
    INDEX idx_created_at (created_at),
    INDEX idx_target_table (target_table)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

-- ============================================================================
-- 2. backup_metadata - Metadata Backup
-- ============================================================================
CREATE TABLE IF NOT EXISTS backup_metadata (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    backup_type ENUM('manual','scheduled','before_restore') NOT NULL,
    file_name VARCHAR(255) NOT NULL COMMENT 'Tên file backup',
    file_path VARCHAR(500) NOT NULL COMMENT 'Đường dẫn file (relative)',
    file_size BIGINT NULL COMMENT 'Kích thước file (bytes)',
    performed_by INT UNSIGNED NULL COMMENT 'ID admin (NULL nếu scheduled)',
    performed_by_email VARCHAR(120) NULL COMMENT 'Email admin',
    status ENUM('in_progress','completed','failed') DEFAULT 'in_progress',
    error_message TEXT NULL COMMENT 'Thông báo lỗi (nếu có)',
    started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    completed_at DATETIME NULL,
    tables_count INT NULL COMMENT 'Số bảng được backup',
    records_count BIGINT NULL COMMENT 'Tổng số records',
    checksum VARCHAR(64) NULL COMMENT 'SHA256 checksum của file',
    db_name VARCHAR(50) DEFAULT 'oem_mini' COMMENT 'Tên database được backup',
    
    INDEX idx_backup_type (backup_type),
    INDEX idx_status (status),
    INDEX idx_started_at (started_at)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

-- ============================================================================
-- 3. restore_history - Lịch sử Restore
-- ============================================================================
CREATE TABLE IF NOT EXISTS restore_history (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    backup_id INT UNSIGNED NOT NULL COMMENT 'FK → backup_metadata.id',
    performed_by INT UNSIGNED NOT NULL COMMENT 'ID admin',
    performed_by_email VARCHAR(120) NOT NULL COMMENT 'Email admin',
    status ENUM('in_progress','completed','failed') DEFAULT 'in_progress',
    error_message TEXT NULL COMMENT 'Thông báo lỗi (nếu có)',
    started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    completed_at DATETIME NULL,
    pre_restore_backup_id INT UNSIGNED NULL COMMENT 'Backup tự động trước khi restore',
    
    INDEX idx_backup_id (backup_id),
    INDEX idx_performed_by (performed_by),
    INDEX idx_started_at (started_at),
    
    CONSTRAINT fk_restore_backup FOREIGN KEY (backup_id) 
        REFERENCES backup_metadata(id) ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_restore_pre_backup FOREIGN KEY (pre_restore_backup_id) 
        REFERENCES backup_metadata(id) ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

-- ============================================================================
-- 4. suspicious_activities - Hoạt động đáng ngờ
-- ============================================================================
CREATE TABLE IF NOT EXISTS suspicious_activities (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id INT UNSIGNED NOT NULL COMMENT 'ID từ oem_mini.users',
    user_email VARCHAR(120) NOT NULL COMMENT 'Email user',
    activity_type ENUM('mass_delete','failed_login','rapid_restore','unusual_access','data_export') NOT NULL,
    severity ENUM('low','medium','high','critical') DEFAULT 'medium',
    description TEXT NULL COMMENT 'Mô tả chi tiết',
    metadata JSON NULL COMMENT 'Dữ liệu bổ sung',
    ip_address VARCHAR(45) NULL COMMENT 'Địa chỉ IP',
    detected_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    is_reviewed BOOLEAN DEFAULT FALSE COMMENT 'Đã xem xét chưa',
    reviewed_by INT UNSIGNED NULL COMMENT 'ID admin đã xem xét',
    reviewed_at DATETIME NULL,
    action_taken TEXT NULL COMMENT 'Hành động đã thực hiện',
    
    INDEX idx_user_id (user_id),
    INDEX idx_activity_type (activity_type),
    INDEX idx_severity (severity),
    INDEX idx_detected_at (detected_at),
    INDEX idx_is_reviewed (is_reviewed)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

-- ============================================================================
-- 5. admin_settings - Cài đặt Admin
-- ============================================================================
CREATE TABLE IF NOT EXISTS admin_settings (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    setting_key VARCHAR(100) NOT NULL UNIQUE COMMENT 'Key cài đặt',
    setting_value JSON NOT NULL COMMENT 'Giá trị cài đặt',
    description TEXT NULL COMMENT 'Mô tả',
    updated_by INT UNSIGNED NULL COMMENT 'ID admin',
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

-- ============================================================================
-- 6. user_preferences - Tùy chọn người dùng
-- ============================================================================
CREATE TABLE IF NOT EXISTS user_preferences (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id INT UNSIGNED NOT NULL UNIQUE COMMENT 'ID từ oem_mini.users',
    theme ENUM('dark','light') DEFAULT 'dark' COMMENT 'Theme hiện tại',
    language VARCHAR(10) DEFAULT 'vi' COMMENT 'Ngôn ngữ',
    notifications JSON NULL COMMENT 'Cài đặt thông báo',
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_user_id (user_id)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

-- ============================================================================
-- 7. Insert default settings
-- ============================================================================
INSERT INTO admin_settings (setting_key, setting_value, description) VALUES
('user_growth_target_yearly', '1000', 'Mục tiêu số người dùng mới trong năm'),
('backup_schedule', '{"enabled": true, "time": "01:00", "retention_days": 30}', 'Cấu hình backup tự động'),
('suspicious_thresholds', '{"mass_delete": 10, "failed_login": 5, "restore_frequency": 3}', 'Ngưỡng phát hiện hành vi đáng ngờ')
ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value);

SELECT '✅ Database oem_admin đã được tạo thành công!' AS message;


-- ============================================================================
-- PHẦN 2: TẠO VIEWS TRONG DATABASE OEM_MINI
-- ============================================================================

USE oem_mini;

-- ============================================================================
-- 1. v_admin_dashboard_stats - Thống kê tổng quan Dashboard
-- ============================================================================
DROP VIEW IF EXISTS v_admin_dashboard_stats;

CREATE VIEW v_admin_dashboard_stats AS
SELECT
    -- Tổng số người dùng theo role
    (SELECT COUNT(*) FROM users WHERE role = 'student') AS total_students,
    (SELECT COUNT(*) FROM users WHERE role = 'instructor') AS total_instructors,
    (SELECT COUNT(*) FROM users WHERE role = 'admin') AS total_admins,
    
    -- Tổng số bài thi
    (SELECT COUNT(*) FROM exams) AS total_exams,
    (SELECT COUNT(*) FROM exams WHERE status = 'published') AS published_exams,
    
    -- Rooms (dựa trên exams có exam_room_code)
    (SELECT COUNT(*) FROM exams WHERE exam_room_code IS NOT NULL) AS total_rooms,
    (SELECT COUNT(*) FROM exams WHERE status = 'published' AND exam_room_code IS NOT NULL) AS published_rooms,
    
    -- Sinh viên tháng này và tháng trước
    (SELECT COUNT(*) FROM users 
     WHERE role = 'student' 
     AND YEAR(created_at) = YEAR(CURRENT_DATE) 
     AND MONTH(created_at) = MONTH(CURRENT_DATE)) AS students_this_month,
    (SELECT COUNT(*) FROM users 
     WHERE role = 'student' 
     AND created_at >= DATE_SUB(DATE_FORMAT(CURRENT_DATE, '%Y-%m-01'), INTERVAL 1 MONTH)
     AND created_at < DATE_FORMAT(CURRENT_DATE, '%Y-%m-01')) AS students_last_month,
    
    -- Giảng viên tháng này và tháng trước
    (SELECT COUNT(*) FROM users 
     WHERE role = 'instructor' 
     AND YEAR(created_at) = YEAR(CURRENT_DATE) 
     AND MONTH(created_at) = MONTH(CURRENT_DATE)) AS instructors_this_month,
    (SELECT COUNT(*) FROM users 
     WHERE role = 'instructor' 
     AND created_at >= DATE_SUB(DATE_FORMAT(CURRENT_DATE, '%Y-%m-01'), INTERVAL 1 MONTH)
     AND created_at < DATE_FORMAT(CURRENT_DATE, '%Y-%m-01')) AS instructors_last_month,
    
    -- Bài thi tháng này và tháng trước
    (SELECT COUNT(*) FROM exams 
     WHERE YEAR(created_at) = YEAR(CURRENT_DATE) 
     AND MONTH(created_at) = MONTH(CURRENT_DATE)) AS exams_this_month,
    (SELECT COUNT(*) FROM exams 
     WHERE created_at >= DATE_SUB(DATE_FORMAT(CURRENT_DATE, '%Y-%m-01'), INTERVAL 1 MONTH)
     AND created_at < DATE_FORMAT(CURRENT_DATE, '%Y-%m-01')) AS exams_last_month;

-- ============================================================================
-- 2. v_monthly_user_growth - Tăng trưởng người dùng theo tháng (12 tháng gần nhất)
-- ============================================================================
DROP VIEW IF EXISTS v_monthly_user_growth;

CREATE VIEW v_monthly_user_growth AS
SELECT 
    YEAR(created_at) AS year,
    MONTH(created_at) AS month,
    DATE_FORMAT(created_at, '%b') AS month_name,
    COUNT(*) AS new_users,
    (SELECT COUNT(*) FROM users u2 
     WHERE u2.created_at <= LAST_DAY(u1.created_at)) AS cumulative_users
FROM users u1
WHERE created_at >= DATE_SUB(CURRENT_DATE, INTERVAL 12 MONTH)
GROUP BY YEAR(created_at), MONTH(created_at), DATE_FORMAT(created_at, '%b'), LAST_DAY(created_at)
ORDER BY year DESC, month DESC;

-- ============================================================================
-- 3. v_upcoming_exams_admin - Bài thi sắp/đang diễn ra cho Admin
-- ============================================================================
DROP VIEW IF EXISTS v_upcoming_exams_admin;

CREATE VIEW v_upcoming_exams_admin AS
SELECT 
    e.id AS exam_id,
    e.title,
    u.full_name AS instructor_name,
    (SELECT 
        CASE 
            WHEN COUNT(DISTINCT eq.type) = 1 AND MAX(eq.type) = 'MCQ' THEN 'MCQ'
            WHEN COUNT(DISTINCT eq.type) = 1 AND MAX(eq.type) = 'Essay' THEN 'Essay'
            ELSE 'Mixed'
        END
     FROM exam_questions eq WHERE eq.exam_id = e.id) AS exam_type,
    e.status,
    e.time_open,
    e.time_close,
    e.duration_minutes,
    (SELECT COUNT(*) FROM exam_questions eq WHERE eq.exam_id = e.id) AS total_questions,
    (SELECT COUNT(DISTINCT s.user_id) FROM submissions s WHERE s.exam_id = e.id) AS total_participants,
    CASE 
        WHEN e.time_open IS NOT NULL 
             AND e.time_close IS NOT NULL 
             AND NOW() BETWEEN e.time_open AND e.time_close 
        THEN TRUE 
        ELSE FALSE 
    END AS is_active,
    CASE 
        WHEN e.time_open IS NOT NULL AND e.time_open > NOW() THEN 'upcoming'
        WHEN e.time_open IS NOT NULL 
             AND e.time_close IS NOT NULL 
             AND NOW() BETWEEN e.time_open AND e.time_close THEN 'active'
        WHEN e.time_close IS NOT NULL AND e.time_close < NOW() THEN 'ended'
        ELSE 'draft'
    END AS exam_state
FROM exams e
LEFT JOIN users u ON e.instructor_id = u.id
WHERE e.status = 'published' 
   OR (e.time_open IS NOT NULL AND e.time_open > DATE_SUB(NOW(), INTERVAL 7 DAY))
ORDER BY 
    CASE 
        WHEN NOW() BETWEEN e.time_open AND e.time_close THEN 0
        WHEN e.time_open > NOW() THEN 1
        ELSE 2
    END,
    e.time_open ASC;

-- ============================================================================
-- 4. v_all_users_admin - Danh sách tất cả users cho Admin
-- ============================================================================
DROP VIEW IF EXISTS v_all_users_admin;

CREATE VIEW v_all_users_admin AS
SELECT 
    u.id,
    u.full_name,
    u.email,
    u.role,
    u.gender,
    u.phone_number,
    u.address,
    u.avatar,
    u.created_at,
    u.is_locked,
    u.failed_login_attempts,
    CASE 
        WHEN u.role = 'student' THEN (SELECT COUNT(*) FROM submissions s WHERE s.user_id = u.id)
        WHEN u.role = 'instructor' THEN (SELECT COUNT(*) FROM exams e WHERE e.instructor_id = u.id)
        ELSE 0
    END AS activity_count
FROM users u
ORDER BY u.created_at DESC;

-- ============================================================================
-- 5. v_all_exams_admin - Danh sách tất cả bài thi cho Admin
-- ============================================================================
DROP VIEW IF EXISTS v_all_exams_admin;

CREATE VIEW v_all_exams_admin AS
SELECT 
    e.id AS exam_id,
    e.title,
    e.status,
    e.exam_room_code,
    u.id AS instructor_id,
    u.full_name AS instructor_name,
    u.email AS instructor_email,
    e.time_open,
    e.time_close,
    e.duration_minutes,
    e.max_points,
    e.max_attempts,
    e.require_face_check,
    e.require_student_card,
    e.monitor_screen,
    e.created_at,
    e.updated_at,
    (SELECT COUNT(*) FROM exam_questions eq WHERE eq.exam_id = e.id) AS total_questions,
    (SELECT COUNT(DISTINCT s.user_id) FROM submissions s WHERE s.exam_id = e.id) AS total_submissions,
    CASE 
        WHEN e.time_open IS NOT NULL 
             AND e.time_close IS NOT NULL 
             AND NOW() BETWEEN e.time_open AND e.time_close 
        THEN TRUE 
        ELSE FALSE 
    END AS is_active,
    CASE 
        WHEN e.time_open IS NOT NULL 
             AND e.time_close IS NOT NULL 
             AND NOW() BETWEEN e.time_open AND e.time_close 
        THEN FALSE 
        ELSE TRUE 
    END AS can_delete
FROM exams e
LEFT JOIN users u ON e.instructor_id = u.id
ORDER BY 
    CASE e.status
        WHEN 'published' THEN 0
        WHEN 'draft' THEN 1
        WHEN 'archived' THEN 2
    END,
    e.updated_at DESC;

-- ============================================================================
-- 6. v_all_results_admin - Tổng hợp kết quả cho Admin
-- ============================================================================
DROP VIEW IF EXISTS v_all_results_admin;

CREATE VIEW v_all_results_admin AS
SELECT 
    e.id AS exam_id,
    e.title AS exam_title,
    e.status AS exam_status,
    inst.full_name AS instructor_name,
    s.id AS submission_id,
    s.user_id AS student_id,
    stu.full_name AS student_name,
    stu.email AS student_email,
    s.attempt_no,
    s.status AS submission_status,
    s.total_score,
    s.ai_score,
    s.suggested_total_score,
    s.instructor_confirmed,
    s.started_at,
    s.submitted_at,
    s.cheating_count,
    TIMESTAMPDIFF(MINUTE, s.started_at, s.submitted_at) AS duration_minutes,
    r.total_score AS final_score,
    r.status AS result_status
FROM submissions s
JOIN exams e ON s.exam_id = e.id
JOIN users stu ON s.user_id = stu.id
LEFT JOIN users inst ON e.instructor_id = inst.id
LEFT JOIN results r ON r.exam_id = e.id AND r.student_id = s.user_id
ORDER BY e.id DESC, s.submitted_at DESC;

-- ============================================================================
-- Hoàn tất
-- ============================================================================
SELECT '✅ Views cho Admin Dashboard đã được tạo thành công trong oem_mini!' AS message;
SELECT '✅ HOÀN TẤT: Database oem_admin + Views trong oem_mini đã sẵn sàng!' AS final_message;
