import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import '../../../../core/storage/secure_storage_helper.dart';
import '../bloc/auth_bloc.dart';
import '../bloc/auth_event.dart';
import '../bloc/auth_state.dart';

class RolePage extends StatefulWidget {
  const RolePage({super.key});

  @override
  State<RolePage> createState() => _RolePageState();
}

class _RolePageState extends State<RolePage> {
  // Thay vì dùng _isLoading cục bộ, chúng ta sẽ lắng nghe state từ BLoC

  @override
  void initState() {
    super.initState();
    _checkAndClearOldSession();
  }

  // Tương đương useEffect trong React
  Future<void> _checkAndClearOldSession() async {
    final token = await SecureStorageHelper.getAccessToken();
    if (token != null) {
      print("Đã tìm thấy session cũ, chuẩn bị dọn dẹp...");
      // Logic dọn dẹp thêm nếu cần
    }
  }

  // Bắn event vào BLoC
  void _handleSelectRole(String role) {
    context.read<AuthBloc>().add(SelectRoleEvent(role));
  }

  @override
  Widget build(BuildContext context) {
    // BlocConsumer kết hợp cả Listener (để chuyển trang) và Builder (để hiện Loading)
    return BlocConsumer<AuthBloc, AuthState>(
      listener: (context, state) {
        if (state is RoleSelectedState) {
          // Thành công -> Chuyển trang
          if (state.role == 'instructor') {
            context.push('/register');
          } else {
            context.push('/verify-room');
          }
        } else if (state is AuthFailure) {
          // Thất bại -> Báo lỗi
          ScaffoldMessenger.of(
            context,
          ).showSnackBar(SnackBar(content: Text(state.error)));
        }
      },
      builder: (context, state) {
        // Kiểm tra xem BLoC có đang xử lý không
        final isLoading = state is AuthLoading;

        return Scaffold(
          body: Container(
            decoration: const BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: [
                  Color(0xFFF8FAFC),
                  Color(0xFFEFF6FF),
                  Color(0xFFEEF2FF),
                ],
              ),
            ),
            child: SafeArea(
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 24.0),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    // Icon Header
                    TweenAnimationBuilder(
                      tween: Tween<double>(begin: 0, end: 1),
                      duration: const Duration(milliseconds: 800),
                      builder: (context, double value, child) {
                        return Transform.scale(
                          scale: value,
                          child: Container(
                            padding: const EdgeInsets.all(
                              8,
                            ), // Padding nhỏ để logo to ngang vòng tròn
                            decoration: BoxDecoration(
                              color: Colors.white,
                              shape: BoxShape.circle,
                              boxShadow: [
                                BoxShadow(
                                  color: Colors.blue.withOpacity(0.2),
                                  blurRadius: 20,
                                  offset: const Offset(0, 10),
                                ),
                              ],
                            ),
                            child: Image.asset(
                              'assets/images/app_logo.png', // Logo OEM MINI
                              width: 70,
                              height: 70,
                              fit: BoxFit.contain,
                            ),
                          ),
                        );
                      },
                    ),
                    const SizedBox(height: 24),

                    // Tiêu đề
                    const Text(
                      'Chọn Vai Trò',
                      style: TextStyle(
                        fontSize: 28,
                        fontWeight: FontWeight.bold,
                        color: Color(0xFF1E293B),
                      ),
                    ),
                    const SizedBox(height: 8),
                    const Text(
                      'Vui lòng chọn vai trò của bạn để tiếp tục',
                      style: TextStyle(fontSize: 14, color: Color(0xFF64748B)),
                    ),
                    const SizedBox(height: 40),

                    // Nút Giảng viên
                    _buildRoleButton(
                      title: 'Instructor',
                      subtitle: 'Giảng viên',
                      icon: Icons.school_outlined,
                      colors: [Colors.blue.shade500, Colors.indigo.shade600],
                      isLoading: isLoading,
                      onTap: () => _handleSelectRole('instructor'),
                    ),
                    const SizedBox(height: 20),

                    // Nút Sinh viên
                    _buildRoleButton(
                      title: 'Student',
                      subtitle: 'Sinh viên',
                      icon: Icons.backpack_outlined,
                      colors: [Colors.indigo.shade500, Colors.purple.shade600],
                      isLoading: isLoading,
                      onTap: () => _handleSelectRole('student'),
                    ),

                    // Hiển thị Loading (Lấy trực tiếp từ BLoC state)
                    if (isLoading) ...[
                      const SizedBox(height: 30),
                      Stack(
                        alignment: Alignment.center,
                        children: [
                          const SizedBox(
                            width: 60,
                            height: 60,
                            child: CircularProgressIndicator(
                              strokeWidth: 3,
                              valueColor: AlwaysStoppedAnimation<Color>(
                                Colors.blueAccent,
                              ),
                            ),
                          ),
                          Image.asset(
                            'assets/images/app_logo.png',
                            width: 30,
                            height: 30,
                          ),
                        ],
                      ),
                      const SizedBox(height: 16),
                      ShaderMask(
                        shaderCallback: (bounds) => const LinearGradient(
                          colors: [Colors.blue, Colors.indigo],
                        ).createShader(bounds),
                        child: const Text(
                          "Đang thiết lập vai trò...",
                          style: TextStyle(
                            color: Colors.white,
                            fontWeight: FontWeight.bold,
                            fontSize: 14,
                          ),
                        ),
                      ),
                    ],
                  ],
                ),
              ),
            ),
          ),
        );
      },
    );
  }

  // Widget con để vẽ Nút bấm
  Widget _buildRoleButton({
    required String title,
    required String subtitle,
    required IconData icon,
    required List<Color> colors,
    required bool isLoading,
    required VoidCallback onTap,
  }) {
    return InkWell(
      // Vô hiệu hóa nút khi đang tải
      onTap: isLoading ? null : onTap,
      borderRadius: BorderRadius.circular(20),
      child: Container(
        padding: const EdgeInsets.all(24),
        decoration: BoxDecoration(
          gradient: LinearGradient(
            colors: colors,
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
          ),
          borderRadius: BorderRadius.circular(20),
          boxShadow: [
            BoxShadow(
              color: colors.last.withOpacity(0.4),
              blurRadius: 15,
              offset: const Offset(0, 8),
            ),
          ],
        ),
        child: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: Colors.white.withOpacity(0.2),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Icon(icon, color: Colors.white, size: 32),
            ),
            const SizedBox(width: 20),
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 20,
                    fontWeight: FontWeight.bold,
                  ),
                ),
                Text(
                  subtitle,
                  style: TextStyle(
                    color: Colors.white.withOpacity(0.8),
                    fontSize: 14,
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
