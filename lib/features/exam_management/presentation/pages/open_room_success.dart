import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';

class OpenRoomSuccessPage extends StatefulWidget {
  final int examId;
  final String roomCode;

  const OpenRoomSuccessPage({
    super.key,
    required this.examId,
    required this.roomCode,
  });

  @override
  State<OpenRoomSuccessPage> createState() => _OpenRoomSuccessPageState();
}

class _OpenRoomSuccessPageState extends State<OpenRoomSuccessPage> {
  bool _copied = false;

  // Hàm xử lý Copy to Clipboard
  Future<void> _copy() async {
    if (widget.roomCode.isEmpty) return;

    await Clipboard.setData(ClipboardData(text: widget.roomCode));

    setState(() {
      _copied = true;
    });

    // Sau 2 giây tự động quay về trạng thái chưa copy
    Future.delayed(const Duration(seconds: 2), () {
      if (mounted) {
        setState(() {
          _copied = false;
        });
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC), // slate-50
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 48),
          child: Column(
            children: [
              _buildHeader(),
              const SizedBox(height: 40),
              _buildMainCodeBox(),
              const SizedBox(height: 48),
              _buildFooterNavigation(context),
            ],
          ),
        ),
      ),
    );
  }

  // 1. Phần Header (Tiêu đề và Icon)
  Widget _buildHeader() {
    return Column(
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              width: 40,
              height: 40,
              decoration: BoxDecoration(
                color: Colors.green.shade100,
                shape: BoxShape.circle,
              ),
              child: Icon(Icons.check, color: Colors.green.shade600, size: 24),
            ),
            const SizedBox(width: 12),
            const Text(
              "Mở phòng thi thành công",
              style: TextStyle(
                fontSize: 22,
                fontWeight: FontWeight.w800,
                color: Color(0xFF1E293B), // slate-800
                letterSpacing: -0.5,
              ),
            ),
          ],
        ),
        const SizedBox(height: 12),
        const Text(
          "Phòng thi đã sẵn sàng. Hãy gửi mã tham gia bên dưới cho sinh viên của bạn.",
          textAlign: TextAlign.center,
          style: TextStyle(fontSize: 14, color: Color(0xFF64748B)), // slate-500
        ),
      ],
    );
  }

  // 2. Phần Hộp chứa Mã phòng (Viền đậm, góc vuông)
  Widget _buildMainCodeBox() {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 40),
      decoration: BoxDecoration(
        color: Colors.white,
        border: Border.all(
          color: const Color(0xFF1E293B),
          width: 2,
        ), // slate-800
        // Không dùng borderRadius để tạo cảm giác góc cạnh như Tailwind rounded-none
      ),
      child: Column(
        children: [
          // Badge "EXAM_ACCESS_CODE"
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
            decoration: BoxDecoration(
              color: const Color(0xFFF8FAFC),
              border: Border.all(color: const Color(0xFFF1F5F9)),
            ),
            child: const Text(
              "EXAM_ACCESS_CODE",
              style: TextStyle(
                fontSize: 10,
                fontWeight: FontWeight.bold,
                letterSpacing: 3.0, // tracking-[0.3em]
                color: Color(0xFF94A3B8), // slate-400
              ),
            ),
          ),
          const SizedBox(height: 24),

          // Hiển thị Mã phòng chữ to, font Monospace
          Text(
            widget.roomCode.isNotEmpty ? widget.roomCode : '———',
            style: const TextStyle(
              fontFamily: 'monospace',
              fontSize: 56,
              fontWeight: FontWeight.w900,
              letterSpacing: 8.0, // tracking-[0.2em]
              color: Color(0xFF0F172A), // slate-900
            ),
          ),
          const SizedBox(height: 40),

          // Nút Copy
          SizedBox(
            width: double.infinity,
            height: 56,
            child: ElevatedButton.icon(
              onPressed: _copy,
              style: ElevatedButton.styleFrom(
                backgroundColor: _copied
                    ? Colors.green.shade600
                    : const Color(0xFF0F172A),
                foregroundColor: Colors.white,
                shape: const RoundedRectangleBorder(
                  borderRadius: BorderRadius.zero,
                ),
                elevation: _copied ? 6 : 4,
              ),
              icon: Icon(_copied ? Icons.check : Icons.copy, size: 20),
              label: Text(
                _copied ? "Đã sao chép mã" : "Sao chép mã phòng",
                style: const TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  // 3. Phần Footer Điều hướng
  Widget _buildFooterNavigation(BuildContext context) {
    return Column(
      children: [
        // Nút Quay lại danh sách
        SizedBox(
          width: double.infinity,
          height: 56,
          child: OutlinedButton.icon(
            onPressed: () => context.go('/open-exam'),
            icon: const Icon(Icons.arrow_back, size: 18),
            label: const Text("Quay lại danh sách"),
            style: OutlinedButton.styleFrom(
              foregroundColor: const Color(0xFF475569), // slate-600
              shape: const RoundedRectangleBorder(
                borderRadius: BorderRadius.zero,
              ),
              side: const BorderSide(color: Color(0xFFE2E8F0)), // slate-200
              textStyle: const TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.bold,
              ),
            ),
          ),
        ),
        const SizedBox(height: 16),
        // Nút Xem lại đề
        SizedBox(
          width: double.infinity,
          height: 56,
          child: OutlinedButton.icon(
            // Dùng context.go để clear stack, tránh người dùng bấm back về lại màn hình success này
            onPressed: () => context.go(
              '/instructor-dashboard/exams/${widget.examId}/preview',
            ),
            icon: const Icon(Icons.remove_red_eye_outlined, size: 18),
            label: const Text("Xem lại đề"),
            style: OutlinedButton.styleFrom(
              foregroundColor: const Color(0xFF475569),
              shape: const RoundedRectangleBorder(
                borderRadius: BorderRadius.zero,
              ),
              side: const BorderSide(color: Color(0xFFE2E8F0)),
              textStyle: const TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.bold,
              ),
            ),
          ),
        ),
      ],
    );
  }
}
