const cron = require('node-cron');
const backupService = require('./backupService');
const { adminPool } = require('../config/db');

let scheduledJob = null;
async function initBackupScheduler() {
    try {
        const [rows] = await adminPool.query(
            "SELECT setting_value FROM admin_settings WHERE setting_key = 'backup_schedule'"
        );

        if (rows.length > 0 && rows[0].setting_value) {
            const config = typeof rows[0].setting_value === 'string'
                ? JSON.parse(rows[0].setting_value)
                : rows[0].setting_value;

            if (config.enabled && config.time) {
                scheduleBackup(config.time);
                console.log(`✅ [Scheduler] Auto backup initialized at ${config.time}`);
            } else {
                console.log('⚠️ [Scheduler] Auto backup is disabled');
            }
        } else {
            console.log('⚠️ [Scheduler] No backup config found in database');
        }
    } catch (error) {
        console.warn('⚠️ [Scheduler] Could not initialize backup scheduler:', error.message);
    }
}

/**
 * Đặt lịch backup vào thời gian chỉ định
 * @param {string} time - Thời gian backup định dạng "HH:mm"
 */
function scheduleBackup(time) {
    try {
        const [hour, minute] = time.split(':').map(Number);

        // Validate time format
        if (isNaN(hour) || isNaN(minute) || hour < 0 || hour > 23 || minute < 0 || minute > 59) {
            console.error('❌ [Scheduler] Invalid time format:', time);
            return false;
        }

        // Cron expression: minute hour * * * (daily at HH:mm)
        const cronExpression = `${minute} ${hour} * * *`;

        // Stop existing job if any
        if (scheduledJob) {
            scheduledJob.stop();
            console.log('🔄 [Scheduler] Previous backup job stopped');
        }

        // Schedule new job
        scheduledJob = cron.schedule(cronExpression, async () => {
            console.log(`⏰ [Scheduler] Running scheduled backup at ${new Date().toISOString()}`);

            try {
                const result = await backupService.createBackup({
                    backupType: 'scheduled',
                    performedBy: null,
                    performedByEmail: 'system@auto-backup'
                });

                if (result.success) {
                    console.log(`✅ [Scheduler] Scheduled backup completed: ${result.fileName}`);
                } else {
                    console.error('❌ [Scheduler] Scheduled backup failed:', result.error);
                }
            } catch (err) {
                console.error('❌ [Scheduler] Scheduled backup error:', err.message);
            }
        }, {
            scheduled: true,
            timezone: process.env.APP_TZ || 'Asia/Ho_Chi_Minh'
        });

        console.log(`✅ [Scheduler] Backup scheduled at ${time} (cron: ${cronExpression})`);
        return true;

    } catch (error) {
        console.error('❌ [Scheduler] Failed to schedule backup:', error.message);
        return false;
    }
}

/**
 * Cập nhật lịch backup (gọi khi settings thay đổi)
 * @param {Object} config - Config với { enabled: boolean, time: string }
 */
function updateSchedule(config) {
    if (config.enabled && config.time) {
        return scheduleBackup(config.time);
    } else {
        // Disable scheduler
        if (scheduledJob) {
            scheduledJob.stop();
            scheduledJob = null;
            console.log('⏹️ [Scheduler] Backup scheduler disabled');
        }
        return true;
    }
}

function stopScheduler() {
    if (scheduledJob) {
        scheduledJob.stop();
        scheduledJob = null;
        console.log('⏹️ [Scheduler] Backup scheduler stopped');
    }
}

function getSchedulerStatus() {
    return {
        active: scheduledJob !== null,
        job: scheduledJob
    };
}

module.exports = {
    initBackupScheduler,
    scheduleBackup,
    updateSchedule,
    stopScheduler,
    getSchedulerStatus
};
