const { DataTypes } = require('sequelize');
const { adminSequelize } = require('../config/db');

const AdminSettings = adminSequelize.define('AdminSettings', {
    id: {
        type: DataTypes.INTEGER.UNSIGNED,
        autoIncrement: true,
        primaryKey: true
    },
    setting_key: {
        type: DataTypes.STRING(100),
        allowNull: false,
        unique: true,
        comment: 'Key cài đặt'
    },
    setting_value: {
        type: DataTypes.JSON,
        allowNull: false,
        comment: 'Giá trị cài đặt'
    },
    description: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'Mô tả'
    },
    updated_by: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true,
        comment: 'ID admin'
    },
    updated_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
    }
}, {
    tableName: 'admin_settings',
    timestamps: false
});

// Helper methods
AdminSettings.getSetting = async function (key, defaultValue = null) {
    try {
        const setting = await this.findOne({ where: { setting_key: key } });
        if (setting) {
            return setting.setting_value;
        }
        return defaultValue;
    } catch (error) {
        console.error(`Error getting setting ${key}:`, error.message);
        return defaultValue;
    }
};

AdminSettings.setSetting = async function (key, value, adminId = null, description = null) {
    try {
        const [setting, created] = await this.upsert({
            setting_key: key,
            setting_value: value,
            updated_by: adminId,
            description: description,
            updated_at: new Date()
        });
        return setting;
    } catch (error) {
        console.error(`Error setting ${key}:`, error.message);
        throw error;
    }
};

module.exports = AdminSettings;
