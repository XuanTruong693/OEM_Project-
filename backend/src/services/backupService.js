/**
 * Backup Service
 * Xử lý backup và restore database oem_mini
 */

const { exec } = require('child_process');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const zlib = require('zlib');
const { promisify } = require('util');
const gzip = promisify(zlib.gzip);
const gunzip = promisify(zlib.gunzip);

const { BackupMetadata, RestoreHistory } = require('../models/adminModels');
const { logActivity } = require('../middleware/activityLogger');
const { pool } = require('../config/db');

// Thư mục lưu backup
const BACKUP_DIR = path.join(__dirname, '../../backups');

/**
 * Đảm bảo thư mục backup tồn tại
 */
const ensureBackupDir = async () => {
    try {
        await fs.mkdir(BACKUP_DIR, { recursive: true });
    } catch (error) {
        console.error('Error creating backup directory:', error.message);
    }
};

/**
 * Tính SHA256 checksum của file
 */
const calculateChecksum = async (filePath) => {
    const fileBuffer = await fs.readFile(filePath);
    return crypto.createHash('sha256').update(fileBuffer).digest('hex');
};

/**
 * Format file size cho dễ đọc
 */
const formatFileSize = (bytes) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
    if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
    return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
};

/**
 * Đếm số records trong database
 */
const countAllRecords = async () => {
    try {
        const [tables] = await pool.query('SHOW TABLES');
        let totalRecords = 0;

        for (const table of tables) {
            const tableName = Object.values(table)[0];
            const [result] = await pool.query(`SELECT COUNT(*) as count FROM \`${tableName}\``);
            totalRecords += result[0].count;
        }

        return { tablesCount: tables.length, recordsCount: totalRecords };
    } catch (error) {
        console.error('Error counting records:', error.message);
        return { tablesCount: 0, recordsCount: 0 };
    }
};

/**
 * Tạo backup database
 * @param {Object} options - Thông tin backup
 * @param {string} options.backupType - Loại backup: 'manual', 'scheduled', 'before_restore'
 * @param {number} options.performedBy - ID admin thực hiện (null nếu scheduled)
 * @param {string} options.performedByEmail - Email admin
 * @returns {Object} - Thông tin backup
 */
const createBackup = async (options) => {
    const { backupType = 'manual', performedBy = null, performedByEmail = null } = options;

    await ensureBackupDir();

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').slice(0, -5);
    const fileName = `oem_mini_backup_${timestamp}.sql`;
    const compressedFileName = `${fileName}.gz`;
    const filePath = path.join(BACKUP_DIR, compressedFileName);
    const relativePath = `backups/${compressedFileName}`;

    // Tạo record metadata với status in_progress
    const backupRecord = await BackupMetadata.create({
        backup_type: backupType,
        file_name: compressedFileName,
        file_path: relativePath,
        performed_by: performedBy,
        performed_by_email: performedByEmail,
        status: 'in_progress',
        started_at: new Date(),
        db_name: process.env.DB_NAME || 'oem_mini'
    });

    console.log(`📦 [Backup] Starting ${backupType} backup... ID: ${backupRecord.id}`);

    try {
        // Đếm records trước backup
        const { tablesCount, recordsCount } = await countAllRecords();

        // Tạo lệnh mysqldump
        const dbHost = process.env.DB_HOST || 'localhost';
        const dbUser = process.env.DB_USER;
        const dbPassword = process.env.DB_PASSWORD;
        const dbName = process.env.DB_NAME || 'oem_mini';
        const dbPort = process.env.DB_PORT || 3306;

        // Sử dụng raw SQL queries thay vì mysqldump để tương thích hơn
        const dumpData = await generateSQLDump(dbName);

        // Nén dữ liệu
        const compressedData = await gzip(Buffer.from(dumpData, 'utf8'));

        // Lưu file
        await fs.writeFile(filePath, compressedData);

        // Lấy thông tin file
        const fileStats = await fs.stat(filePath);
        const checksum = await calculateChecksum(filePath);

        // Cập nhật metadata
        await backupRecord.update({
            status: 'completed',
            completed_at: new Date(),
            file_size: fileStats.size,
            tables_count: tablesCount,
            records_count: recordsCount,
            checksum: checksum
        });

        console.log(`✅ [Backup] Completed! File: ${compressedFileName}, Size: ${formatFileSize(fileStats.size)}`);

        // Log activity nếu có admin
        if (performedBy && performedByEmail) {
            await logActivity({
                adminId: performedBy,
                adminEmail: performedByEmail,
                actionType: 'backup',
                targetTable: 'database',
                description: `Backup ${backupType}: ${compressedFileName} (${formatFileSize(fileStats.size)}, ${recordsCount} records)`
            });
        }

        return {
            success: true,
            backupId: backupRecord.id,
            fileName: compressedFileName,
            filePath: relativePath,
            fileSize: fileStats.size,
            fileSizeFormatted: formatFileSize(fileStats.size),
            tablesCount,
            recordsCount,
            checksum
        };

    } catch (error) {
        console.error('❌ [Backup] Error:', error.message);

        // Cập nhật status failed
        await backupRecord.update({
            status: 'failed',
            completed_at: new Date(),
            error_message: error.message
        });

        return {
            success: false,
            error: error.message,
            backupId: backupRecord.id
        };
    }
};

