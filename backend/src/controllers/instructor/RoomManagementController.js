const { QueryTypes } = require("sequelize");
const sequelize = require("../../config/db");
const { getIO } = require("../../services/socketService");

/**
 * GET /api/instructor/rooms/active
 * Fetch all published exams for the current instructor
 */
async function getActiveRooms(req, res) {
    try {
        const instructorId = req.user?.id;
        if (!instructorId) {
            return res.status(401).json({ message: "Không xác định được danh tính giảng viên." });
        }

        const rows = await sequelize.query(
            `
            SELECT 
                e.id, 
                e.title, 
                e.exam_room_code, 
                e.status, 
                e.time_open, 
                e.time_close,
                e.duration_minutes,
                e.require_face_check,
                e.require_student_card,
                e.monitor_screen,
                e.grading_mode,
                e.allow_view_answers,
                COUNT(s.id) as active_students
            FROM exams e
            LEFT JOIN submissions s ON s.exam_id = e.id AND s.status = 'in_progress'
            WHERE e.instructor_id = :instructorId 
              AND e.status = 'published'
              AND (e.time_open IS NULL OR e.time_open <= NOW())
              AND (e.time_close IS NULL OR e.time_close >= NOW())
            GROUP BY e.id
            ORDER BY e.updated_at DESC
            `,
            { 
                replacements: { instructorId },
                type: QueryTypes.SELECT
            }
        );
        res.json(rows);
    } catch (err) {
        console.error("getActiveRooms error:", err);
        res.status(500).json({ message: "Server error" });
    }
}

/**
 * GET /api/instructor/rooms/:examId
 * Fetch full configuration of a specific room
 */
async function getRoomDetail(req, res) {
    try {
        const examId = req.params.examId;
        const instructorId = req.user.id;

        console.log(`🔍 [RoomDetail] Fetching exam: ${examId} for instructor: ${instructorId}`);

        const [exam] = await sequelize.query(
            `
            SELECT 
                id, title, exam_room_code, status, 
                time_open, time_close, duration_minutes,
                require_face_check, require_student_card, 
                monitor_screen, grading_mode, allow_view_answers
            FROM exams 
            WHERE id = :examId AND instructor_id = :instructorId
            LIMIT 1
            `,
            { 
                replacements: { examId, instructorId },
                type: QueryTypes.SELECT
            }
        );

        if (!exam) {
            return res.status(404).json({ message: "Room not found" });
        }

        res.json(exam);
    } catch (err) {
        console.error("getRoomDetail error:", err);
        res.status(500).json({ message: "Server error" });
    }
}

/**
 * POST /api/instructor/rooms/:examId/close
 * Close an active room (set to draft)
 */
async function closeRoom(req, res) {
    try {
        const examId = req.params.examId;
        const instructorId = req.user.id;

        // Verify ownership
        const [exam] = await sequelize.query(
            "SELECT id FROM exams WHERE id = ? AND instructor_id = ? LIMIT 1",
            { replacements: [examId, instructorId] }
        );

        if (!exam || exam.length === 0) {
            return res.status(403).json({ message: "Access denied" });
        }

        await sequelize.query(
            "UPDATE exams SET status = 'draft' WHERE id = ?",
            { replacements: [examId] }
        );

        // Notify all students in the room
        const io = getIO();
        if (io) {
            io.to(`exam:${examId}`).emit("exam:closed", {
                message: "Phòng thi đã bị đóng bởi giảng viên."
            });
        }

        res.json({ success: true, message: "Room closed successfully" });
    } catch (err) {
        console.error("closeRoom error:", err);
        res.status(500).json({ message: "Server error" });
    }
}

/**
 * PATCH /api/instructor/rooms/:examId/config
 * Update exam configuration and broadcast to students
 */
