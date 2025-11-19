const fs = require('fs');
const path = require('path');

// Lưu appRole vào file JSON để persist qua restart
const ROLE_FILE = path.join(__dirname, '../../.appRole.json');

function readRoleFromFile() {
  try {
    if (fs.existsSync(ROLE_FILE)) {
      const data = fs.readFileSync(ROLE_FILE, 'utf8');
      const parsed = JSON.parse(data);
      return parsed.role || null;
    }
  } catch (err) {
    console.error('[appRole] Error reading role file:', err.message);
  }
  return process.env.APP_ROLE || null;
}

function writeRoleToFile(role) {
  try {
    fs.writeFileSync(ROLE_FILE, JSON.stringify({ role: role || null }, null, 2), 'utf8');
  } catch (err) {
    console.error('[appRole] Error writing role file:', err.message);
  }
}

let currentRole = readRoleFromFile();
console.log('[appRole] 📍 Loaded role on startup:', currentRole);

function getAppRole() {
  return currentRole;
}

function setAppRole(role) {
  currentRole = role || null;
  writeRoleToFile(currentRole);
  console.log(`[appRole] 📝 Role updated to: ${currentRole}`);
  return currentRole;
}

module.exports = { getAppRole, setAppRole };