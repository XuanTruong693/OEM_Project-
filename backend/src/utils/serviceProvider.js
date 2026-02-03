const container = require('./container');

/**
 * Register all dependencies with the container
 */
function registerServices() {
    // ==========================================
    // Repositories
    // ==========================================
    container.register('ExamRepository', () => require('../repositories/ExamRepository'));
    container.register('SubmissionRepository', () => require('../repositories/SubmissionRepository'));
    container.register('UserRepository', () => require('../repositories/UserRepository'));
    container.register('BaseRepository', () => require('../repositories/BaseRepository'));

    // ==========================================
    // Services
    // ==========================================
    container.register('TokenService', () => require('../services/room/TokenService'));
    container.register('RoomVerificationService', () => require('../services/room/RoomVerificationService'));
    container.register('AIService', () => require('../services/AIService'));
    container.register('EmailService', () => require('../services/emailService'));
    container.register('VerificationService', () => require('../services/verificationService'));

    // ==========================================
    // Controllers
    // ==========================================
    container.register('ExamControllers', () => require('../controllers/exam'));
    container.register('InstructorControllers', () => require('../controllers/instructor'));

    console.log(`[DI] Registered ${container.list().length} dependencies`);
}

/**
 * Helper to get a dependency from container
 * @param {string} name - Dependency name
 * @returns {*}
 */
function resolve(name) {
    return container.resolve(name);
}

module.exports = {
    registerServices,
    resolve,
    container
};
