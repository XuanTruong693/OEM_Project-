/**
 * Backup Metadata Model
 * Lưu thông tin metadata của các bản backup trong database oem_admin
 */

const { DataTypes } = require('sequelize');
const { adminSequelize } = require('../config/db');

const BackupMetadata = adminSequelize.define('BackupMetadata', {
    id: {
        type: DataTypes.INTEGER.UNSIGNED,
        autoIncrement: true,
        primaryKey: true
    },
    backup_type: {
        type: DataTypes.ENUM('manual', 'scheduled', 'before_restore'),
        allowNull: false
    },
    file_name: {
        type: DataTypes.STRING(255),
        allowNull: false,
        comment: 'Tên file backup'
    },
    file_path: {
        type: DataTypes.STRING(500),
        allowNull: false,
        comment: 'Đường dẫn file (relative)'
    },
    file_size: {
        type: DataTypes.BIGINT,
        allowNull: true,
        comment: 'Kích thước file (bytes)'
    },
    performed_by: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true,
        comment: 'ID admin (NULL nếu scheduled)'
    },
    performed_by_email: {
        type: DataTypes.STRING(120),
        allowNull: true,
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
    tables_count: {
        type: DataTypes.INTEGER,
        allowNull: true,
        comment: 'Số bảng được backup'
    },
    records_count: {
        type: DataTypes.BIGINT,
        allowNull: true,
        comment: 'Tổng số records'
    },
    checksum: {
        type: DataTypes.STRING(64),
        allowNull: true,
        comment: 'SHA256 checksum của file'
    },
    db_name: {
        type: DataTypes.STRING(50),
        defaultValue: 'oem_mini',
        comment: 'Tên database được backup'
    }
}, {
    tableName: 'backup_metadata',
    timestamps: false,
    indexes: [
        { fields: ['backup_type'] },
        { fields: ['status'] },
        { fields: ['started_at'] }
    ]
});

module.exports = BackupMetadata;
