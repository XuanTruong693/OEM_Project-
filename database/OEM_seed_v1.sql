USE oem_mini;

-- ============================================================================
-- SEED DATA (1 Admin, 1 Instructor, 1 Student, 1 Course, 1 Exam)
-- NOTE: password_hash uses placeholder dummy values for demo.
-- ============================================================================

-- Seed default users
INSERT INTO users (full_name, email, password_hash, role, verify_room_code)
VALUES
('OEM Admin',      'admin@oem.local',      '$2y$dummyhash_admin',      'admin',     NULL),
('Dr. Instructor', 'instructor@oem.local', '$2y$dummyhash_instructor', 'instructor', NULL),
('Student One',    'student@oem.local',    '$2y$dummyhash_student',    'student',   NULL);

-- Seed course
INSERT INTO courses (title, description, instructor_id)
VALUES ('Intro to OEM', 'Demo course for OEM Mini', 2);

-- Seed exam
INSERT INTO exams (course_id, title, duration, exam_room_code)
VALUES (1, 'Midterm Demo', 45, 'ROOM-ABC123');

UPDATE users SET verify_room_code = 'ROOM-ABC123' WHERE email = 'student@oem.local';

-- Seed exam content
INSERT INTO exam_questions (exam_id, question_text, type, model_answer, points, order_index)
VALUES (1, '2 + 2 = ?', 'MCQ', NULL, 1, 1);

INSERT INTO exam_options (question_id, option_text, is_correct)
VALUES
(1, '3', FALSE),
(1, '4', TRUE),
(1, '5', FALSE),
(1, '22', FALSE);

-- Seed submission & results
INSERT INTO submissions (exam_id, user_id, total_score, status)
VALUES (1, 3, 0, 'pending');

INSERT INTO student_answers (student_id, question_id, selected_option_id, score, status, submission_id)
VALUES (3, 1, 2, 1, 'graded', 1);

UPDATE submissions SET total_score = 1, status = 'graded' WHERE id = 1;

INSERT INTO results (exam_id, student_id, total_score, status)
VALUES (1, 3, 1, 'confirmed');

-- Seed AI log
INSERT INTO ai_logs (question_id, student_id, student_answer, model_answer, similarity_score, ai_suggested_score)
VALUES (1, 3, 'Chọn 4', 'Đáp án đúng là 4', 0.95, 1.0);

-- ============================================================================
-- END OF SCRIPT
-- ============================================================================