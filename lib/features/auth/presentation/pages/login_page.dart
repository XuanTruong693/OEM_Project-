import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import '../../../../core/storage/secure_storage_helper.dart';
import '../bloc/auth_bloc.dart';
import '../bloc/auth_event.dart';
import '../bloc/auth_state.dart';

class LoginPage extends StatefulWidget {
  const LoginPage({super.key});

  @override
  State<LoginPage> createState() => _LoginPageState();
}

class _LoginPageState extends State<LoginPage> {
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  bool _showPassword = false;

  @override
  void dispose() {
    _emailController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  void _showError(String msg) {
    ScaffoldMessenger.of(
      context,
    ).showSnackBar(SnackBar(content: Text(msg), backgroundColor: Colors.red));
  }

  Future<void> _handleLogin() async {
    final email = _emailController.text.trim();
    final password = _passwordController.text;

    if (email.isEmpty || !email.contains('@')) {
      _showError("Email không hợp lệ");
      return;
    }
    if (password.isEmpty) {
      _showError("Vui lòng nhập mật khẩu");
      return;
    }
    // Mở két sắt lấy Role (và RoomId tương lai) ngay tại UI
    final role = await SecureStorageHelper.getSelectedRole() ?? 'instructor';
    final roomId = await SecureStorageHelper.getRoomId();

    if (mounted) {
      context.read<AuthBloc>().add(
        LoginEvent(
          email: email,
          password: password,
          role: role,
          roomId: roomId,
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.grey[50],
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 20),
            child: BlocConsumer<AuthBloc, AuthState>(
              listener: (context, state) async {
                if (state is AuthSuccess) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(
                      content: Text("Đăng nhập thành công!"),
                      backgroundColor: Colors.green,
                    ),
                  );

                  // Dùng Role THẬT từ state (Chuyển về chữ thường để so sánh cho chắc)
                  final actualRole = state.role.toLowerCase();
                  if (mounted) {
                    if (actualRole == 'instructor' || actualRole == 'admin') {
                      context.go('/instructor-dashboard');
                    } else {
                      final examId = await SecureStorageHelper.getPendingExamId();
                      final roomToken = await SecureStorageHelper.getRoomToken();
                      print('🔍 [Student Login Debug] Pending Exam ID: $examId, Room Token: $roomToken');

                      if (examId != null && roomToken != null) {
                        print('🚀 [Student Login Redirect] To Prepare Exam');
                        context.go('/prepare-exam?examId=$examId&roomToken=$roomToken');
                      } else {
                        print('⚠️ [Student Login Redirect] Missing examId/roomToken, returning to Verify Room');
                        context.go('/verify-room');
                      }
                    }
                  }
                } else if (state is AuthFailure) {
                  // TODO: Tương lai sẽ xử lý hiển thị Modal "Hết lượt thi" ở đây dựa vào state.error
                  _showError(state.error);
                }
              },
              builder: (context, state) {
                final isLoading = state is AuthLoading;

                return Container(
                  padding: const EdgeInsets.all(24),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(20),
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black.withOpacity(0.05),
                        blurRadius: 20,
                        spreadRadius: 5,
                      ),
                    ],
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      // --- THANH TAB: Đăng ký | Đăng nhập ---
                      Container(
                        decoration: BoxDecoration(
                          borderRadius: BorderRadius.circular(10),
                          border: Border.all(color: Colors.blue.shade100),
                        ),
                        child: Row(
                          children: [
                            Expanded(
                              child: InkWell(
                                onTap: () =>
                                    context.pushReplacement('/register'),
                                child: Container(
                                  padding: const EdgeInsets.symmetric(
                                    vertical: 12,
                                  ),
                                  decoration: const BoxDecoration(
                                    color: Colors.white,
                                    borderRadius: BorderRadius.horizontal(
                                      left: Radius.circular(9),
                                    ),
                                  ),
                                  child: const Center(
                                    child: Text(
                                      "Đăng ký",
                                      style: TextStyle(color: Colors.grey),
                                    ),
                                  ),
                                ),
                              ),
                            ),
                            Expanded(
                              child: Container(
                                padding: const EdgeInsets.symmetric(
                                  vertical: 12,
                                ),
                                decoration: BoxDecoration(
                                  color: Colors.blue.shade100,
                                  borderRadius: const BorderRadius.horizontal(
                                    right: Radius.circular(9),
                                  ),
                                ),
                                child: const Center(
                                  child: Text(
                                    "Đăng nhập",
                                    style: TextStyle(
                                      fontWeight: FontWeight.bold,
                                      color: Colors.blue,
                                    ),
                                  ),
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 30),

                      // --- LOGO ---
                      Center(
                        child: TweenAnimationBuilder(
                          tween: Tween<double>(begin: 0.8, end: 1.0),
                          duration: const Duration(seconds: 1),
                          curve: Curves.easeInOutSine,
                          builder: (context, double value, child) {
                            return Transform.scale(
                              scale: isLoading ? (0.9 + 0.1 * value) : 1.0,
                              child: Container(
                                padding: const EdgeInsets.all(12),
                                decoration: BoxDecoration(
                                  color: Colors.white,
                                  shape: BoxShape.circle,
                                  boxShadow: [
                                    BoxShadow(
                                      color: Colors.blue.withOpacity(0.1),
                                      blurRadius: 15,
                                      offset: const Offset(0, 5),
                                    ),
                                  ],
                                ),
                                child: Image.asset(
                                  'assets/images/app_logo.png',
                                  width: 50,
                                  height: 50,
                                ),
                              ),
                            );
                          },
                        ),
                      ),
                      const SizedBox(height: 24),

                      const Text(
                        "ĐĂNG NHẬP",
                        textAlign: TextAlign.center,
                        style: TextStyle(
                          fontSize: 22,
                          fontWeight: FontWeight.bold,
                          color: Colors.indigo,
                        ),
                      ),
                      const SizedBox(height: 20),

                      // --- FORM NHẬP LIỆU ---
                      TextField(
                        controller: _emailController,
                        enabled: !isLoading,
                        keyboardType: TextInputType.emailAddress,
                        decoration: InputDecoration(
                          hintText: "Email",
                          border: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(10),
                          ),
                        ),
                      ),
                      const SizedBox(height: 15),

                      TextField(
                        controller: _passwordController,
                        obscureText: !_showPassword,
                        enabled: !isLoading,
                        decoration: InputDecoration(
                          hintText: "Mật khẩu",
                          border: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(10),
                          ),
                          suffixIcon: IconButton(
                            icon: Icon(
                              _showPassword
                                  ? Icons.visibility
                                  : Icons.visibility_off,
                            ),
                            onPressed: () =>
                                setState(() => _showPassword = !_showPassword),
                          ),
                        ),
                      ),

                      // Quên mật khẩu
                      Align(
                        alignment: Alignment.centerRight,
                        child: TextButton(
                          onPressed: () {
                            // TODO: Chuyển hướng trang quên mật khẩu
                          },
                          child: const Text(
                            "Quên mật khẩu?",
                            style: TextStyle(color: Colors.blue, fontSize: 13),
                          ),
                        ),
                      ),
                      const SizedBox(height: 10),

                      // --- NÚT ĐĂNG NHẬP CHÍNH ---
                      ElevatedButton(
                        onPressed: isLoading ? null : _handleLogin,
                        style: ElevatedButton.styleFrom(
                          backgroundColor: Colors.blue,
                          padding: const EdgeInsets.symmetric(vertical: 15),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(10),
                          ),
                        ),
                        child: isLoading
                            ? const Row(
                                mainAxisAlignment: MainAxisAlignment.center,
                                children: [
                                  SizedBox(
                                    width: 18,
                                    height: 18,
                                    child: CircularProgressIndicator(
                                      color: Colors.white,
                                      strokeWidth: 2,
                                    ),
                                  ),
                                  SizedBox(width: 10),
                                  Text(
                                    "Đang xử lý...",
                                    style: TextStyle(
                                      color: Colors.white,
                                      fontWeight: FontWeight.bold,
                                    ),
                                  ),
                                ],
                              )
                            : const Text(
                                "Đăng nhập",
                                style: TextStyle(
                                  fontSize: 16,
                                  fontWeight: FontWeight.bold,
                                  color: Colors.white,
                                ),
                              ),
                      ),

                      const SizedBox(height: 20),
                      const Row(
                        children: [
                          Expanded(child: Divider()),
                          Padding(
                            padding: EdgeInsets.symmetric(horizontal: 10),
                            child: Text(
                              "Hoặc đăng nhập bằng",
                              style: TextStyle(
                                color: Colors.grey,
                                fontSize: 14,
                              ),
                            ),
                          ),
                          Expanded(child: Divider()),
                        ],
                      ),
                      const SizedBox(height: 20),

                      // --- NÚT GOOGLE ---
                      OutlinedButton.icon(
                        onPressed: isLoading
                            ? null
                            : () async {
                                // 👉 1. MỞ KÉT SẮT
                                final role =
                                    await SecureStorageHelper.getSelectedRole() ??
                                    'instructor';
                                final roomId =
                                    await SecureStorageHelper.getRoomId();

                                // 👉 2. KIỂM TRA MOUNTED VÀ GỬI EVENT
                                if (context.mounted) {
                                  context.read<AuthBloc>().add(
                                    GoogleAuthEvent(role: role, roomId: roomId),
                                  );
                                }
                              },
                        icon: Image.asset(
                          'assets/images/google.png',
                          height: 24,
                        ),
                        label: const Text(
                          "Tiếp tục với Google",
                          style: TextStyle(
                            fontSize: 16,
                            color: Colors.black87,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                        style: OutlinedButton.styleFrom(
                          padding: const EdgeInsets.symmetric(vertical: 15),
                          side: const BorderSide(color: Colors.grey),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(10),
                          ),
                        ),
                      ),
                    ],
                  ),
                );
              },
            ),
          ),
        ),
      ),
    );
  }
}
