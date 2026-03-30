const sequelize = require('../src/config/db');

async function fix() {
    try {
        console.log("Checking if 'intent_shuffle' column exists in 'exams' table...");
        try {
            const [results] = await sequelize.query("SHOW COLUMNS FROM exams LIKE 'intent_shuffle'");

            if (results.length === 0) {
                console.log("Column 'intent_shuffle' not found. Adding it...");
                await sequelize.query("ALTER TABLE exams ADD COLUMN intent_shuffle TINYINT(1) NOT NULL DEFAULT 0;");
                console.log("Column added successfully.");
            } else {
                console.log("Column 'intent_shuffle' already exists.");
            }
        } catch (e) {
            console.error("Error during checking/adding column:", e.message);
        }

    } catch (err) {
        console.error("General Error:", err);
    } finally {
        // We need to close the connection to exit the script cleanly
        try {
            await sequelize.close();
            if (sequelize.pool) await sequelize.pool.end();
            if (sequelize.adminSequelize) await sequelize.adminSequelize.close();
            if (sequelize.adminPool) await sequelize.adminPool.end();
        } catch (e) { }
        process.exit(0);
    }
}

fix();
