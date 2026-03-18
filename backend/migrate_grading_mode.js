const sequelize = require('./src/config/db');

async function migrate() {
    try {
        await sequelize.query("ALTER TABLE exams ADD COLUMN grading_mode ENUM('general', 'technical') NOT NULL DEFAULT 'general'");
        console.log("Column added successfully");
        process.exit(0);
    } catch (e) {
        if (e.message.includes('Duplicate column name')) {
            console.log("Column already exists.");
            process.exit(0);
        }
        console.error(e);
        process.exit(1);
    }
}

migrate();
