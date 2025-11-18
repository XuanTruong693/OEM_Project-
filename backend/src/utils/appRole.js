let currentRole = process.env.APP_ROLE || null;

function getAppRole() {
  return currentRole;
}

function setAppRole(role) {
  currentRole = role || null;
  return currentRole;
}

module.exports = { getAppRole, setAppRole };