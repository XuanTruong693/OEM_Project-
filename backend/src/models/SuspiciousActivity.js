const { DataTypes } = require('sequelize');
const { adminSequelize } = require('../config/db');

const SuspiciousActivity = adminSequelize.define('SuspiciousActivity', {
    id: {
        type: DataTypes.INTEGER.UNSIGNED,
        autoIncrement: true,
        primaryKey: true
    },
    user_id: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        comment: 'ID từ oem_mini.users'
    },
    user_email: {
        type: DataTypes.STRING(120),
        allowNull: false,
        comment: 'Email user'
    },
    activity_type: {
        type: DataTypes.ENUM('mass_delete', 'failed_login', 'rapid_restore', 'unusual_access', 'data_export'),
        allowNull: false
    },
    severity: {
        type: DataTypes.ENUM('low', 'medium', 'high', 'critical'),
        defaultValue: 'medium'
    },
    description: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'Mô tả chi tiết'
    },
    metadata: {
        type: DataTypes.JSON,
        allowNull: true,
        comment: 'Dữ liệu bổ sung'
    },
    ip_address: {
        type: DataTypes.STRING(45),
        allowNull: true,
        comment: 'Địa chỉ IP'
    },
    detected_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
    },
    is_reviewed: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        comment: 'Đã xem xét chưa'
    },
    reviewed_by: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true,
        comment: 'ID admin đã xem xét'
    },
    reviewed_at: {
        type: DataTypes.DATE,
        allowNull: true
    },
    action_taken: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'Hành động đã thực hiện'
    }
}, {
    tableName: 'suspicious_activities',
    timestamps: false,
    indexes: [
        { fields: ['user_id'] },
        { fields: ['activity_type'] },
        { fields: ['severity'] },
        { fields: ['detected_at'] },
        { fields: ['is_reviewed'] }
    ]
});

module.exports = SuspiciousActivity;
