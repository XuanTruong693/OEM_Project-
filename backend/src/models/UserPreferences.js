const { DataTypes } = require('sequelize');
const { adminSequelize } = require('../config/db');

const UserPreferences = adminSequelize.define('UserPreferences', {
    id: {
        type: DataTypes.INTEGER.UNSIGNED,
        autoIncrement: true,
        primaryKey: true
    },
    user_id: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        unique: true,
        comment: 'ID từ oem_mini.users'
    },
    theme: {
        type: DataTypes.ENUM('dark', 'light'),
        defaultValue: 'dark',
        comment: 'Theme hiện tại'
    },
    language: {
        type: DataTypes.STRING(10),
        defaultValue: 'vi',
        comment: 'Ngôn ngữ'
    },
    notifications: {
        type: DataTypes.JSON,
        allowNull: true,
        comment: 'Cài đặt thông báo'
    },
    updated_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
    }
}, {
    tableName: 'user_preferences',
    timestamps: false,
    indexes: [
        { fields: ['user_id'], unique: true }
    ]
});

// Helper methods
UserPreferences.getPreferences = async function (userId) {
    try {
        let prefs = await this.findOne({ where: { user_id: userId } });
        if (!prefs) {
            // Tạo preferences mặc định nếu chưa có
            prefs = await this.create({
                user_id: userId,
                theme: 'dark',
                language: 'vi',
                notifications: { email: true, inApp: true }
            });
        }
        return prefs;
    } catch (error) {
        console.error(`Error getting preferences for user ${userId}:`, error.message);
        return {
            theme: 'dark',
            language: 'vi',
            notifications: { email: true, inApp: true }
        };
    }
};

UserPreferences.updatePreferences = async function (userId, updates) {
    try {
        const [prefs, created] = await this.upsert({
            user_id: userId,
            ...updates,
            updated_at: new Date()
        });
        return prefs;
    } catch (error) {
        console.error(`Error updating preferences for user ${userId}:`, error.message);
        throw error;
    }
};

module.exports = UserPreferences;
