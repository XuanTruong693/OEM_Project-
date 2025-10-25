// ================================
// 🧩 OEM Mini - Email Validator Utils
// ================================
const dns = require('dns').promises;

/**
 * Kiem tra ten mien email co ton tai thuc su khong (kiem tra MX record)
 * @param {string} email - Dia chi email can kiem tra
 * @returns {Promise<boolean>} - Tra ve true neu hop le, nguoc lai throw Error
 */
async function validateEmailDomain(email) {
  try {
    // Kiem tra dinh dang email co hop le khong (regex don gian)
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      console.log('❌ Email khong dung dinh dang. Vui long nhap lai.');
      throw new Error('Email khong hop le');
    }

    // Tach ten mien sau dau @
    const domain = email.split('@')[1];
    if (!domain) {
      console.log('❌ Khong tim thay ten mien trong dia chi email.');
      throw new Error('Email khong hop le');
    }

    console.log(`🔎 Dang kiem tra ten mien: ${domain} ...`);

    // Kiem tra MX record
    const mxRecords = await dns.resolveMx(domain);
    if (!mxRecords || mxRecords.length === 0) {
      console.log('❌ Ten mien khong ton tai hoac khong co MX record.');
      throw new Error('Ten mien email khong hop le');
    }

    console.log('✅ Ten mien email hop le va co kha nang nhan thu.');
    return true;

  } catch (error) {
    // Truong hop domain khong ton tai
    if (error.code === 'ENOTFOUND') {
      console.log('❌ Ten mien khong ton tai tren he thong DNS.');
    } else if (error.code === 'ETIMEOUT') {
      console.log('⚠️ Ket noi DNS bi tre. Thu lai sau.');
    } else {
      console.log(`❌ Loi xay ra khi kiem tra email: ${error.message}`);
    }
    throw error;
  }
}

module.exports = {
  validateEmailDomain
};
