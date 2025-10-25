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
  testEmailConfig
};
