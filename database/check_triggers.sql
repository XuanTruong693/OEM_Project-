-- Kiểm tra triggers trên cheating_logs
SHOW TRIGGERS WHERE `Trigger` LIKE '%cheating_logs%';

-- Nếu có trigger, hãy show definition
SHOW CREATE TRIGGER tr_update_cheating_count;

-- Kiểm tra indices trên cheating_logs
SHOW INDEX FROM cheating_logs;

-- Kiểm tra indices trên submissions
SHOW INDEX FROM submissions;

-- Test: Insert một record test
INSERT INTO cheating_logs (submission_id, student_id, exam_id, event_type, event_details, severity)
VALUES (1, 1, 1, 'test', '{}', 'medium');

-- Xóa test record
DELETE FROM cheating_logs WHERE event_type = 'test';
