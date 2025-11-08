const fs = require('fs');
const mysql = require('mysql2/promise');
require('dotenv').config();

async function runMigration() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    multipleStatements: true
  });

  try {
    console.log('🔄 Running database migration...');
    
    const sql = fs.readFileSync('../database/oem_migration_v5.sql', 'utf8');
    await connection.execute(sql);
    
    console.log('✅ Migration completed successfully');
  } catch (error) {
    console.error('❌ Migration error:', error.message);
  } finally {
    await connection.end();
  }
}

runMigration();