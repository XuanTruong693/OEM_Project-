import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../../core/storage/secure_storage_helper.dart';
import '../bloc/auth_bloc.dart';
import '../bloc/auth_event.dart';
import '../bloc/auth_state.dart';

class VerifyRoomPage extends StatefulWidget {
  const VerifyRoomPage({super.key});

  @override
  State<VerifyRoomPage> createState() => _VerifyRoomPageState();
}

class _VerifyRoomPageState extends State<VerifyRoomPage> {
  final TextEditingController _roomController = TextEditingController();

  @override
  void dispose() {
    _roomController.dispose();
    super.dispose();
  }

  void _handleVerify() {
    final code = _roomController.text.trim();
    if (code.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Vui lòng nhập mã phòng'),
          backgroundColor: Colors.red,
        ),
      );
      return;
    }
    // Gửi Event xuống BLoC
    context.read<AuthBloc>().add(VerifyRoomSubmitEvent(roomCode: code));
  }

  Future<void> _launchSupportEmail() async {
    final Uri emailLaunchUri = Uri(
      scheme: 'mailto',
      path: 'truongkt693@gmail.com',
      query:
          'subject=Yêu cầu hỗ trợ - Xác minh phòng thi&body=Xin chào bộ phận hỗ trợ,\n\nTôi cần hỗ trợ về vấn đề xác minh phòng thi:\n\n[Mô tả vấn đề của bạn tại đây]\n\nTrân trọng.',
    );
    if (!await launchUrl(emailLaunchUri)) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Không thể mở ứng dụng gửi mail')),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: BlocListener<AuthBloc, AuthState>(
        listener: (context, state) async {
          // 👉 KHI XÁC MINH THÀNH CÔNG: LƯU KÉT SẮT VÀ CHUYỂN TRANG
          if (state is AuthVerifyRoomSuccess) {
            final entity = state.entity;

            if (entity.roomToken != null) {
              await SecureStorageHelper.saveRoomToken(entity.roomToken!);
            }
            if (entity.examId != null) {
              await SecureStorageHelper.savePendingExamId(entity.examId!.toString());
            }

            await SecureStorageHelper.saveExamFlags(
              requireFaceCheck: entity.requireFaceCheck,
              requireStudentCard: entity.requireStudentCard,
              monitorScreen: entity.monitorScreen,
            );

            await SecureStorageHelper.saveExamTime(
              timeOpen: entity.timeOpen,
              timeClose: entity.timeClose,
            );

            // Lưu lại chính mã phòng người dùng vừa nhập
            await SecureStorageHelper.saveRoomId(state.originalRoomCode);

            if (mounted) {
              // Delay nhẹ 800ms tạo cảm giác mượt mà giống bản React
              Future.delayed(const Duration(milliseconds: 800), () {
                if (mounted) context.go('/login');
              });
            }
          }
        },
        child: Stack(
          children: [
            // 1. Background Gradient & Blobs loang màu
            Container(
              decoration: const BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                  colors: [
                    Color(0xFFF8FAFC),
                    Color(0xFFEFF6FF),
                    Color(0xFFEEF2FF),
                  ], // slate-50 -> blue-50 -> indigo-50
                ),
              ),
            ),
            Positioned(
              top: -50,
              right: -50,
              child: _buildBlob(Colors.blue.withOpacity(0.3)),
            ),
            Positioned(
              bottom: -50,
              left: -50,
              child: _buildBlob(Colors.indigo.withOpacity(0.3)),
            ),

            // 2. Nội dung chính
            SafeArea(
              child: Column(
                children: [
                  _buildHeader(),
                  Expanded(
                    child: Center(
                      child: SingleChildScrollView(
                        padding: const EdgeInsets.all(20),
                        child: _buildGlassCard(),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildBlob(Color color) {
    return Container(
      width: 250,
      height: 250,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        boxShadow: [BoxShadow(color: color, blurRadius: 100, spreadRadius: 50)],
      ),
    );
  }

  Widget _buildHeader() {
    return ClipRRect(
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: 10, sigmaY: 10),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
          decoration: BoxDecoration(
            color: Colors.white.withOpacity(0.6),
            border: Border(
              bottom: BorderSide(color: Colors.white.withOpacity(0.6)),
            ),
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Image.asset(
                'assets/images/app_logo.png',
                height: 35,
              ), // Thay đường dẫn logo của bạn
              OutlinedButton.icon(
                onPressed: () => context.go('/role'), // Quay lại trang Role
                icon: const Icon(Icons.arrow_back, size: 16),
                label: const Text('Quay lại'),
                style: OutlinedButton.styleFrom(
                  foregroundColor: Colors.blue[700],
                  backgroundColor: Colors.white.withOpacity(0.5),
                  side: BorderSide(color: Colors.blue[200]!),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(8),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildGlassCard() {
    return ClipRRect(
      borderRadius: BorderRadius.circular(24),
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: 20, sigmaY: 20),
        child: Container(
          width: double.infinity,
          decoration: BoxDecoration(
            color: Colors.white.withOpacity(0.95),
            borderRadius: BorderRadius.circular(24),
            border: Border.all(color: Colors.white.withOpacity(0.6)),
            boxShadow: [
              BoxShadow(
                color: Colors.blue.withOpacity(0.1),
                blurRadius: 40,
                spreadRadius: -10,
              ),
            ],
          ),
          child: Column(
            children: [
              // Card Header Gradient
              Container(
                padding: const EdgeInsets.all(24),
                decoration: const BoxDecoration(
                  gradient: LinearGradient(
                    colors: [
                      Color(0xFF2563EB),
                      Color(0xFF4F46E5),
                      Color(0xFF9333EA),
                    ], // blue-600 -> indigo-600 -> purple-600
                  ),
                ),
                child: Column(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(8),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(
                          color: Colors.white.withOpacity(0.4),
                          width: 2,
                        ),
                      ),
                      child: Image.asset(
                        'assets/images/app_logo.png',
                        height: 40,
                        width: 40,
                      ),
                    ),
                    const SizedBox(height: 16),
                    const Text(
                      "Xác Minh Phòng Thi",
                      style: TextStyle(
                        fontSize: 22,
                        fontWeight: FontWeight.bold,
                        color: Colors.white,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      "Nhập mã phòng để bắt đầu bài kiểm tra",
                      style: TextStyle(
                        fontSize: 13,
                        color: Colors.blue[50],
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                  ],
                ),
              ),

              // Card Body
              Padding(
                padding: const EdgeInsets.all(24),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Info Box
                    Container(
                      padding: const EdgeInsets.all(16),
                      decoration: BoxDecoration(
                        color: Colors.blue[50],
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(
                          color: Colors.blue[200]!.withOpacity(0.6),
                        ),
                      ),
                      child: Row(
                        children: [
                          Container(
                            padding: const EdgeInsets.all(8),
                            decoration: BoxDecoration(
                              color: Colors.blue[100],
                              borderRadius: BorderRadius.circular(12),
                            ),
                            child: Icon(
                              Icons.info_outline,
                              color: Colors.blue[600],
                              size: 20,
                            ),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  "Hướng dẫn sử dụng",
                                  style: TextStyle(
                                    fontSize: 12,
                                    fontWeight: FontWeight.bold,
                                    color: Colors.blue[900],
                                  ),
                                ),
                                const SizedBox(height: 2),
                                Text(
                                  "Mã phòng thi do giảng viên cung cấp. Vui lòng nhập chính xác.",
                                  style: TextStyle(
                                    fontSize: 12,
                                    color: Colors.blue[700],
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 20),

                    // Input Field
                    const Text(
                      "Mã phòng thi",
                      style: TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.bold,
                        color: Color(0xFF1E293B),
                      ),
                    ),
                    const SizedBox(height: 8),
                    TextFormField(
                      controller: _roomController,
                      textCapitalization: TextCapitalization.characters,
                      inputFormatters: [
                        FilteringTextInputFormatter.allow(
                          RegExp(r'[a-zA-Z0-9]'),
                        ), // Chỉ cho phép chữ và số
                        LengthLimitingTextInputFormatter(12),
                      ],
                      decoration: InputDecoration(
                        hintText: "VD: ABC12345",
                        prefixIcon: const Icon(
                          Icons.vpn_key_outlined,
                          color: Colors.grey,
                        ),
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(16),
                          borderSide: BorderSide(
                            color: Colors.blue[200]!,
                            width: 2,
                          ),
                        ),
                        enabledBorder: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(16),
                          borderSide: BorderSide(
                            color: Colors.blue[200]!,
                            width: 2,
                          ),
                        ),
                        focusedBorder: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(16),
                          borderSide: const BorderSide(
                            color: Colors.blue,
                            width: 2,
                          ),
                        ),
                        filled: true,
                        fillColor: Colors.white,
                      ),
                      style: const TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.bold,
                        letterSpacing: 2,
                      ),
                    ),
                    const SizedBox(height: 20),

                    // Lắng nghe State để hiện Lỗi / Thành công
                    BlocBuilder<AuthBloc, AuthState>(
                      builder: (context, state) {
                        if (state is AuthVerifyRoomFailure) {
                          return _buildMessageBox(
                            state.errorMessage,
                            isError: true,
                          );
                        } else if (state is AuthVerifyRoomSuccess) {
                          return _buildMessageBox(
                            "✅ Mã phòng thi hợp lệ! Đang chuyển hướng...",
                            isError: false,
                          );
                        }
                        return const SizedBox.shrink();
                      },
                    ),

                    // Submit Button
                    BlocBuilder<AuthBloc, AuthState>(
                      builder: (context, state) {
                        final isLoading = state is AuthLoading;
                        return Container(
                          width: double.infinity,
                          height: 50,
                          decoration: BoxDecoration(
                            borderRadius: BorderRadius.circular(16),
                            gradient: const LinearGradient(
                              colors: [
                                Color(0xFF3B82F6),
                                Color(0xFF4F46E5),
                                Color(0xFF9333EA),
                              ],
                            ),
                            boxShadow: [
                              BoxShadow(
                                color: Colors.blue.withOpacity(0.3),
                                blurRadius: 12,
                                offset: const Offset(0, 4),
                              ),
                            ],
                          ),
                          child: ElevatedButton(
                            onPressed: isLoading ? null : _handleVerify,
                            style: ElevatedButton.styleFrom(
                              backgroundColor: Colors.transparent,
                              shadowColor: Colors.transparent,
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(16),
                              ),
                            ),
                            child: isLoading
                                ? const SizedBox(
                                    width: 20,
                                    height: 20,
                                    child: CircularProgressIndicator(
                                      color: Colors.white,
                                      strokeWidth: 2,
                                    ),
                                  )
                                : const Row(
                                    mainAxisAlignment: MainAxisAlignment.center,
                                    children: [
                                      Icon(
                                        Icons.check_circle_outline,
                                        color: Colors.white,
                                        size: 20,
                                      ),
                                      SizedBox(width: 8),
                                      Text(
                                        "Xác nhận và bắt đầu",
                                        style: TextStyle(
                                          color: Colors.white,
                                          fontSize: 16,
                                          fontWeight: FontWeight.bold,
                                        ),
                                      ),
                                    ],
                                  ),
                          ),
                        );
                      },
                    ),

                    // Help Section
                    const SizedBox(height: 24),
                    const Divider(),
                    const SizedBox(height: 12),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        const Icon(
                          Icons.help_outline,
                          size: 16,
                          color: Colors.grey,
                        ),
                        const SizedBox(width: 4),
                        const Text(
                          "Cần hỗ trợ?",
                          style: TextStyle(fontSize: 12, color: Colors.grey),
                        ),
                        TextButton(
                          onPressed: _launchSupportEmail,
                          style: TextButton.styleFrom(
                            padding: const EdgeInsets.symmetric(horizontal: 8),
                            minimumSize: Size.zero,
                          ),
                          child: const Text(
                            "Liên hệ ngay",
                            style: TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildMessageBox(String message, {required bool isError}) {
    final bgColor = isError ? Colors.red[50] : Colors.green[50];
    final borderColor = isError ? Colors.red[200] : Colors.green[200];
    final iconColor = isError ? Colors.red[600] : Colors.green[600];
    final icon = isError ? Icons.error_outline : Icons.check_circle_outline;

    return Container(
      margin: const EdgeInsets.only(bottom: 20),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: bgColor,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: borderColor!),
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: isError ? Colors.red[100] : Colors.green[100],
              borderRadius: BorderRadius.circular(12),
            ),
            child: Icon(icon, color: iconColor, size: 16),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Text(
              message,
              style: TextStyle(
                fontSize: 12,
                color: isError ? Colors.red[700] : Colors.green[700],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
