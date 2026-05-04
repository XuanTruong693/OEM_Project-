import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import 'package:url_launcher/url_launcher.dart';

// Import file chứa các widget phụ trợ
import '../widgets/guidelines/guideline_widgets.dart';

class ExamGuidelinesPage extends StatelessWidget {
  const ExamGuidelinesPage({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      body: SafeArea(
        child: CustomScrollView(
          slivers: [
            // 1. Sticky Header
            SliverAppBar(
              pinned: true,
              backgroundColor: Colors.white.withOpacity(0.95),
              elevation: 0.5,
              leadingWidth: 100,
              leading: TextButton.icon(
                onPressed: () {
                  if (context.canPop()) {
                    context.pop();
                  } else {
                    context.go('/student-dashboard');
                  }
                },
                icon: const Icon(Icons.arrow_back, color: Color(0xFF334155)),
                label: const Text(
                  'Quay lại',
                  style: TextStyle(
                    color: Color(0xFF334155),
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ),
              title: Image.asset('assets/images/app_logo.png', height: 36, errorBuilder: (context, error, stackTrace) => const Icon(Icons.school, color: Colors.blue)),
              centerTitle: true,
              actions: [
                Container(
                  margin: const EdgeInsets.only(right: 16, top: 10, bottom: 10),
                  padding: const EdgeInsets.symmetric(horizontal: 12),
                  decoration: BoxDecoration(
                    color: const Color(0xFFF8FAFC),
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: Colors.grey.shade200),
                  ),
                  child: Row(
                    children: [
                      const Icon(
                        Icons.calendar_today_outlined,
                        size: 16,
                        color: Color(0xFF64748B),
                      ),
                      const SizedBox(width: 8),
                      Text(
                        DateFormat('dd/MM/yyyy').format(DateTime.now()),
                        style: const TextStyle(
                          fontSize: 13,
                          color: Color(0xFF475569),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),

            // 2. Nội dung chính
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.all(16.0),
                child: Column(
                  children: [
                    // Hero Section
                    const SizedBox(height: 16),
                    Container(
                      width: 80,
                      height: 80,
                      decoration: BoxDecoration(
                        gradient: const LinearGradient(
                          colors: [Color(0xFF3B82F6), Color(0xFF4F46E5)],
                          begin: Alignment.topLeft,
                          end: Alignment.bottomRight,
                        ),
                        borderRadius: BorderRadius.circular(20),
                        boxShadow: [
                          BoxShadow(
                            color: Colors.blue.withOpacity(0.3),
                            blurRadius: 10,
                            offset: const Offset(0, 4),
                          ),
                        ],
                      ),
                      child: const Center(
                        child: Text('🛡️', style: TextStyle(fontSize: 36)),
                      ),
                    ),
                    const SizedBox(height: 16),
                    const Text(
                      'Hướng dẫn làm bài thi',
                      style: TextStyle(
                        fontSize: 24,
                        fontWeight: FontWeight.bold,
                        color: Color(0xFF1E293B),
                      ),
                      textAlign: TextAlign.center,
                    ),
                    const SizedBox(height: 8),
                    const Text(
                      'Quy tắc và chống gian lận - Đảm bảo tính công bằng cho mọi thí sinh',
                      style: TextStyle(fontSize: 16, color: Color(0xFF475569)),
                      textAlign: TextAlign.center,
                    ),
                    const SizedBox(height: 32),

                    // Quy tắc chuẩn bị
                    const SectionWidget(
                      icon: "📝",
                      title: "Trước khi bắt đầu thi",
                      children: [
                        RuleWidget(
                          icon: "✅",
                          text:
                              "Chuẩn bị thiết bị: Máy tính/laptop/điện thoại có camera, microphone, kết nối internet ổn định",
                          isDo: true,
                        ),
                        RuleWidget(
                          icon: "✅",
                          text:
                              "Môi trường thi: Phòng riêng, yên tĩnh, ánh sáng đủ để camera nhận diện khuôn mặt",
                          isDo: true,
                        ),
                        RuleWidget(
                          icon: "✅",
                          text:
                              "Chuẩn bị giấy tờ: CMND/CCCD hoặc thẻ sinh viên để xác minh danh tính",
                          isDo: true,
                        ),
                        RuleWidget(
                          icon: "✅",
                          text:
                              "Đăng nhập trước 15 phút: Kiểm tra camera, microphone, xác minh khuôn mặt",
                          isDo: true,
                        ),
                        RuleWidget(
                          icon: "❌",
                          text:
                              "KHÔNG sử dụng điện thoại phụ, tài liệu, sách vở trong phòng thi",
                          isDo: false,
                        ),
                      ],
                    ),
                    const SizedBox(height: 24),

                    // Quy tắc trong khi thi
                    const SectionWidget(
                      icon: "🎯",
                      title: "Trong khi làm bài",
                      children: [
                        RuleWidget(
                          icon: "✅",
                          text:
                              "Giữ khuôn mặt trong khung hình camera suốt buổi thi",
                          isDo: true,
                        ),
                        RuleWidget(
                          icon: "✅",
                          text:
                              "Ngồi yên, nhìn thẳng màn hình, không di chuyển quá nhiều",
                          isDo: true,
                        ),
                        RuleWidget(
                          icon: "✅",
                          text:
                              "Làm bài trong chế độ toàn màn hình, không thoát ra",
                          isDo: true,
                        ),
                        RuleWidget(
                          icon: "❌",
                          text:
                              "KHÔNG mở tab/cửa sổ khác, không chuyển ứng dụng",
                          isDo: false,
                        ),
                        RuleWidget(
                          icon: "❌",
                          text:
                              "KHÔNG nói chuyện, nhìn sang nơi khác, hoặc có người khác trong phòng",
                          isDo: false,
                        ),
                      ],
                    ),
                    const SizedBox(height: 24),

                    // Hệ thống giám sát tự động
                    SectionWidget(
                      icon: "📹",
                      title: "Hệ thống giám sát tự động",
                      children: [
                        Container(
                          padding: const EdgeInsets.all(16),
                          decoration: BoxDecoration(
                            color: const Color(0xFFEFF6FF),
                            border: Border.all(color: const Color(0xFFBFDBFE)),
                            borderRadius: BorderRadius.circular(12),
                          ),
                          child: const Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                'Hệ thống AI sẽ theo dõi:',
                                style: TextStyle(
                                  fontWeight: FontWeight.bold,
                                  color: Color(0xFF1E3A8A),
                                ),
                              ),
                              SizedBox(height: 8),
                              BulletTextWidget(
                                label: 'Khuôn mặt:',
                                text:
                                    ' Nhận diện và xác minh danh tính liên tục',
                              ),
                              BulletTextWidget(
                                label: 'Màn hình:',
                                text: ' Phát hiện nếu bạn thoát màn hình thi',
                              ),
                              BulletTextWidget(
                                label: 'Hành vi:',
                                text:
                                    ' Ghi nhận các cảnh báo (rời cửa sổ, mất focus)',
                              ),
                              BulletTextWidget(
                                label: 'Cảnh báo:',
                                text: ' Sau 5 vi phạm → TỰ ĐỘNG NỘP BÀI',
                                highlightValue: true,
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 24),

                    // Vi phạm & hậu quả
                    SectionWidget(
                      icon: "⚠️",
                      title: "Vi phạm và hậu quả",
                      children: [
                        Container(
                          padding: const EdgeInsets.all(16),
                          decoration: BoxDecoration(
                            color: const Color(0xFFFEF2F2),
                            border: Border.all(color: const Color(0xFFFECACA)),
                            borderRadius: BorderRadius.circular(12),
                          ),
                          child: const Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                'Các hành vi gian lận bị phát hiện:',
                                style: TextStyle(
                                  fontWeight: FontWeight.bold,
                                  color: Color(0xFF7F1D1D),
                                ),
                              ),
                              SizedBox(height: 12),
                              WarningStepWidget(
                                step: 'Cảnh báo 1',
                                desc: 'Thoát màn hình → Hệ thống cảnh báo',
                              ),
                              WarningStepWidget(
                                step: 'Cảnh báo 2',
                                desc: 'Chuyển ứng dụng khác → Ghi nhận vi phạm',
                              ),
                              WarningStepWidget(
                                step: 'Cảnh báo 3',
                                desc: 'Nhấn phím bị chặn/Hành vi lạ → Ghi log',
                              ),
                              WarningStepWidget(
                                step: 'Cảnh báo 4',
                                desc: 'Rời khỏi ứng dụng → Cảnh báo nguy hiểm',
                              ),
                              WarningStepWidget(
                                step: 'Cảnh báo 5',
                                desc: '🚨 HỆ THỐNG TỰ ĐỘNG NỘP BÀI 🚨',
                                isCritical: true,
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(height: 16),
                        Container(
                          padding: const EdgeInsets.all(16),
                          decoration: BoxDecoration(
                            color: const Color(0xFFFEFCE8),
                            border: Border.all(color: const Color(0xFFFEF08A)),
                            borderRadius: BorderRadius.circular(12),
                          ),
                          child: RichText(
                            text: const TextSpan(
                              style: TextStyle(
                                fontSize: 14,
                                color: Color(0xFF713F12),
                                height: 1.5,
                              ),
                              children: [
                                TextSpan(
                                  text: '⚡ Lưu ý: ',
                                  style: TextStyle(fontWeight: FontWeight.bold),
                                ),
                                TextSpan(
                                  text:
                                      'Giảng viên sẽ xem lại log vi phạm. Nếu phát hiện gian lận nghiêm trọng → ',
                                ),
                                TextSpan(
                                  text: 'Điểm 0 và xử lý kỷ luật',
                                  style: TextStyle(
                                    color: Colors.red,
                                    fontWeight: FontWeight.bold,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 24),

                    // Tips thành công
                    SectionWidget(
                      icon: "💡",
                      title: "Tips để thi thành công",
                      children: [
                        TipWidget(
                          emoji: "🎯",
                          title: "Tập trung cao độ",
                          desc:
                              "Đọc kỹ đề, suy nghĩ cẩn thận trước khi chọn đáp án",
                          colors: [Colors.blue.shade50, Colors.indigo.shade50],
                          borderColor: Colors.blue.shade200,
                          titleColor: Colors.blue.shade900,
                          descColor: Colors.blue.shade700,
                        ),
                        const SizedBox(height: 12),
                        TipWidget(
                          emoji: "⏱️",
                          title: "Quản lý thời gian",
                          desc:
                              "Theo dõi đồng hồ đếm ngược, ưu tiên câu dễ trước",
                          colors: [Colors.green.shade50, Colors.green.shade50],
                          borderColor: Colors.green.shade200,
                          titleColor: Colors.green.shade900,
                          descColor: Colors.green.shade700,
                        ),
                        const SizedBox(height: 12),
                        TipWidget(
                          emoji: "💾",
                          title: "Lưu câu trả lời thường xuyên",
                          desc:
                              "Hệ thống tự động lưu, nhưng hãy kiểm tra trước khi nộp",
                          colors: [Colors.purple.shade50, Colors.pink.shade50],
                          borderColor: Colors.purple.shade200,
                          titleColor: Colors.purple.shade900,
                          descColor: Colors.purple.shade700,
                        ),
                        const SizedBox(height: 12),
                        TipWidget(
                          emoji: "✅",
                          title: "Kiểm tra trước khi nộp",
                          desc: "Rà soát lại các câu, đảm bảo không bỏ sót",
                          colors: [Colors.orange.shade50, Colors.amber.shade50],
                          borderColor: Colors.orange.shade200,
                          titleColor: Colors.orange.shade900,
                          descColor: Colors.orange.shade700,
                        ),
                      ],
                    ),
                    const SizedBox(height: 24),

                    // Contact support
                    Container(
                      padding: const EdgeInsets.all(24),
                      decoration: BoxDecoration(
                        gradient: const LinearGradient(
                          colors: [Color(0xFFF1F5F9), Color(0xFFE2E8F0)],
                          begin: Alignment.topLeft,
                          end: Alignment.bottomRight,
                        ),
                        border: Border.all(color: Colors.grey.shade300),
                        borderRadius: BorderRadius.circular(16),
                      ),
                      child: Column(
                        children: [
                          const Text(
                            'Gặp vấn đề kỹ thuật?',
                            style: TextStyle(
                              fontWeight: FontWeight.bold,
                              fontSize: 16,
                              color: Color(0xFF1E293B),
                            ),
                          ),
                          const SizedBox(height: 8),
                          const Text(
                            'Liên hệ giảng viên hoặc bộ phận hỗ trợ kỹ thuật TRƯỚC KHI bắt đầu thi',
                            textAlign: TextAlign.center,
                            style: TextStyle(
                              fontSize: 14,
                              color: Color(0xFF475569),
                            ),
                          ),
                          const SizedBox(height: 16),
                          ElevatedButton.icon(
                            onPressed: () async {
                              final Uri emailLaunchUri = Uri(
                                scheme: 'mailto',
                                path: 'support@oem.edu.vn',
                              );
                              if (await canLaunchUrl(emailLaunchUri)) {
                                await launchUrl(emailLaunchUri);
                              }
                            },
                            icon: const Icon(Icons.email, size: 18),
                            label: const Text('Email: support@oem.edu.vn'),
                            style: ElevatedButton.styleFrom(
                              backgroundColor: const Color(0xFF2563EB),
                              foregroundColor: Colors.white,
                              elevation: 0,
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(8),
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 32),

                    // CTA Button
                    SizedBox(
                      width: double.infinity,
                      child: ElevatedButton(
                        onPressed: () => context.push('/verify-room'),
                        style: ElevatedButton.styleFrom(
                          padding: const EdgeInsets.symmetric(vertical: 16),
                          backgroundColor: const Color(0xFF2563EB),
                          foregroundColor: Colors.white,
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(12),
                          ),
                          elevation: 4,
                        ),
                        child: const Text(
                          'Tôi đã hiểu rõ quy định → Xác minh phòng',
                          style: TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(height: 12),
                    const Text(
                      'Bằng cách tiếp tục, bạn xác nhận đã đọc và đồng ý tuân thủ các quy định trên',
                      textAlign: TextAlign.center,
                      style: TextStyle(fontSize: 12, color: Color(0xFF64748B)),
                    ),

                    // Footer
                    const SizedBox(height: 48),
                    const Divider(),
                    const SizedBox(height: 16),
                    Text(
                      '© ${DateTime.now().year} OEM - Online Examination Management System',
                      style: const TextStyle(
                        fontSize: 12,
                        color: Color(0xFF64748B),
                      ),
                    ),
                    const SizedBox(height: 4),
                    const Text(
                      'Mọi hành vi gian lận sẽ bị xử lý nghiêm khắc',
                      style: TextStyle(fontSize: 12, color: Color(0xFF64748B)),
                    ),
                    const SizedBox(height: 32),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
