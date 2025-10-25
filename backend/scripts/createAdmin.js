// ===============================
// 🌐 OEM Mini - Tao tai khoan Quan tri (Admin) - CLI v3.0
// ===============================

// ⚙️ Ep dau vao/ra UTF-8 de hien thi khong dau
try {
  if (process.stdin.setEncoding) process.stdin.setEncoding('utf8');
  if (process.stdout.setEncoding) process.stdout.setEncoding('utf8');
} catch {}

// ===============================
// 📦 Import thu vien
// ===============================
const readlineSync = require('readline-sync');
const bcrypt = require('bcrypt');
const sequelize = require('../src/config/db');
const { User } = require('../src/models/User');
const { validateEmailDomain } = require('../src/utils/emailValidator');
const { sendAdminOTPVerificationEmail } = require('../src/services/emailService');

const SALT_ROUNDS = 10;
const OTP_EXPIRE_MINUTES = 5;

// ===============================
// 🛑 Xu ly Ctrl + C (thoat an toan)
// ===============================
//process.on('SIGINT', () => {
//  console.log('\n❌ Qua trinh nhap lieu da bi huy boi nguoi dung.');
//  process.exit(0);
//});

// ===============================
// 🧩 Ham chinh tao tai khoan admin
// ===============================
async function createAdmin() {
  try {
    console.log('🔧 === OEM Mini - Tao tai khoan Quan tri (Admin) ===\n');

    // 1️⃣ Ket noi DB
    await sequelize.authenticate();
    console.log('✅ Ket noi co so du lieu thanh cong!\n');

    // 2️⃣ Nhap ho ten
    let fullName;
    while (true) {
      fullName = readlineSync.question('Ho va ten: ');
      if (fullName.trim()) break;
      console.log('❌ Ten khong duoc de trong. Vui long nhap lai.\n');
    }

    // 3️⃣ Nhap email + kiem tra ton tai + kiem tra ten mien hop le
    let email;
    while (true) {
      email = readlineSync.questionEMail('Dia chi email: ');
      if (!email) {
        console.log('❌ Email khong hop le. Vui long nhap lai.\n');
        continue;
      }

      // Kiem tra ten mien hop le bang DNS MX
      try {
        await validateEmailDomain(email);
      } catch {
        const retry = readlineSync.keyInYNStrict('Ban co muon nhap lai email khac khong? (y/n): ');
        if (!retry) {
          console.log('❌ Huy tao tai khoan quan tri.');
          process.exit(0);
        }
        continue;
      }

      // Kiem tra email da ton tai trong DB
      const existingUser = await User.findOne({ where: { email: email.toLowerCase().trim() } });
      if (existingUser) {
        console.log('⚠️ Email nay da duoc su dung trong he thong.');
        const retry = readlineSync.keyInYNStrict('Ban co muon nhap email khac khong? (y/n): ');
        if (!retry) {
          console.log('❌ Huy tao tai khoan quan tri.');
          process.exit(0);
        }
        continue;
      }

      break; // Email hop le va chua ton tai
    }

    // 4️⃣ Gui ma OTP xac minh
    const otpCode = Math.floor(100000 + Math.random() * 900000);
    console.log(`📨 Dang gui ma OTP den ${email} ...`);
    const otpResult = await sendAdminOTPVerificationEmail(email, otpCode, fullName);

    if (!otpResult.success) {
      console.log('❌ Khong the gui ma OTP. Thu lai sau.');
      process.exit(1);
    }

    console.log('✅ Da gui ma OTP thanh cong. Vui long kiem tra hop thu cua ban.');
    console.log(`⏰ Ma OTP co hieu luc trong ${OTP_EXPIRE_MINUTES} phut.\n`);

    // 5️⃣ Nguoi dung nhap OTP de xac minh
    const otpStartTime = Date.now();
    let verified = false;

    while (true) {
      const now = Date.now();
      const elapsedMinutes = (now - otpStartTime) / (1000 * 60);

      if (elapsedMinutes > OTP_EXPIRE_MINUTES) {
        console.log('⌛ Ma OTP da het han. Vui long chay lai lenh tao tai khoan.');
        process.exit(0);
      }

      const inputOTP = readlineSync.question('Nhap ma OTP duoc gui den email: ');
      if (inputOTP.trim() === otpCode.toString()) {
        console.log('✅ Xac minh email thanh cong!\n');
        verified = true;
        break;
      } else {
        console.log('❌ Ma OTP khong dung. Vui long nhap lai hoac nhan Ctrl + C de thoat.\n');
      }
    }

    if (!verified) {
      console.log('❌ Email chua duoc xac minh. Huy tao tai khoan.');
      process.exit(0);
    }

    // 6️⃣ Nhap mat khau
    let password;
    while (true) {
      password = readlineSync.question('Mat khau: ', { hideEchoBack: true });
      if (password.length >= 8) break;
      console.log('❌ Mat khau phai co it nhat 8 ky tu.\n');
    }

    // 7️⃣ Xac nhan mat khau
    let confirmPassword;
    while (true) {
      confirmPassword = readlineSync.question('Xac nhan mat khau: ', { hideEchoBack: true });
      if (confirmPassword === password) break;
      console.log('❌ Mat khau xac nhan khong khop.\n');
    }

    // 8️⃣ Hien thi thong tin truoc khi tao
    console.log('\n📋 Thong tin tai khoan quan tri:');
    console.log(`   Ho ten: ${fullName}`);
    console.log(`   Email: ${email}`);
    console.log(`   Vai tro: admin\n`);

    const confirm = readlineSync.keyInYNStrict('Ban co chac muon tao tai khoan nay khong? (y/n): ');
    if (!confirm) {
      console.log('❌ Huy tao tai khoan quan tri.');
      process.exit(0);
    }

    // 9️⃣ Ma hoa mat khau va luu DB
    console.log('🔐 Dang ma hoa mat khau...');
    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

    console.log('💾 Dang luu vao co so du lieu...');
    const newAdmin = await User.create({
      full_name: fullName.trim(),
      email: email.toLowerCase().trim(),
      password_hash: hashedPassword,
      role: 'admin',
      created_at: new Date(),
    });

    // 🔟 Hoan tat
    console.log('\n✅ Tao tai khoan Quan tri thanh cong!');
    console.log(`   ID: ${newAdmin.id}`);
    console.log(`   Ho ten: ${newAdmin.full_name}`);
    console.log(`   Email: ${newAdmin.email}`);
    console.log(`   Vai tro: ${newAdmin.role}`);
    console.log('\n🎉 Ban co the dang nhap bang email va mat khau vua tao.');

  } catch (error) {
    console.error('❌ Loi trong qua trinh tao tai khoan admin:', error.message);
  } finally {
    await sequelize.close();
    process.exit(0);
  }
}

// ===============================
// 🏁 Chay chuong trinh
// ===============================
createAdmin();
