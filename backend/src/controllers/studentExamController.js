/**
 * studentExamController.js
 * 
 * ⚠️ DEPRECATED: This file now re-exports from modular controllers.
 * New code should import directly from:
 *   - ./exam/RoomController
 *   - ./exam/VerificationController
 *   - ./exam/ExamSessionController
 *   - ./exam/StudentResultController
 * 
 * This file is kept for backward compatibility with existing imports.
 */

// Re-export all functions from the new modular controllers
module.exports = require("./exam");
