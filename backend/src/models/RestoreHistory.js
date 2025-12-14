/**
 * Restore History Model
 * Lưu lịch sử restore database trong database oem_admin
 */

const { DataTypes } = require('sequelize');
const { adminSequelize } = require('../config/db');

const RestoreHistory = adminSequelize.define('RestoreHistory', {
    id: {
        type: DataTypes.INTEGER.UNSIGNED,
        autoIncrement: true,
        primaryKey: true
    },
    backup_id: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        comment: 'FK → backup_metadata.id'
    },
    performed_by: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        comment: 'ID admin'
    },
    performed_by_email: {
        type: DataTypes.STRING(120),
        allowNull: false,
        comment: 'Email admin'
    },
    status: {
        type: DataTypes.ENUM('in_progress', 'completed', 'failed'),
        defaultValue: 'in_progress'
    },
    error_message: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'Thông báo lỗi (nếu có)'
    },
    started_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
    },
    completed_at: {
        type: DataTypes.DATE,
        allowNull: true
    },
    pre_restore_backup_id: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true,
        comment: 'Backup tự động trước khi restore'
    }
}, {
    tableName: 'restore_history',
    timestamps: false,
    indexes: [
        { fields: ['backup_id'] },
        { fields: ['performed_by'] },
        { fields: ['started_at'] }
    ]
});

module.exports = RestoreHistory;