/**
 * Tạo SQL dump từ database (thay thế mysqldump)
 */
const generateSQLDump = async (dbName) => {
    let dump = `-- OEM Mini Database Backup\n`;
    dump += `-- Generated at: ${new Date().toISOString()}\n`;
    dump += `-- Database: ${dbName}\n\n`;
    dump += `SET FOREIGN_KEY_CHECKS=0;\n\n`;

    try {
        // Lấy danh sách tables (chỉ BASE TABLE, không lấy VIEWS)
        const [tables] = await pool.query("SHOW FULL TABLES WHERE Table_type = 'BASE TABLE'");

        for (const table of tables) {
            // Tên table là cột đầu tiên
            const tableName = Object.values(table)[0];

            // Skip nếu là view (double check)
            if (tableName.startsWith('v_')) {
                console.log(`⏭️ [Backup] Skipping view: ${tableName}`);
                continue;
            }

            // Lấy CREATE TABLE statement
            const [createResult] = await pool.query(`SHOW CREATE TABLE \`${tableName}\``);
            const createStatement = createResult[0]['Create Table'];

            // Skip nếu không có CREATE TABLE (có thể là view)
            if (!createStatement) {
                console.log(`⏭️ [Backup] Skipping (no CREATE TABLE): ${tableName}`);
                continue;
            }

            dump += `-- Table: ${tableName}\n`;
            dump += `DROP TABLE IF EXISTS \`${tableName}\`;\n`;
            dump += `${createStatement};\n\n`;

            // Lấy dữ liệu
            const [rows] = await pool.query(`SELECT * FROM \`${tableName}\``);

            if (rows.length > 0) {
                // Lấy tên columns
                const columns = Object.keys(rows[0]);
                const columnNames = columns.map(c => `\`${c}\``).join(', ');

                // Tạo INSERT statements (batch 100 rows)
                const batchSize = 100;
                for (let i = 0; i < rows.length; i += batchSize) {
                    const batch = rows.slice(i, i + batchSize);
                    const values = batch.map(row => {
                        const rowValues = columns.map(col => {
                            const val = row[col];
                            if (val === null) return 'NULL';
                            if (typeof val === 'number') return val;
                            if (val instanceof Date) return `'${val.toISOString().slice(0, 19).replace('T', ' ')}'`;
                            if (typeof val === 'object') return `'${JSON.stringify(val).replace(/'/g, "\\'")}'`;
                            return `'${String(val).replace(/'/g, "\\'").replace(/\n/g, '\\n')}'`;
                        });
                        return `(${rowValues.join(', ')})`;
                    });

                    dump += `INSERT INTO \`${tableName}\` (${columnNames}) VALUES\n${values.join(',\n')};\n`;
                }
                dump += '\n';
            }
        }

        dump += `SET FOREIGN_KEY_CHECKS=1;\n`;

        return dump;

    } catch (error) {
        console.error('Error generating SQL dump:', error.message);
        throw error;
    }
};

/**
 * Restore database từ backup
 * @param {Object} options - Thông tin restore
 * @param {number} options.backupId - ID của backup cần restore
 * @param {number} options.performedBy - ID admin thực hiện
 * @param {string} options.performedByEmail - Email admin
 * @returns {Object} - Kết quả restore
 */
