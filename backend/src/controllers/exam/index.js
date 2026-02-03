/**
 * Exam Controllers Index
 * Re-exports all exam-related controller functions for backward compatibility
 */

const RoomController = require("./RoomController");
const VerificationController = require("./VerificationController");
const ExamSessionController = require("./ExamSessionController");
const StudentResultController = require("./StudentResultController");

module.exports = {
    // Room Controller
    verifyRoom: RoomController.verifyRoom,
    joinExam: RoomController.joinExam,
    signRoomToken: RoomController.signRoomToken,
    verifyRoomToken: RoomController.verifyRoomToken,
    hasColumn: RoomController.hasColumn,

    // Verification Controller
    uploadImages: VerificationController.uploadImages,
    verifyStudentCardImage: VerificationController.verifyStudentCardImage,
    verifyFaceImage: VerificationController.verifyFaceImage,
    compareFaceImages: VerificationController.compareFaceImages,
    uploadVerifiedImages: VerificationController.uploadVerifiedImages,
    uploadVerifyAssets: VerificationController.uploadVerifyAssets,

    // Exam Session Controller
    startExam: ExamSessionController.startExam,
    saveAnswer: ExamSessionController.saveAnswer,
    proctorEvent: ExamSessionController.proctorEvent,
    submitExam: ExamSessionController.submitExam,

    // Student Result Controller
    myResults: StudentResultController.myResults,
    getExamPublicInfo: StudentResultController.getExamPublicInfo,
    getSubmissionStatus: StudentResultController.getSubmissionStatus,
};
