/**
 * Admin Activity Log Model
 * Lưu log hoạt động của Admin trong database oem_admin
 */

const { DataTypes } = require('sequelize');
const { adminSequelize } = require('../config/db');

const AdminActivityLog = adminSequelize.define('AdminActivityLog', {
    id: {
        type: DataTypes.INTEGER.UNSIGNED,
        autoIncrement: true,
        primaryKey: true
    },
    admin_id: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        comment: 'ID từ oem_mini.users'
    },
    admin_email: {
        type: DataTypes.STRING(120),
        allowNull: false,
        comment: 'Email admin (denormalized)'
    },
    action_type: {
        type: DataTypes.ENUM('login', 'logout', 'create', 'update', 'delete', 'backup', 'restore', 'view'),
        allowNull: false
    },
    target_table: {
        type: DataTypes.STRING(50),
        allowNull: true,
        comment: 'Bảng bị tác động'
    },
    target_id: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true,
        comment: 'ID record bị tác động'
    },
    old_value: {
        type: DataTypes.JSON,
        allowNull: true,
        comment: 'Giá trị cũ (cho update/delete)'
    },
    new_value: {
        type: DataTypes.JSON,
        allowNull: true,
        comment: 'Giá trị mới (cho create/update)'
    },
    ip_address: {
        type: DataTypes.STRING(45),
        allowNull: true,
        comment: 'Địa chỉ IP'
    },
    user_agent: {
        type: DataTypes.STRING(500),
        allowNull: true,
        comment: 'Browser/Device info'
    },
    description: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'Mô tả chi tiết hành động'
    },
    created_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
    }
}, {
    tableName: 'admin_activity_logs',
    timestamps: false,
    indexes: [
        { fields: ['admin_id'] },
        { fields: ['action_type'] },
        { fields: ['created_at'] },
        { fields: ['target_table'] }
    ]
});

module.exports = AdminActivityLog;