async function updateRoomConfig(req, res) {
    try {
        const examId = req.params.examId;
        const instructorId = req.user.id;
        const updates = req.body;

        // Verify ownership
        const [[exam]] = await sequelize.query(
            "SELECT id FROM exams WHERE id = ? AND instructor_id = ? LIMIT 1",
            { replacements: [examId, instructorId] }
        );

        if (!exam || exam.length === 0) {
            return res.status(403).json({ message: "Access denied" });
        }

        // Build update query dynamically
        const allowedFields = [
            'duration_minutes', 'time_open', 'time_close', 
            'require_face_check', 'require_student_card', 
            'monitor_screen', 'grading_mode', 'allow_view_answers'
        ];
        
        const setClauses = [];
        const replacements = [];
        
        for (const field of allowedFields) {
            if (updates[field] !== undefined) {
                if (field === 'time_open' || field === 'time_close') {
                    // Use STR_TO_DATE to bypass Sequelize's auto-timezone conversion
                    setClauses.push(`${field} = STR_TO_DATE(?, '%Y-%m-%d %H:%i:%s')`);
                } else {
                    setClauses.push(`${field} = ?`);
                }
                replacements.push(updates[field]);
            }
        }

        if (setClauses.length === 0) {
            return res.status(400).json({ message: "No valid fields to update" });
        }

        replacements.push(examId);
        await sequelize.query(
            `UPDATE exams SET ${setClauses.join(', ')}, updated_at = NOW() WHERE id = ?`,
            { 
                replacements,
                type: QueryTypes.UPDATE
            }
        );

        // Prepare broadcast data (Use ISO for absolute time consistency across different client timezones)
        const broadcastData = { ...updates };
        if (broadcastData.time_close) {
            broadcastData.time_close = new Date(broadcastData.time_close).toISOString();
        }

        // Detailed logging for debugging
        const [[{ serverNow }]] = await sequelize.query("SELECT NOW() as serverNow");
        console.log(`⚙️ [RoomConfig] Updated exam ${examId}. Server NOW: ${serverNow}, Updates:`, updates);

        // Broadcast new config to students
        const io = getIO();
        if (io) {
            io.to(`exam:${examId}`).emit("exam:config-updated", broadcastData);
        }

        res.json({ success: true, message: "Configuration updated" });
    } catch (err) {
        console.error("updateRoomConfig error:", err);
        res.status(500).json({ message: "Server error" });
    }
}

/**
 * GET /api/instructor/rooms/:examId/students
 * List active students in a room
 */
async function getRoomStudents(req, res) {
    try {
        const examId = req.params.examId;
        const instructorId = req.user.id;

        // Verify ownership
        const [[exam]] = await sequelize.query(
            "SELECT id FROM exams WHERE id = ? AND instructor_id = ? LIMIT 1",
            { replacements: [examId, instructorId] }
        );

        if (!exam || exam.length === 0) {
            return res.status(403).json({ message: "Access denied" });
        }

        const students = await sequelize.query(
            `
            SELECT 
                s.id as submission_id,
                u.id as student_id,
                u.full_name as name,
                u.email,
                s.status,
                s.cheating_count,
                s.started_at,
                (SELECT COUNT(*) FROM cheating_logs cl WHERE cl.submission_id = s.id AND cl.event_type = 'admin_bypass') > 0 as is_bypassed
            FROM submissions s
            JOIN users u ON s.user_id = u.id
            WHERE s.exam_id = :examId
            ORDER BY s.started_at DESC
            `,
            { 
                replacements: { examId },
                type: QueryTypes.SELECT
            }
        );

        res.json(students);
    } catch (err) {
        console.error("❌ getRoomStudents error:", err);
        res.status(500).json({ message: "Lỗi hệ thống khi lấy danh sách sinh viên.", error: err.message });
    }
}

/**
 * POST /api/instructor/rooms/students/:submissionId/action
 * Perform action on a student (kick, bypass)
 */
async function performStudentAction(req, res) {
    try {
        const submissionId = req.params.submissionId;
        const { action } = req.body;
        const instructorId = req.user.id;

        // Verify ownership of the exam this submission belongs to
        const [subInfo] = await sequelize.query(
            `SELECT s.id, s.exam_id, s.user_id FROM submissions s 
             JOIN exams e ON e.id = s.exam_id 
             WHERE s.id = ? AND e.instructor_id = ? LIMIT 1`,
            { replacements: [submissionId, instructorId] }
        );

        if (!subInfo || subInfo.length === 0) {
            return res.status(403).json({ message: "Access denied" });
        }

        const { exam_id: examId, user_id: studentId } = subInfo[0];
        const io = getIO();

        if (action === 'kick') {
            // Updated: Instructor kick is now immediate via socket
            if (io) {
                io.emit(`student:kicked:${submissionId}`, {
                    message: "Giảng viên đã kết thúc bài thi của bạn."
                });
            }
            res.json({ success: true, message: "Student kicked" });
        } else if (action === 'bypass') {
            // Smart Bypass: insert into cheating_logs
            await sequelize.query(
                `INSERT INTO cheating_logs (submission_id, student_id, exam_id, event_type, severity, event_details) 
                 VALUES (?, ?, ?, 'admin_bypass', 'low', ?)`,
                { replacements: [submissionId, studentId, examId, JSON.stringify({ granted_by: instructorId })] }
            );
            
            // Notify student to refresh or proceed
            if (io) {
                io.emit(`student:bypass-granted:${submissionId}`);
            }
            
            res.json({ success: true, message: "Bypass granted" });
        } else {
            res.status(400).json({ message: "Invalid action" });
        }
    } catch (err) {
        console.error("performStudentAction error:", err);
        res.status(500).json({ message: "Server error" });
    }
}

module.exports = {
    getActiveRooms,
    getRoomDetail,
    closeRoom,
    updateRoomConfig,
    getRoomStudents,
    performStudentAction
};
