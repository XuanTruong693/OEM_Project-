const InstructorDashboardController = require("./InstructorDashboardController");
const ExamManagementController = require("./ExamManagementController");
const GradingController = require("./GradingController");

module.exports = {
    // Dashboard Controller
    getDashboardStats: InstructorDashboardController.getDashboardStats,
    getDashboardSubmissions: InstructorDashboardController.getDashboardSubmissions,
    getDashboardStudents: InstructorDashboardController.getDashboardStudents,
    getDashboardMonthly: InstructorDashboardController.getDashboardMonthly,

    // Exam Management Controller
    ensureExamOwnership: ExamManagementController.ensureExamOwnership,
    getExamRow: ExamManagementController.getExamRow,
    generateRoomCode: ExamManagementController.generateRoomCode,
    getMyExams: ExamManagementController.getMyExams,
    getExamPreview: ExamManagementController.getExamPreview,
    getExamSummary: ExamManagementController.getExamSummary,
    publishExam: ExamManagementController.publishExam,
    unpublishExam: ExamManagementController.unpublishExam,
    purgeExam: ExamManagementController.purgeExam,
    cloneExam: ExamManagementController.cloneExam,
    openExam: ExamManagementController.openExam,

    // Grading Controller
    getExamSubmissions: GradingController.getExamSubmissions,
    getSubmissionAnswers: GradingController.getSubmissionAnswers,
    gradeAnswer: GradingController.gradeAnswer,
    confirmAIScore: GradingController.confirmAIScore,
    finalizeSubmission: GradingController.finalizeSubmission,
    retryFailedGrading: GradingController.retryFailedGrading,
    approveAllExamScores: GradingController.approveAllExamScores,
    updateStudentAnswerScore: GradingController.updateStudentAnswerScore,
    updateStudentExamScore: GradingController.updateStudentExamScore,
};
