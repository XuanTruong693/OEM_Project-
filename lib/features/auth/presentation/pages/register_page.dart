import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import '../../../../core/storage/secure_storage_helper.dart';
import '../bloc/auth_bloc.dart';
import '../bloc/auth_event.dart';
import '../bloc/auth_state.dart';

class RegisterPage extends StatefulWidget {
  const RegisterPage({super.key});

  @override
  State<RegisterPage> createState() => _RegisterPageState();
}

class _RegisterPageState extends State<RegisterPage> {
  // Các bộ điều khiển Text Input
  final _lastNameController = TextEditingController();
  final _firstNameController = TextEditingController();
  final _emailController = TextEditingController();
  final _otpController = TextEditingController();
  final _passwordController = TextEditingController();
  final _confirmPasswordController = TextEditingController();

  // State cục bộ y hệt React
  bool _otpStep = false;
  bool _emailVerified = false;
  bool _showPassword = false;
  bool _showConfirmPassword = false;
  int _timer = 60;
  Timer? _countdownTimer;

  void _startTimer() {
    setState(() {
      _timer = 60;
    });
    _countdownTimer?.cancel();
    _countdownTimer = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (_timer > 0) {
        setState(() {
          _timer--;
        });
      } else {
        _countdownTimer?.cancel();
      }
    });
  }

  @override
  void dispose() {
    _lastNameController.dispose();
    _firstNameController.dispose();
    _emailController.dispose();
    _otpController.dispose();
    _passwordController.dispose();
    _confirmPasswordController.dispose();
    _countdownTimer?.cancel();
    super.dispose();
  }

  // Hàm gộp báo lỗi
  void _showError(String msg) {
    ScaffoldMessenger.of(
      context,
    ).showSnackBar(SnackBar(content: Text(msg), backgroundColor: Colors.red));
  }

  void _handleSendOTP() {
    final lastName = _lastNameController.text.trim();
    final firstName = _firstNameController.text.trim();
    final email = _emailController.text.trim();

    // Validation
    if (lastName.isEmpty || firstName.isEmpty) {
      _showError("Vui lòng nhập đầy đủ Họ và Tên");
      return;
    }
    final nameRegex = RegExp(
      r'^[\p{L}\s]+$',
      unicode: true,
    );
    if (!nameRegex.hasMatch(lastName) || !nameRegex.hasMatch(firstName)) {
      _showError("Họ tên không được chứa số hoặc ký tự đặc biệt");
      return;
    }
    if (email.isEmpty || !email.contains('@')) {
      _showError("Định dạng email không hợp lệ");
      return;
    }

    // Bắn event gửi OTP
    context.read<AuthBloc>().add(SendOtpEvent(email));
  }

  void _handleVerifyOTP() {
    final otp = _otpController.text.trim();
    if (otp.length != 6) {
      _showError("Mã OTP phải có 6 chữ số");
      return;
    }
    context.read<AuthBloc>().add(
      VerifyOtpEvent(email: _emailController.text.trim(), otp: otp),
    );
  }

  Future<void> _handleRegister() async {
    if (!_emailVerified) {
      _showError("Vui lòng xác minh email trước");
      return;
    }
    final password = _passwordController.text;
    if (password.length < 6) {
      _showError("Mật khẩu phải ít nhất 6 ký tự");
      return;
    }
    if (password != _confirmPasswordController.text) {
      _showError("Mật khẩu nhập lại không khớp");
      return;
    }

    // Lấy Role từ Storage (đã lưu ở trang RolePage)
    final role = await SecureStorageHelper.getSelectedRole() ?? 'instructor';
    final roomId = await SecureStorageHelper.getRoomId();

    if (mounted) {
      context.read<AuthBloc>().add(
        RegisterSubmitEvent(
          fullName:
              "${_lastNameController.text.trim()} ${_firstNameController.text.trim()}",
          email: _emailController.text.trim(),
          password: password,
          role: role,
          roomCode: role == 'student' ? roomId : null,
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
                if (state is AuthOtpSentSuccess) {
                  setState(() => _otpStep = true);
                  _startTimer();
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(
                      content: Text("Đã gửi mã OTP!"),
                      backgroundColor: Colors.green,
                    ),
                  );
                } else if (state is AuthOtpVerifiedSuccess) {
                  setState(() {
                    _otpStep = false;
                    _emailVerified = true;
                  });
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(
                      content: Text("Xác minh thành công!"),
                      backgroundColor: Colors.green,
                    ),
                  );
                } else if (state is AuthSuccess) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(
                      content: Text("Thao tác thành công!"),
                      backgroundColor: Colors.green,
                    ),
                  );
                  // Dùng Role THẬT từ state (Chuyển về chữ thường để so sánh cho chắc)
                  final actualRole = state.role.toLowerCase();
                  if (mounted) {
                    if (actualRole == 'instructor' || actualRole == 'admin') {
                      context.go('/instructor-dashboard');
                    } else {
                      context.go('/verify-room');
                    }
                  }
                } else if (state is AuthFailure) {
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
                        color: Colors.black.withValues(alpha: 0.05),
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
                              child: Container(
                                padding: const EdgeInsets.symmetric(
                                  vertical: 12,
                                ),
                                decoration: BoxDecoration(
                                  color: Colors.blue.shade100,
                                  borderRadius: const BorderRadius.horizontal(
                                    left: Radius.circular(9),
                                  ),
                                ),
                                child: const Center(
                                  child: Text(
                                    "Đăng ký",
                                    style: TextStyle(
                                      fontWeight: FontWeight.bold,
                                      color: Colors.blue,
                                    ),
                                  ),
                                ),
                              ),
                            ),
                            Expanded(
                              child: InkWell(
                                onTap: () => context.pushReplacement(
                                  '/login',
                                ), // Nhảy sang trang Login
                                child: Container(
                                  padding: const EdgeInsets.symmetric(
                                    vertical: 12,
                                  ),
                                  decoration: const BoxDecoration(
                                    color: Colors.white,
                                    borderRadius: BorderRadius.horizontal(
                                      right: Radius.circular(9),
                                    ),
                                  ),
                                  child: const Center(
                                    child: Text(
                                      "Đăng nhập",
                                      style: TextStyle(color: Colors.grey),
                                    ),
                                  ),
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 30),

                      const Text(
                        "ĐĂNG KÝ",
                        textAlign: TextAlign.center,
                        style: TextStyle(
                          fontSize: 24,
                          fontWeight: FontWeight.bold,
                          color: Colors.red,
                        ),
                      ),
                      const SizedBox(height: 20),

                      // --- FORM HỌ & TÊN ---
                      Row(
                        children: [
                          Expanded(
                            child: TextField(
                              controller: _lastNameController,
                              keyboardType: TextInputType.text,
                              enabled: !isLoading && !_otpStep,
                              decoration: InputDecoration(
                                hintText: "Họ",
                                border: OutlineInputBorder(
                                  borderRadius: BorderRadius.circular(10),
                                ),
                              ),
                            ),
                          ),
                          const SizedBox(width: 10),
                          Expanded(
                            child: TextField(
                              controller: _firstNameController,
                              keyboardType: TextInputType.text,
                              enabled: !isLoading && !_otpStep,
                              decoration: InputDecoration(
                                hintText: "Tên",
                                border: OutlineInputBorder(
                                  borderRadius: BorderRadius.circular(10),
                                ),
                              ),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 15),

                      // --- EMAIL & NÚT GỬI MÃ ---
                      Row(
                        children: [
                          Expanded(
                            child: TextField(
                              controller: _emailController,
                              enabled:
                                  !isLoading && !_otpStep && !_emailVerified,
                              decoration: InputDecoration(
                                hintText: "Email",
                                border: OutlineInputBorder(
                                  borderRadius: BorderRadius.circular(10),
                                ),
                                filled: _emailVerified,
                                fillColor: _emailVerified
                                    ? Colors.green.shade50
                                    : null,
                              ),
                            ),
                          ),
                          if (!_emailVerified && !_otpStep) ...[
                            const SizedBox(width: 10),
                            ElevatedButton(
                              onPressed: isLoading ? null : _handleSendOTP,
                              style: ElevatedButton.styleFrom(
                                backgroundColor: Colors.green,
                                padding: const EdgeInsets.symmetric(
                                  vertical: 15,
                                ),
                              ),
                              child: const Text(
                                "Gửi mã",
                                style: TextStyle(color: Colors.white),
                              ),
                            ),
                          ],
                        ],
                      ),
                      const SizedBox(height: 15),

                      // --- BƯỚC XÁC MINH OTP (Chỉ hiện khi đã gửi OTP) ---
                      if (_otpStep) ...[
                        Container(
                          padding: const EdgeInsets.all(15),
                          decoration: BoxDecoration(
                            color: Colors.blue.shade50,
                            borderRadius: BorderRadius.circular(10),
                            border: Border.all(color: Colors.blue.shade200),
                          ),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              const Text(
                                "Xác minh email",
                                style: TextStyle(
                                  fontWeight: FontWeight.bold,
                                  color: Colors.blue,
                                ),
                              ),
                              const SizedBox(height: 10),
                              Row(
                                children: [
                                  Expanded(
                                    child: TextField(
                                      controller: _otpController,
                                      enabled: !isLoading,
                                      keyboardType: TextInputType.number,
                                      maxLength: 6,
                                      textAlign: TextAlign.center,
                                      decoration: InputDecoration(
                                        hintText: "Nhập 6 số OTP",
                                        border: OutlineInputBorder(
                                          borderRadius: BorderRadius.circular(
                                            10,
                                          ),
                                        ),
                                        counterText: "",
                                      ),
                                    ),
                                  ),
                                  const SizedBox(width: 10),
                                  ElevatedButton(
                                    onPressed: isLoading
                                        ? null
                                        : _handleVerifyOTP,
                                    style: ElevatedButton.styleFrom(
                                      backgroundColor: Colors.blue,
                                      padding: const EdgeInsets.symmetric(
                                        vertical: 15,
                                      ),
                                    ),
                                    child: const Text(
                                      "Xác minh",
                                      style: TextStyle(color: Colors.white),
                                    ),
                                  ),
                                ],
                              ),
                              Row(
                                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                children: [
                                  TextButton(
                                    onPressed: () => setState(() {
                                      _otpStep = false;
                                      _otpController.clear();
                                    }),
                                    child: const Text("Quay lại nhập email"),
                                  ),
                                  TextButton(
                                    onPressed: (isLoading || _timer > 0)
                                        ? null
                                        : _handleSendOTP,
                                    child: Text(
                                      _timer > 0 ? "Gửi lại mã ($_timer s)" : "Gửi lại mã",
                                      style: TextStyle(
                                        color: _timer > 0 ? Colors.grey : Colors.green,
                                        fontWeight: FontWeight.bold,
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(height: 15),
                      ],

                      // --- MẬT KHẨU ---
                      TextField(
                        controller: _passwordController,
                        obscureText: !_showPassword,
                        keyboardType: TextInputType.text,
                        enabled: !isLoading && !_otpStep,
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
                      const SizedBox(height: 15),

                      TextField(
                        controller: _confirmPasswordController,
                        obscureText: !_showConfirmPassword,
                        keyboardType: TextInputType.text,
                        enabled: !isLoading && !_otpStep,
                        decoration: InputDecoration(
                          hintText: "Xác nhận mật khẩu",
                          border: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(10),
                          ),
                          suffixIcon: IconButton(
                            icon: Icon(
                              _showConfirmPassword
                                  ? Icons.visibility
                                  : Icons.visibility_off,
                            ),
                            onPressed: () => setState(
                              () =>
                                  _showConfirmPassword = !_showConfirmPassword,
                            ),
                          ),
                        ),
                      ),
                      const SizedBox(height: 25),

                      // --- NÚT ĐĂNG KÝ CHÍNH ---
                      ElevatedButton(
                        onPressed: (_emailVerified && !isLoading)
                            ? _handleRegister
                            : null,
                        style: ElevatedButton.styleFrom(
                          backgroundColor: Colors.blue,
                          padding: const EdgeInsets.symmetric(vertical: 15),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(10),
                          ),
                          disabledBackgroundColor: Colors.grey.shade400,
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
                            : const Text(
                                "Đăng ký",
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
                              "Hoặc đăng ký nhanh bằng",
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

                      // --- NÚT ĐĂNG KÝ GOOGLE ---
                      OutlinedButton.icon(
                        onPressed: isLoading
                            ? null
                            : () async {
                                // 👉 1. MỞ KÉT SẮT LẤY ROLE VÀ MÃ PHÒNG
                                final role =
                                    await SecureStorageHelper.getSelectedRole() ??
                                    'instructor';
                                final roomId =
                                    await SecureStorageHelper.getRoomId();

                                // 👉 2. KIỂM TRA MOUNTED VÀ GỬI EVENT
                                if (context.mounted) {
                                  context.read<AuthBloc>().add(
                                    GoogleAuthEvent(
                                      role: role,
                                      roomId: roomId, // Bắn kèm mã phòng
                                    ),
                                  );
                                }
                              },
                        icon: Image.asset(
                          'assets/images/google.png',
                          height: 24,
                        ), // Nhớ thêm hình logo google vào thư mục assets
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
