import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import 'package:url_launcher/url_launcher.dart';

import '../widgets/support/support_widgets.dart';

class SupportPage extends StatelessWidget {
  const SupportPage({super.key});

  Future<void> _launchUrl(String urlString) async {
    final Uri url = Uri.parse(urlString);
    if (await canLaunchUrl(url)) {
      await launchUrl(url, mode: LaunchMode.externalApplication);
    }
  }

  void _handleEmailClick() {
    final subject = Uri.encodeComponent('Yêu cầu hỗ trợ - OEM System');
    final body = Uri.encodeComponent(
      'Xin chào bộ phận hỗ trợ,\n\nTôi cần hỗ trợ về:\n\n[Mô tả vấn đề của bạn tại đây]\n\nTrân trọng.',
    );
    _launchUrl('mailto:truongkt693@gmail.com?subject=$subject&body=$body');
  }

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
                        child: Text('💬', style: TextStyle(fontSize: 36)),
                      ),
                    ),
                    const SizedBox(height: 16),
                    const Text(
                      'Trung tâm hỗ trợ',
                      style: TextStyle(
                        fontSize: 28,
                        fontWeight: FontWeight.bold,
                        color: Color(0xFF1E293B),
                      ),
                      textAlign: TextAlign.center,
                    ),
                    const SizedBox(height: 8),
                    const Text(
                      'Chúng tôi luôn sẵn sàng hỗ trợ bạn 24/7',
                      style: TextStyle(fontSize: 16, color: Color(0xFF475569)),
                      textAlign: TextAlign.center,
                    ),
                    const SizedBox(height: 32),

                    // Contact Card
                    Container(
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(color: Colors.grey.shade200),
                        boxShadow: [
                          BoxShadow(
                            color: Colors.black.withOpacity(0.05),
                            blurRadius: 10,
                            offset: const Offset(0, 4),
                          ),
                        ],
                      ),
                      clipBehavior: Clip.antiAlias,
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          Container(
                            padding: const EdgeInsets.all(20),
                            decoration: const BoxDecoration(
                              gradient: LinearGradient(
                                colors: [Color(0xFF2563EB), Color(0xFF4F46E5)],
                              ),
                            ),
                            child: const Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  '📞 Thông tin liên hệ',
                                  style: TextStyle(
                                    fontSize: 20,
                                    fontWeight: FontWeight.bold,
                                    color: Colors.white,
                                  ),
                                ),
                                SizedBox(height: 4),
                                Text(
                                  'Liên hệ với chúng tôi qua các kênh sau',
                                  style: TextStyle(color: Colors.white70),
                                ),
                              ],
                            ),
                          ),
                          Padding(
                            padding: const EdgeInsets.all(20.0),
                            child: Column(
                              children: [
                                ContactItemWidget(
                                  icon: Icons.phone_in_talk_rounded,
                                  title: 'Hotline hỗ trợ',
                                  content: '0971 893 750',
                                  subContent: 'Thời gian: 24/7 (cả ngày lễ)',
                                  themeColor: const Color(0xFF2563EB), // blue
                                  onTap: () => _launchUrl('tel:0971893750'),
                                ),
                                ContactItemWidget(
                                  icon: Icons.mail_rounded,
                                  title: 'Email hỗ trợ',
                                  content: 'truongkt693@gmail.com',
                                  subContent:
                                      '💡 Bạn sẽ được chuyển sang Gmail để soạn email',
                                  themeColor: const Color(0xFF4F46E5), // indigo
                                  onTap: _handleEmailClick,
                                ),
                                ContactItemWidget(
                                  icon: Icons.location_on_rounded,
                                  title: 'Địa chỉ văn phòng',
                                  content: '120 Hoàng Minh Thảo',
                                  subContent:
                                      'Hòa Khánh, Liên Chiểu, Đà Nẵng\n🗺️ Nhấn để xem bản đồ',
                                  themeColor: const Color(0xFF9333EA), // purple
                                  onTap: () => _launchUrl(
                                    'https://www.google.com/maps/search/?api=1&query=120+Hoàng+Minh+Thảo,+Hòa+Khánh,+Liên+Chiểu,+Đà+Nẵng',
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 24),

                    // FAQ Section
                    Container(
                      padding: const EdgeInsets.all(20),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(color: Colors.grey.shade200),
                        boxShadow: [
                          BoxShadow(
                            color: Colors.black.withOpacity(0.05),
                            blurRadius: 10,
                            offset: const Offset(0, 4),
                          ),
                        ],
                      ),
                      child: const Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            '❓ Câu hỏi thường gặp',
                            style: TextStyle(
                              fontSize: 20,
                              fontWeight: FontWeight.bold,
                              color: Color(0xFF1E293B),
                            ),
                          ),
                          SizedBox(height: 16),
                          FaqItemWidget(
                            question: '🔐 Tôi quên mật khẩu, làm thế nào?',
                            answer:
                                'Tại trang đăng nhập, nhấn "Quên mật khẩu" và làm theo hướng dẫn. Email khôi phục sẽ được gửi trong vòng 5 phút.',
                          ),
                          FaqItemWidget(
                            question:
                                '⏱️ Tôi không vào được phòng thi, phải làm sao?',
                            answer:
                                'Kiểm tra lại mã phòng thi và thời gian thi. Nếu vẫn gặp lỗi, liên hệ hotline ngay để được hỗ trợ khẩn cấp.',
                          ),
                          FaqItemWidget(
                            question: '📹 Camera/Microphone không hoạt động?',
                            answer:
                                'Kiểm tra cài đặt ứng dụng để cho phép truy cập camera/micro. Đảm bảo không có ứng dụng nào khác đang sử dụng thiết bị.',
                          ),
                          FaqItemWidget(
                            question: '🎯 Tôi muốn phản hồi về bài thi?',
                            answer:
                                'Vui lòng gửi email đến địa chỉ hỗ trợ với tiêu đề "Phản hồi bài thi - [Tên bài thi]". Chúng tôi sẽ xem xét và phản hồi trong 24-48 giờ.',
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 24),

                    // Quick Actions
                    Container(
                      padding: const EdgeInsets.all(24),
                      decoration: BoxDecoration(
                        gradient: const LinearGradient(
                          colors: [Color(0xFF2563EB), Color(0xFF4F46E5)],
                        ),
                        borderRadius: BorderRadius.circular(16),
                        boxShadow: [
                          BoxShadow(
                            color: Colors.blue.withOpacity(0.3),
                            blurRadius: 10,
                            offset: const Offset(0, 4),
                          ),
                        ],
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text(
                            '🚀 Hành động nhanh',
                            style: TextStyle(
                              fontSize: 20,
                              fontWeight: FontWeight.bold,
                              color: Colors.white,
                            ),
                          ),
                          const SizedBox(height: 16),
                          Row(
                            children: [
                              Expanded(
                                child: ElevatedButton.icon(
                                  onPressed: _handleEmailClick,
                                  icon: const Icon(
                                    Icons.email,
                                    color: Color(0xFF2563EB),
                                  ),
                                  label: const Text(
                                    'Gửi email',
                                    style: TextStyle(
                                      color: Color(0xFF2563EB),
                                      fontWeight: FontWeight.bold,
                                    ),
                                  ),
                                  style: ElevatedButton.styleFrom(
                                    backgroundColor: Colors.white,
                                    padding: const EdgeInsets.symmetric(
                                      vertical: 12,
                                    ),
                                    shape: RoundedRectangleBorder(
                                      borderRadius: BorderRadius.circular(12),
                                    ),
                                  ),
                                ),
                              ),
                              const SizedBox(width: 12),
                              Expanded(
                                child: ElevatedButton.icon(
                                  onPressed: () => _launchUrl('tel:0971893750'),
                                  icon: const Icon(
                                    Icons.phone,
                                    color: Color(0xFF4F46E5),
                                  ),
                                  label: const Text(
                                    'Gọi hotline',
                                    style: TextStyle(
                                      color: Color(0xFF4F46E5),
                                      fontWeight: FontWeight.bold,
                                    ),
                                  ),
                                  style: ElevatedButton.styleFrom(
                                    backgroundColor: Colors.white,
                                    padding: const EdgeInsets.symmetric(
                                      vertical: 12,
                                    ),
                                    shape: RoundedRectangleBorder(
                                      borderRadius: BorderRadius.circular(12),
                                    ),
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 24),

                    // Footer Note
                    Container(
                      padding: const EdgeInsets.all(16),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: Colors.grey.shade300),
                      ),
                      child: RichText(
                        textAlign: TextAlign.center,
                        text: const TextSpan(
                          style: TextStyle(
                            fontSize: 14,
                            color: Color(0xFF475569),
                            height: 1.5,
                          ),
                          children: [
                            TextSpan(text: '💡 '),
                            TextSpan(
                              text: 'Lưu ý: ',
                              style: TextStyle(fontWeight: FontWeight.bold),
                            ),
                            TextSpan(
                              text: 'Đội ngũ hỗ trợ sẽ phản hồi trong vòng ',
                            ),
                            TextSpan(
                              text: '30 phút ',
                              style: TextStyle(
                                fontWeight: FontWeight.bold,
                                color: Colors.blue,
                              ),
                            ),
                            TextSpan(text: '(giờ hành chính) hoặc '),
                            TextSpan(
                              text: '2 giờ ',
                              style: TextStyle(
                                fontWeight: FontWeight.bold,
                                color: Colors.blue,
                              ),
                            ),
                            TextSpan(text: '(ngoài giờ).'),
                          ],
                        ),
                      ),
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
