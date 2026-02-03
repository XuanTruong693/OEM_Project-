const sequelize = require("../config/db");

class BaseRepository {
    constructor(tableName) {
        this.tableName = tableName;
        this.db = sequelize;
    }

    /**
     * Check if a column exists in the table
     * @param {string} column - Column name
     * @returns {Promise<boolean>}
     */
    async hasColumn(column) {
        const [rows] = await this.db.query(
            `SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ? LIMIT 1`,
            { replacements: [this.tableName, column] }
        );
        return Array.isArray(rows) && rows.length > 0;
    }

    /**
     * Find by ID
     * @param {number} id - Record ID
     * @param {string[]} columns - Columns to select (default: all)
     * @returns {Promise<Object|null>}
     */
    async findById(id, columns = ["*"]) {
        const cols = columns.join(", ");
        const [rows] = await this.db.query(
            `SELECT ${cols} FROM ${this.tableName} WHERE id = ? LIMIT 1`,
            { replacements: [id] }
        );
        return Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
    }

    /**
     * Find one by condition
     * @param {Object} where - Where conditions
     * @param {string[]} columns - Columns to select
     * @returns {Promise<Object|null>}
     */
    async findOne(where, columns = ["*"]) {
        const cols = columns.join(", ");
        const keys = Object.keys(where);
        const conditions = keys.map(k => `${k} = ?`).join(" AND ");
        const values = Object.values(where);

        const [rows] = await this.db.query(
            `SELECT ${cols} FROM ${this.tableName} WHERE ${conditions} LIMIT 1`,
            { replacements: values }
        );
        return Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
    }

    /**
     * Find all by condition
     * @param {Object} where - Where conditions
     * @param {string[]} columns - Columns to select
     * @param {string} orderBy - Order by clause
     * @returns {Promise<Array>}
     */
    async findAll(where = {}, columns = ["*"], orderBy = "id DESC") {
        const cols = columns.join(", ");
        const keys = Object.keys(where);

        let query = `SELECT ${cols} FROM ${this.tableName}`;
        let values = [];

        if (keys.length > 0) {
            const conditions = keys.map(k => `${k} = ?`).join(" AND ");
            values = Object.values(where);
            query += ` WHERE ${conditions}`;
        }

        query += ` ORDER BY ${orderBy}`;

        const [rows] = await this.db.query(query, { replacements: values });
        return Array.isArray(rows) ? rows : [];
    }

    /**
     * Count records by condition
     * @param {Object} where - Where conditions
     * @returns {Promise<number>}
     */
    async count(where = {}) {
        const keys = Object.keys(where);

        let query = `SELECT COUNT(*) as count FROM ${this.tableName}`;
        let values = [];

        if (keys.length > 0) {
            const conditions = keys.map(k => `${k} = ?`).join(" AND ");
            values = Object.values(where);
            query += ` WHERE ${conditions}`;
        }

        const [rows] = await this.db.query(query, { replacements: values });
        return rows[0]?.count || 0;
    }

    /**
     * Update by ID
     * @param {number} id - Record ID
     * @param {Object} data - Data to update
     * @returns {Promise<boolean>}
     */
    async updateById(id, data) {
        const keys = Object.keys(data);
        const sets = keys.map(k => `${k} = ?`).join(", ");
        const values = [...Object.values(data), id];

        const [result] = await this.db.query(
            `UPDATE ${this.tableName} SET ${sets} WHERE id = ?`,
            { replacements: values }
        );
        return result.affectedRows > 0;
    }

    /**
     * Insert new record
     * @param {Object} data - Data to insert
     * @returns {Promise<number>} Inserted ID
     */
    async insert(data) {
        const keys = Object.keys(data);
        const cols = keys.join(", ");
        const placeholders = keys.map(() => "?").join(", ");
        const values = Object.values(data);

        const [result] = await this.db.query(
            `INSERT INTO ${this.tableName} (${cols}) VALUES (${placeholders})`,
            { replacements: values }
        );
        return result.insertId || result;
    }

    /**
     * Execute raw query
     * @param {string} sql - SQL query
     * @param {Array} replacements - Query parameters
     * @returns {Promise<Array>}
     */
    async query(sql, replacements = []) {
        const [rows] = await this.db.query(sql, { replacements });
        return rows;
    }
}

module.exports = BaseRepository;
