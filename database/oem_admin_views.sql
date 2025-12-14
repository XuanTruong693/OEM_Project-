-- ============================================================================
-- 📊 OEM Mini - Views for Admin Dashboard
-- Các views thống kê cho Admin Dashboard
-- Tạo trong database chính oem_mini
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
SELECT 'Views cho Admin Dashboard đã được tạo thành công trong oem_mini!' AS message;
