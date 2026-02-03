const BaseRepository = require("./BaseRepository");

class ExamRepository extends BaseRepository {
    constructor() {
        super("exams");
    }

    /**
     * Find exam by room code
     * @param {string} roomCode - Room code
     * @param {boolean} publishedOnly - Only find published exams
     * @returns {Promise<Object|null>}
     */
    async findByRoomCode(roomCode, publishedOnly = true) {
        let query = `SELECT id, exam_room_code, status, duration, duration_minutes, 
                        time_open, time_close, max_attempts, require_face_check, 
                        require_student_card, monitor_screen, max_points
                 FROM exams WHERE exam_room_code = ?`;

        if (publishedOnly) {
            query += ` AND status = 'published'`;
        }
        query += ` LIMIT 1`;

        const rows = await this.query(query, [roomCode]);
        return rows.length > 0 ? rows[0] : null;
    }

    /**
     * Get exam settings
     * @param {number} examId - Exam ID
     * @returns {Promise<Object>}
     */
    async getSettings(examId) {
        return this.findById(examId, [
            "max_attempts", "duration_minutes", "duration",
            "time_open", "time_close", "require_face_check",
            "require_student_card", "monitor_screen", "max_points", "intent_shuffle"
        ]);
    }

    /**
     * Get exams by instructor
     * @param {number} instructorId - Instructor ID
     * @returns {Promise<Array>}
     */
    async findByInstructor(instructorId) {
        return this.findAll({ instructor_id: instructorId }, ["*"], "id DESC");
    }

    /**
     * Get exam with instructor info
     * @param {number} examId - Exam ID
     * @returns {Promise<Object|null>}
     */
    async findWithInstructor(examId) {
        const rows = await this.query(
            `SELECT e.*, u.full_name AS instructor_name
       FROM exams e
       LEFT JOIN users u ON u.id = e.instructor_id
       WHERE e.id = ? LIMIT 1`,
            [examId]
        );
        return rows.length > 0 ? rows[0] : null;
    }

    /**
     * Get questions for exam
     * @param {number} examId - Exam ID
     * @returns {Promise<Array>}
     */
    async getQuestions(examId) {
        return this.query(
            `SELECT id AS question_id, question_text, type, points, model_answer, order_index
       FROM exam_questions WHERE exam_id = ? ORDER BY COALESCE(order_index, id) ASC`,
            [examId]
        );
    }

    /**
     * Get options for MCQ questions
     * @param {number[]} questionIds - Question IDs
     * @returns {Promise<Object>} Map of question_id -> options[]
     */
    async getOptionsForQuestions(questionIds) {
        if (!questionIds.length) return {};

        const placeholders = questionIds.map(() => "?").join(",");
        const rows = await this.query(
            `SELECT question_id, id AS option_id, option_text, is_correct
       FROM exam_options WHERE question_id IN (${placeholders}) ORDER BY id ASC`,
            questionIds
        );

        const optionsByQ = {};
        rows.forEach(o => {
            if (!optionsByQ[o.question_id]) optionsByQ[o.question_id] = [];
            optionsByQ[o.question_id].push(o);
        });
        return optionsByQ;
    }

    /**
     * Update exam status
     * @param {number} examId - Exam ID
     * @param {string} status - New status
     * @returns {Promise<boolean>}
     */
    async updateStatus(examId, status) {
        return this.updateById(examId, { status });
    }
}

module.exports = new ExamRepository();
