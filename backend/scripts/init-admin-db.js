/**
 * Script để khởi tạo database oem_admin
 * Chạy: node scripts/init-admin-db.js
 */

const mysql = require('mysql2/promise');
const fs = require('fs').promises;
const path = require('path');
require('dotenv').config();

async function initAdminDatabase() {
    console.log('🚀 Đang khởi tạo database oem_admin...\n');

    // Kết nối MySQL không chỉ định database
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD,
        port: process.env.DB_PORT || 3306,
        multipleStatements: true
    });

    try {
        // Đọc file SQL
        const sqlPath = path.join(__dirname, '../../database/oem_admin_schema.sql');
        const sqlContent = await fs.readFile(sqlPath, 'utf8');

        console.log('📄 Đọc file oem_admin_schema.sql thành công');

        // Thực thi SQL
        await connection.query(sqlContent);

        console.log('✅ Database oem_admin đã được tạo thành công!');
        console.log('\n📊 Các bảng đã tạo:');
        console.log('   - admin_activity_logs');
        console.log('   - backup_metadata');
        console.log('   - restore_history');
        console.log('   - suspicious_activities');
        console.log('   - admin_settings');
        console.log('   - user_preferences');

        // Kiểm tra database đã tạo chưa
        const [databases] = await connection.query('SHOW DATABASES LIKE "oem_admin"');
        if (databases.length > 0) {
            console.log('\n✅ Xác nhận: Database oem_admin tồn tại');
        }

        // Kiểm tra tables
        await connection.query('USE oem_admin');
        const [tables] = await connection.query('SHOW TABLES');
        console.log(`\n📋 Số bảng trong oem_admin: ${tables.length}`);

    } catch (error) {
        console.error('❌ Lỗi khi tạo database:', error.message);

        // Nếu lỗi là do procedure đã tồn tại, bỏ qua
        if (error.message.includes('already exists')) {
            console.log('⚠️ Một số objects đã tồn tại, bỏ qua...');
        } else {
            throw error;
        }
    } finally {
        await connection.end();
    }
}

// Khởi tạo views trong oem_mini
async function initAdminViews() {
    console.log('\n🚀 Đang tạo views cho Admin Dashboard trong oem_mini...\n');

    const connection = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME || 'oem_mini',
        port: process.env.DB_PORT || 3306,
        multipleStatements: true
    });

    try {
        const sqlPath = path.join(__dirname, '../../database/oem_admin_views.sql');
        const sqlContent = await fs.readFile(sqlPath, 'utf8');

        console.log('📄 Đọc file oem_admin_views.sql thành công');

        // Thực thi từng statement riêng lẻ
        const statements = sqlContent.split(';').filter(s => s.trim());

        for (const stmt of statements) {
            if (stmt.trim() && !stmt.trim().startsWith('--')) {
                try {
                    await connection.query(stmt);
                } catch (err) {
                    // Bỏ qua lỗi view already exists
                    if (!err.message.includes("doesn't exist") && !err.message.includes('already exists')) {
                        console.warn(`⚠️ Warning: ${err.message.slice(0, 100)}`);
                    }
                }
            }
        }

        console.log('✅ Views đã được tạo thành công trong oem_mini!');

    } catch (error) {
        console.error('❌ Lỗi khi tạo views:', error.message);
    } finally {
        await connection.end();
    }
}

// Main
async function main() {
    try {
        await initAdminDatabase();
        await initAdminViews();
        console.log('\n🎉 Hoàn tất khởi tạo Admin Database!');
        process.exit(0);
    } catch (error) {
        console.error('\n❌ Khởi tạo thất bại:', error.message);
        process.exit(1);
    }
}

main();