const restoreBackup = async (options) => {
    const { backupId, performedBy, performedByEmail } = options;

    // Lấy thông tin backup
    const backup = await BackupMetadata.findByPk(backupId);
    if (!backup) {
        throw new Error('Backup không tồn tại');
    }

    if (backup.status !== 'completed') {
        throw new Error('Backup chưa hoàn thành hoặc đã thất bại');
    }

    const backupFilePath = path.join(__dirname, '../..', backup.file_path);

    // Kiểm tra file tồn tại
    try {
        await fs.access(backupFilePath);
    } catch {
        throw new Error('File backup không tồn tại');
    }

    // Tạo backup trước khi restore (pre-restore backup)
    console.log('📦 [Restore] Creating pre-restore backup...');
    const preRestoreResult = await createBackup({
        backupType: 'before_restore',
        performedBy,
        performedByEmail
    });

    if (!preRestoreResult.success) {
        throw new Error('Không thể tạo backup trước khi restore: ' + preRestoreResult.error);
    }

    // Tạo record restore history
    const restoreRecord = await RestoreHistory.create({
        backup_id: backupId,
        performed_by: performedBy,
        performed_by_email: performedByEmail,
        status: 'in_progress',
        started_at: new Date(),
        pre_restore_backup_id: preRestoreResult.backupId
    });

    console.log(`🔄 [Restore] Starting restore from backup ID: ${backupId}...`);

    try {
        // Verify checksum
        const currentChecksum = await calculateChecksum(backupFilePath);
        if (backup.checksum && currentChecksum !== backup.checksum) {
            throw new Error('Checksum không khớp - file backup có thể bị hỏng');
        }

        // Đọc và giải nén file
        const compressedData = await fs.readFile(backupFilePath);
        const sqlData = (await gunzip(compressedData)).toString('utf8');

        // Thực thi SQL statements
        const statements = sqlData.split(';').filter(s => s.trim());

        for (const statement of statements) {
            const trimmed = statement.trim();
            if (trimmed && !trimmed.startsWith('--')) {
                try {
                    await pool.query(trimmed);
                } catch (err) {
                    // Bỏ qua một số lỗi không quan trọng
                    if (!err.message.includes('already exists') &&
                        !err.message.includes("doesn't exist")) {
                        console.warn(`⚠️ [Restore] Warning executing statement: ${err.message}`);
                    }
                }
            }
        }

        // Cập nhật restore record
        await restoreRecord.update({
            status: 'completed',
            completed_at: new Date()
        });

        console.log(`✅ [Restore] Completed! Restored from: ${backup.file_name}`);

        // Log activity
        await logActivity({
            adminId: performedBy,
            adminEmail: performedByEmail,
            actionType: 'restore',
            targetTable: 'database',
            description: `Restore từ backup: ${backup.file_name} (${formatFileSize(backup.file_size)})`
        });

        return {
            success: true,
            restoreId: restoreRecord.id,
            restoredFrom: backup.file_name,
            preRestoreBackupId: preRestoreResult.backupId
        };

    } catch (error) {
        console.error('❌ [Restore] Error:', error.message);

        await restoreRecord.update({
            status: 'failed',
            completed_at: new Date(),
            error_message: error.message
        });

        return {
            success: false,
            error: error.message,
            restoreId: restoreRecord.id,
            preRestoreBackupId: preRestoreResult.backupId
        };
    }
};

/**
 * Lấy danh sách backups
 */
const getBackupList = async (options = {}) => {
    const { limit = 20, offset = 0, status = null } = options;

    const where = {};
    if (status) {
        where.status = status;
    }

    const backups = await BackupMetadata.findAndCountAll({
        where,
        order: [['started_at', 'DESC']],
        limit,
        offset
    });

    return {
        total: backups.count,
        backups: backups.rows.map(b => ({
            ...b.toJSON(),
            fileSizeFormatted: formatFileSize(b.file_size)
        }))
    };
};

/**
 * Xóa backup cũ theo retention policy
 */
const cleanupOldBackups = async (retentionDays = 30) => {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    try {
        const oldBackups = await BackupMetadata.findAll({
            where: {
                started_at: { [require('sequelize').Op.lt]: cutoffDate },
                backup_type: { [require('sequelize').Op.ne]: 'before_restore' } // Giữ lại pre-restore backups
            }
        });

        let deletedCount = 0;

        for (const backup of oldBackups) {
            try {
                const filePath = path.join(__dirname, '../..', backup.file_path);
                await fs.unlink(filePath);
                await backup.destroy();
                deletedCount++;
            } catch (err) {
                console.warn(`⚠️ [Cleanup] Could not delete backup ${backup.id}: ${err.message}`);
            }
        }

        console.log(`🧹 [Cleanup] Deleted ${deletedCount} old backups`);
        return { deletedCount };

    } catch (error) {
        console.error('❌ [Cleanup] Error:', error.message);
        return { deletedCount: 0, error: error.message };
    }
};

module.exports = {
    createBackup,
    restoreBackup,
    getBackupList,
    cleanupOldBackups,
    ensureBackupDir,
    formatFileSize
};
