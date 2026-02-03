const AdminActivityLog = require('./AdminActivityLog');
const BackupMetadata = require('./BackupMetadata');
const RestoreHistory = require('./RestoreHistory');
const SuspiciousActivity = require('./SuspiciousActivity');
const AdminSettings = require('./AdminSettings');
const UserPreferences = require('./UserPreferences');

// Setup associations
RestoreHistory.belongsTo(BackupMetadata, {
    foreignKey: 'backup_id',
    as: 'backup'
});

RestoreHistory.belongsTo(BackupMetadata, {
    foreignKey: 'pre_restore_backup_id',
    as: 'preRestoreBackup'
});

BackupMetadata.hasMany(RestoreHistory, {
    foreignKey: 'backup_id',
    as: 'restores'
});

module.exports = {
    AdminActivityLog,
    BackupMetadata,
    RestoreHistory,
    SuspiciousActivity,
    AdminSettings,
    UserPreferences
};
