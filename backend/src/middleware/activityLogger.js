const { AdminActivityLog, SuspiciousActivity } = require('../models/adminModels');

const getClientIP = (req) => {
    return req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
        req.headers['x-real-ip'] ||
        req.connection?.remoteAddress ||
        req.socket?.remoteAddress ||
        'unknown';
};

/**
 * Log một hoạt động của Admin
 * @param {Object} options - Thông tin log
 * @param {number} options.adminId - ID của admin
 * @param {string} options.adminEmail - Email của admin
 * @param {string} options.actionType - Loại hành động
 * @param {string} options.targetTable - Bảng bị tác động
 * @param {number} options.targetId - ID record bị tác động
 * @param {Object} options.oldValue - Giá trị cũ
 * @param {Object} options.newValue - Giá trị mới
 * @param {string} options.ipAddress - Địa chỉ IP
 * @param {string} options.userAgent - Browser info
 * @param {string} options.description - Mô tả
 */
const logActivity = async (options) => {
    try {
        const log = await AdminActivityLog.create({
            admin_id: options.adminId,
            admin_email: options.adminEmail,
            action_type: options.actionType,
            target_table: options.targetTable || null,
            target_id: options.targetId || null,
            old_value: options.oldValue || null,
            new_value: options.newValue || null,
            ip_address: options.ipAddress || null,
            user_agent: options.userAgent || null,
            description: options.description || null,
            created_at: new Date()
        });

        console.log(`📝 [ActivityLog] ${options.actionType} by ${options.adminEmail} on ${options.targetTable || 'system'}`);

        return log;
    } catch (error) {
        console.error('❌ [ActivityLog] Error logging activity:', error.message);
        // Không throw error để không ảnh hưởng đến luồng chính
        return null;
    }
};

/**
 * Kiểm tra và ghi nhận hoạt động đáng ngờ
 */
const checkSuspiciousActivity = async (options) => {
    const { adminId, adminEmail, actionType, metadata, ipAddress } = options;

    try {
        // Rule 1: Mass delete - xóa nhiều records trong thời gian ngắn
        if (actionType === 'delete') {
            const recentDeletes = await AdminActivityLog.count({
                where: {
                    admin_id: adminId,
                    action_type: 'delete',
                    created_at: {
                        [require('sequelize').Op.gte]: new Date(Date.now() - 60 * 1000) // 1 phút
                    }
                }
            });

            if (recentDeletes >= 10) { // Ngưỡng: 10 lần xóa trong 1 phút
                await SuspiciousActivity.create({
                    user_id: adminId,
                    user_email: adminEmail,
                    activity_type: 'mass_delete',
                    severity: 'high',
                    description: `Phát hiện xóa hàng loạt: ${recentDeletes + 1} lần xóa trong 1 phút`,
                    metadata: { delete_count: recentDeletes + 1, ...metadata },
                    ip_address: ipAddress,
                    detected_at: new Date()
                });
                console.warn(`⚠️ [Suspicious] Mass delete detected for admin ${adminEmail}`);
            }
        }

        // Rule 2: Rapid restore - restore nhiều lần trong ngày
        if (actionType === 'restore') {
            const restoresToday = await AdminActivityLog.count({
                where: {
                    admin_id: adminId,
                    action_type: 'restore',
                    created_at: {
                        [require('sequelize').Op.gte]: new Date(new Date().setHours(0, 0, 0, 0))
                    }
                }
            });

            if (restoresToday >= 3) { // Ngưỡng: 3 lần restore trong ngày
                await SuspiciousActivity.create({
                    user_id: adminId,
                    user_email: adminEmail,
                    activity_type: 'rapid_restore',
                    severity: 'high',
                    description: `Phát hiện restore liên tục: ${restoresToday + 1} lần restore trong ngày`,
                    metadata: { restore_count: restoresToday + 1, ...metadata },
                    ip_address: ipAddress,
                    detected_at: new Date()
                });
                console.warn(`⚠️ [Suspicious] Rapid restore detected for admin ${adminEmail}`);
            }
        }

    } catch (error) {
        console.error('❌ [Suspicious] Error checking suspicious activity:', error.message);
    }
};

/**
 * Log login thất bại và kiểm tra suspicious activity
 */
const logFailedLogin = async (email, ipAddress, userAgent, reason) => {
    try {
        // Đếm số lần login thất bại gần đây từ IP này
        const recentFailures = await AdminActivityLog.count({
            where: {
                admin_email: email,
                action_type: 'login',
                ip_address: ipAddress,
                description: { [require('sequelize').Op.like]: '%thất bại%' },
                created_at: {
                    [require('sequelize').Op.gte]: new Date(Date.now() - 10 * 60 * 1000) // 10 phút
                }
            }
        });

        // Log login attempt
        await AdminActivityLog.create({
            admin_id: 0, // Unknown user
            admin_email: email,
            action_type: 'login',
            ip_address: ipAddress,
            user_agent: userAgent,
            description: `Đăng nhập thất bại: ${reason}`,
            created_at: new Date()
        });

        // Check suspicious - nhiều lần login thất bại
        if (recentFailures >= 5) {
            await SuspiciousActivity.create({
                user_id: 0,
                user_email: email,
                activity_type: 'failed_login',
                severity: 'medium',
                description: `Phát hiện đăng nhập thất bại nhiều lần: ${recentFailures + 1} lần trong 10 phút`,
                metadata: { failure_count: recentFailures + 1, ip_address: ipAddress },
                ip_address: ipAddress,
                detected_at: new Date()
            });
            console.warn(`⚠️ [Suspicious] Multiple failed logins detected for ${email} from ${ipAddress}`);
        }

    } catch (error) {
        console.error('❌ [ActivityLog] Error logging failed login:', error.message);
    }
};

/**
 * Middleware để tự động log các hoạt động
 * Sử dụng: router.use(activityLoggerMiddleware)
 */
const activityLoggerMiddleware = (req, res, next) => {
    // Attach helper function to request object
    req.logActivity = async (options) => {
        if (!req.user) {
            console.warn('⚠️ [ActivityLog] No user in request, skipping log');
            return null;
        }

        const fullOptions = {
            adminId: req.user.id,
            adminEmail: req.user.email,
            ipAddress: getClientIP(req),
            userAgent: req.headers['user-agent'],
            ...options
        };

        // Log activity
        const log = await logActivity(fullOptions);

        // Check for suspicious activity
        await checkSuspiciousActivity(fullOptions);

        return log;
    };

    next();
};

/**
 * Helper function để sanitize dữ liệu trước khi log
 * (Loại bỏ password, sensitive data)
 */
const sanitizeForLog = (data) => {
    if (!data || typeof data !== 'object') return data;

    const sanitized = { ...data };
    const sensitiveFields = ['password', 'password_hash', 'token', 'secret', 'credit_card'];

    for (const field of sensitiveFields) {
        if (sanitized[field]) {
            sanitized[field] = '[REDACTED]';
        }
    }

    return sanitized;
};

module.exports = {
    logActivity,
    logFailedLogin,
    checkSuspiciousActivity,
    activityLoggerMiddleware,
    getClientIP,
    sanitizeForLog
};
