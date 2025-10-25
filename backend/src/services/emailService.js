const nodemailer = require('nodemailer');

// Cấu hình email transporter
const createTransporter = () => {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER || 'truongkt693@gmail.com',
      pass: process.env.EMAIL_PASS || 'tqdb bzaa cqzd iuwf'
    }
  });
};

// Gửi OTP email
const sendOTPEmail = async (email, otp) => {
  try {
    console.log(`📧 [Email Service] Đang gửi OTP ${otp} đến ${email}`);
    const transporter = createTransporter();
    
    const mailOptions = {
      from: process.env.EMAIL_USER || 'truongkt693@gmail.com',
      to: email,
      subject: 'Mã OTP xác minh email - OEM Mini Examitation',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 28px;">OEM System</h1>
            <p style="color: white; margin: 10px 0 0 0; font-size: 16px;">Xác minh email đăng ký</p>
          </div>
          
          <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px;">
            <h2 style="color: #333; margin-top: 0;">Mã xác minh của bạn</h2>
            <p style="color: #666; font-size: 16px; line-height: 1.6;">
              Chào bạn!<br>
              Bạn đang đăng ký tài khoản trên hệ thống OEM. Để hoàn tất quá trình đăng ký, 
              vui lòng sử dụng mã OTP sau:
            </p>
            
            <div style="background: white; border: 2px dashed #667eea; border-radius: 10px; padding: 20px; margin: 20px 0; text-align: center;">
              <h1 style="color: #667eea; font-size: 36px; margin: 0; letter-spacing: 5px; font-family: 'Courier New', monospace;">
                ${otp}
              </h1>
            </div>
            
            <div style="background: #fff3cd; border: 1px solid #ffeaa7; border-radius: 5px; padding: 15px; margin: 20px 0;">
              <p style="color: #856404; margin: 0; font-size: 14px;">
                <strong>⚠️ Lưu ý quan trọng:</strong><br>
                • Mã OTP có hiệu lực trong 5 phút<br>
                • Không chia sẻ mã này với bất kỳ ai<br>
                • Nếu bạn không yêu cầu mã này, vui lòng bỏ qua email
              </p>
            </div>
            
            <p style="color: #666; font-size: 14px; margin-top: 30px;">
              Trân trọng,<br>
              <strong>Đội ngũ OEM System</strong>
            </p>
          </div>
        </div>
      `
    };

    const result = await transporter.sendMail(mailOptions);
    console.log(`📧 [Email Service] OTP đã gửi thành công đến ${email}:`, result.messageId);
    return { success: true, messageId: result.messageId };
    
  } catch (error) {
    console.error('❌ [Email Service] Lỗi gửi email:', error);
    return { success: false, error: error.message };
  }
};

// ==========================
// 📩 GUI EMAIL XAC MINH TAI KHOAN ADMIN (CLI TOOL)
// ==========================
const sendAdminOTPVerificationEmail = async (adminEmail, otpCode, fullName = 'Admin') => {
  try {
    console.log(`📧 [Admin Email Service] Dang gui ma OTP xac minh den ${adminEmail}`);
    const transporter = createTransporter();

    const mailOptions = {
      from: process.env.EMAIL_USER || 'truongkt693@gmail.com',
      to: adminEmail,
      subject: 'Ma OTP xac minh tai khoan Quan tri - OEM System',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #2c5364 0%, #203a43 50%, #0f2027 100%); padding: 25px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="color: #ffffff; margin: 0; font-size: 24px;">OEM Mini System</h1>
            <p style="color: #dcdcdc; font-size: 14px;">Xac minh tai khoan Quan tri</p>
          </div>
          <div style="background: #f8f9fa; padding: 25px; border-radius: 0 0 10px 10px;">
            <p style="color: #333;">Xin chao <strong>${fullName}</strong>,</p>
            <p style="color: #333;">
              Ban dang thuc hien xac minh email de tao tai khoan Quan tri (Admin).<br>
              Vui long su dung ma OTP duoi day de hoan tat buoc xac minh:
            </p>
            <div style="background: #fff; border: 2px dashed #203a43; border-radius: 10px; padding: 15px; margin: 20px 0; text-align: center;">
              <h2 style="color: #203a43; font-family: 'Courier New', monospace; letter-spacing: 4px; font-size: 32px; margin: 0;">
                ${otpCode}
              </h2>
            </div>
            <p style="color: #555; font-size: 14px;">
              ⏰ Ma OTP co hieu luc trong <strong>5 phut</strong> ke tu luc duoc gui.<br>
              Neu ban khong yeu cau, vui long bo qua email nay.
            </p>
            <p style="color: #444; font-size: 14px; margin-top: 30px;">
              Tran trong,<br>
              <strong>DOI NGU PHAT TRIEN OEM SYSTEM</strong>
            </p>
          </div>
        </div>
      `
    };

    const result = await transporter.sendMail(mailOptions);
    console.log(`✅ [Admin Email Service] Gui ma OTP thanh cong den ${adminEmail} | MessageID: ${result.messageId}`);
    return { success: true, messageId: result.messageId };

  } catch (error) {
    console.error('❌ [Admin Email Service] Loi khi gui ma OTP:', error.message);
    return { success: false, error: error.message };
  }
};


// Test email configuration
const testEmailConfig = async () => {
  try {
    const transporter = createTransporter();
    await transporter.verify();
    console.log('✅ [Email Service] Cấu hình email hợp lệ - truongkt693@gmail.com');
    return true;
  } catch (error) {
    console.error('❌ [Email Service] Lỗi cấu hình email:', error.message);
    console.log('📖 Kiểm tra lại EMAIL_USER và EMAIL_PASS');
    return false;
  }
};

module.exports = {
  sendOTPEmail,
  sendAdminOTPVerificationEmail, // 🆕
  testEmailConfig
};

