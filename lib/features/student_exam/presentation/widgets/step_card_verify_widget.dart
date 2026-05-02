import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../bloc/verify_exam_bloc.dart';
import '../bloc/verify_exam_event.dart';
import '../bloc/verify_exam_state.dart';

class StepCardVerifyWidget extends StatefulWidget {
  final VerifyExamState state;
  final String submissionId;

  const StepCardVerifyWidget({
    super.key,
    required this.state,
    required this.submissionId,
  });

  @override
  State<StepCardVerifyWidget> createState() => _StepCardVerifyWidgetState();
}

class _StepCardVerifyWidgetState extends State<StepCardVerifyWidget> {
  final TextEditingController _mssvController = TextEditingController();

  @override
  void dispose() {
    _mssvController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final state = widget.state;

    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: const Color(0xFFE2E8F0)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.03),
            blurRadius: 16,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header của Bước 1
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Row(
                children: [
                  Container(
                    width: 28,
                    height: 28,
                    decoration: BoxDecoration(
                      gradient: const LinearGradient(
                        colors: [Color(0xFF2563EB), Color(0xFF1D4ED8)],
                        begin: Alignment.topLeft,
                        end: Alignment.bottomRight,
                      ),
                      borderRadius: BorderRadius.circular(14),
                    ),
                    child: const Center(
                      child: Text(
                        '1',
                        style: TextStyle(
                          color: Colors.white,
                          fontSize: 12,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(width: 10),
                  const Text(
                    'Xác minh thẻ sinh viên',
                    style: TextStyle(
                      fontWeight: FontWeight.w800,
                      fontSize: 16,
                      color: Color(0xFF1E293B),
                    ),
                  ),
                ],
              ),
              _buildStatusText(state),
            ],
          ),
          const SizedBox(height: 16),

          // Hiển thị Form nhập nếu chưa verify xong và chưa được Bypass
          if (!state.cardUploaded && !state.isBypassed) ...[
            TextField(
              controller: _mssvController,
              enabled: !state.isSearchingCard,
              style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w500),
              decoration: InputDecoration(
                hintText: 'Nhập MSSV (5-15 ký tự)',
                hintStyle: TextStyle(color: Colors.grey.shade400),
                filled: true,
                fillColor: const Color(0xFFF8FAFC),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                  borderSide: const BorderSide(color: Color(0xFFE2E8F0)),
                ),
                enabledBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                  borderSide: const BorderSide(color: Color(0xFFE2E8F0)),
                ),
                focusedBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                  borderSide: const BorderSide(
                    color: Color(0xFF2563EB),
                    width: 1.5,
                  ),
                ),
                contentPadding: const EdgeInsets.symmetric(
                  horizontal: 16,
                  vertical: 14,
                ),
              ),
            ),
            const SizedBox(height: 12),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton.icon(
                onPressed: state.isSearchingCard
                    ? null
                    : () {
                        final code = _mssvController.text.trim();
                        if (code.isNotEmpty) {
                          context.read<VerifyExamBloc>().add(
                            VerifyStudentCodeEvent(widget.submissionId, code),
                          );
                        }
                      },
                icon: state.isSearchingCard
                    ? const SizedBox(
                        width: 16,
                        height: 16,
                        child: CircularProgressIndicator(
                          color: Colors.white,
                          strokeWidth: 2,
                        ),
                      )
                    : const Icon(Icons.search, size: 18),
                label: Text(
                  state.isSearchingCard ? 'Đang tìm...' : 'Tìm Thẻ Sinh Viên',
                  style: const TextStyle(
                    fontWeight: FontWeight.w700,
                    fontSize: 14,
                  ),
                ),
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF2563EB),
                  foregroundColor: Colors.white,
                  elevation: 0,
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                ),
              ),
            ),
          ],

          // Nếu được bypass (Bỏ qua)
          if (state.isBypassed)
            Container(
              margin: const EdgeInsets.only(top: 12),
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: const Color(0xFFF0FDF4),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: const Color(0xFFDCFCE7)),
              ),
              child: Row(
                children: [
                  const Icon(
                    Icons.check_circle,
                    color: Color(0xFF16A34A),
                    size: 20,
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      'Giảng viên đã phê duyệt quyền vào thi cho bạn.',
                      style: TextStyle(
                        color: const Color(0xFF15803D),
                        fontSize: 13,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
                ],
              ),
            ),

          // Hiển thị ảnh thẻ nếu có (Decode từ Base64)
          if (state.cardPreviewUrl != null && state.cardPreviewUrl!.isNotEmpty)
            Container(
              margin: const EdgeInsets.only(top: 16),
              alignment: Alignment.center,
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: const Color(0xFFE2E8F0)),
              ),
              child: ClipRRect(
                borderRadius: BorderRadius.circular(11),
                child: Image.memory(
                  base64Decode(state.cardPreviewUrl!.split(',').last),
                  height: 160,
                  fit: BoxFit.cover,
                  errorBuilder: (context, error, stackTrace) => const Padding(
                    padding: EdgeInsets.all(16.0),
                    child: Text(
                      'Lỗi hiển thị ảnh thẻ',
                      style: TextStyle(color: Colors.red),
                    ),
                  ),
                ),
              ),
            ),

          // Log kết quả verify
          if (state.cardVerifyLog.isNotEmpty)
            Container(
              width: double.infinity,
              margin: const EdgeInsets.only(top: 12),
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: state.cardOk
                    ? const Color(0xFFF0FDF4)
                    : const Color(0xFFFEF2F2),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(
                  color: state.cardOk
                      ? const Color(0xFFDCFCE7)
                      : const Color(0xFFFEE2E2),
                ),
              ),
              child: Text(
                state.cardVerifyLog,
                style: TextStyle(
                  fontSize: 13,
                  fontFamily: 'monospace',
                  fontWeight: FontWeight.w500,
                  color: state.cardOk
                      ? const Color(0xFF15803D)
                      : const Color(0xFFB91C1C),
                ),
              ),
            ),

          // Nút Reset (Nhập lại)
          if ((state.cardUploaded || state.cardErr != null) &&
              !state.isBypassed)
            Container(
              width: double.infinity,
              margin: const EdgeInsets.only(top: 12),
              child: OutlinedButton.icon(
                onPressed: () {
                  _mssvController.clear();
                  context.read<VerifyExamBloc>().add(
                    ResetCardVerificationEvent(),
                  );
                },
                icon: const Icon(Icons.refresh, size: 16),
                label: const Text(
                  'Đổi MSSV hoặc Nhập lại',
                  style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13),
                ),
                style: OutlinedButton.styleFrom(
                  foregroundColor: const Color(0xFFD97706),
                  side: const BorderSide(color: Color(0xFFFCD34D)),
                  padding: const EdgeInsets.symmetric(vertical: 12),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }

  Widget _buildStatusText(VerifyExamState state) {
    if (state.isBypassed) {
      return Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
        decoration: BoxDecoration(
          color: const Color(0xFFDCFCE7),
          borderRadius: BorderRadius.circular(8),
        ),
        child: const Text(
          '✅ Được bỏ qua',
          style: TextStyle(
            color: Color(0xFF15803D),
            fontSize: 11,
            fontWeight: FontWeight.bold,
          ),
        ),
      );
    }
    if (state.cardOk) {
      return Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
        decoration: BoxDecoration(
          color: const Color(0xFFDCFCE7),
          borderRadius: BorderRadius.circular(8),
        ),
        child: const Text(
          '✅ Đã xác minh',
          style: TextStyle(
            color: Color(0xFF15803D),
            fontSize: 11,
            fontWeight: FontWeight.bold,
          ),
        ),
      );
    }
    if (state.cardErr != null) {
      return Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
        decoration: BoxDecoration(
          color: const Color(0xFFFEE2E2),
          borderRadius: BorderRadius.circular(8),
        ),
        child: const Text(
          '❌ Lỗi',
          style: TextStyle(
            color: Color(0xFFB91C1C),
            fontSize: 11,
            fontWeight: FontWeight.bold,
          ),
        ),
      );
    }
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: const Color(0xFFF1F5F9),
        borderRadius: BorderRadius.circular(8),
      ),
      child: const Text(
        '⏳ Chưa xác minh',
        style: TextStyle(
          color: Color(0xFF64748B),
          fontSize: 11,
          fontWeight: FontWeight.bold,
        ),
      ),
    );
  }
}
