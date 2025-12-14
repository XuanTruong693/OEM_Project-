-- ============================================================================
-- 🔐 OEM Admin Database Schema
-- Database riêng cho Admin Dashboard - Tách biệt với oem_mini
-- Engine: MySQL 8.0.x
-- Charset: utf8mb4 / utf8mb4_unicode_ci
-- Author: OEM Mini Team (Capstone Project 2025 - CMU-SE)
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

-- ============================================================================
-- Hoàn tất
-- ============================================================================
SELECT 'Database oem_admin đã được tạo thành công!' AS message;
