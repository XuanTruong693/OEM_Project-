const { QueryTypes } = require("sequelize");

// Simple in-memory cache for table columns
const columnsCache = new Map();

async function getTableColumns(sequelize, tableName, transaction) {
  const key = tableName.toLowerCase();
  if (columnsCache.has(key)) return columnsCache.get(key);
  const rows = await sequelize.query(
    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
    { replacements: [tableName], type: QueryTypes.SELECT, transaction }
  );
  const set = new Set(rows.map(r => (r.COLUMN_NAME || r["COLUMN_NAME"]).toLowerCase()));
  columnsCache.set(key, set);
  return set;
}

async function hasColumn(sequelize, tableName, columnName, transaction) {
  const cols = await getTableColumns(sequelize, tableName, transaction);
  return cols.has(columnName.toLowerCase());
}

// Build dynamic insert for exams table to tolerate different schemas
async function insertExam(sequelize, data, transaction) {
  const cols = await getTableColumns(sequelize, 'exams', transaction);

  const columns = [];
  const placeholders = [];
  const values = [];

  function pushCol(col, val, isNow = false) {
    if (!cols.has(col)) return;
    columns.push(col);
    if (isNow) {
      placeholders.push('NOW()');
    } else {
      placeholders.push('?');
      values.push(val);
    }
  }

  pushCol('title', data.title);
  pushCol('description', data.description ?? null);

  // duration
  if (cols.has('duration_minutes')) {
    pushCol('duration_minutes', data.duration_minutes ?? data.duration ?? 60);
  } else if (cols.has('duration')) {
    pushCol('duration', data.duration_minutes ?? data.duration ?? 60);
  }

  // instructor
  pushCol('instructor_id', data.instructor_id ?? null);

  // times
  pushCol('start_time', data.start_time ?? null);
  pushCol('end_time', data.end_time ?? null);
  pushCol('status', data.status ?? 'draft');

  // timestamps
  pushCol('created_at', null, true);
  pushCol('updated_at', null, true);

  const sql = `INSERT INTO exams (${columns.join(', ')}) VALUES (${placeholders.join(', ')})`;
  const res = await sequelize.query(sql, { replacements: values, transaction, type: QueryTypes.INSERT });
  let insertId = (res?.[1]?.insertId) || (res?.[0]?.insertId) || res?.[0];
  if (!insertId) {
    const row = await sequelize.query(`SELECT LAST_INSERT_ID() as id`, { type: QueryTypes.SELECT, transaction });
    insertId = row?.[0]?.id || row?.id;
  }
  if (!insertId) {
    // Final fallback: get most recent id with same title/status
    const q = await sequelize.query(
      `SELECT id FROM exams WHERE title = ? ORDER BY id DESC LIMIT 1`,
      { replacements: [data.title], type: QueryTypes.SELECT, transaction }
    );
    insertId = q?.[0]?.id || insertId;
  }
  return insertId;
}

// Build dynamic insert for exam_questions table to tolerate different schemas
async function insertExamQuestion(sequelize, data, transaction) {
  const cols = await getTableColumns(sequelize, 'exam_questions', transaction);

  const columns = [];
  const placeholders = [];
  const values = [];

  function pushCol(col, val, isNow = false) {
    if (!cols.has(col)) return;
    columns.push(col);
    if (isNow) {
      placeholders.push('NOW()');
    } else {
      placeholders.push('?');
      values.push(val);
    }
  }

  pushCol('exam_id', data.exam_id);
  pushCol('question_text', data.question_text);
  pushCol('type', data.type);
  pushCol('model_answer', data.model_answer ?? null);
  pushCol('points', data.points ?? 1);
  pushCol('order_index', data.order_index ?? null);
  pushCol('created_by', data.created_by ?? null);
  pushCol('is_bank_question', data.is_bank_question ?? null);
  pushCol('created_at', null, true);
  pushCol('updated_at', null, true);

  const sql = `INSERT INTO exam_questions (${columns.join(', ')}) VALUES (${placeholders.join(', ')})`;
  const res = await sequelize.query(sql, { replacements: values, transaction, type: QueryTypes.INSERT });
  let insertId = (res?.[1]?.insertId) || (res?.[0]?.insertId) || res?.[0];
  if (!insertId) {
    const row = await sequelize.query(`SELECT LAST_INSERT_ID() as id`, { type: QueryTypes.SELECT, transaction });
    insertId = row?.[0]?.id || row?.id;
  }
  return insertId;
}

function normalizeQuestionType(t) {
  const up = (t || '').toString().trim().toUpperCase();
  if (up === 'MCQ' || up === 'ESSAY') return up === 'MCQ' ? 'MCQ' : 'Essay';
  return t; // leave as is if unknown
}

module.exports = {
  getTableColumns,
  hasColumn,
  insertExam,
  insertExamQuestion,
  normalizeQuestionType,
};