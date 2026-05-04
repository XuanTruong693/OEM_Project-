import 'dart:async';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:dio/dio.dart';
import '../../../../core/network/dio_client.dart';

class ForgotPasswordPage extends StatefulWidget {
  const ForgotPasswordPage({super.key});

  @override
  State<ForgotPasswordPage> createState() => _ForgotPasswordPageState();
}

class _ForgotPasswordPageState extends State<ForgotPasswordPage> {
  int _currentStep = 1; // 1: Email, 2: OTP, 3: New Password
  bool _isLoading = false;
  String? _errorMessage;
  String? _successMessage;

  // Controllers Step 1
  final _emailController = TextEditingController();

  // Controllers Step 2
  final _otpController = TextEditingController();
  int _timer = 60;
  Timer? _countdownTimer;

  // Controllers Step 3
  final _passwordController = TextEditingController();
  final _confirmPasswordController = TextEditingController();
  bool _showPassword = false;
  bool _showConfirmPassword = false;

  final RegExp _emailRegex = RegExp(r'^[^\s@]+@[^\s@]+\.[^\s@]+$');

  @override
  void dispose() {
    _emailController.dispose();
    _otpController.dispose();
    _passwordController.dispose();
    _confirmPasswordController.dispose();
    _countdownTimer?.cancel();
    super.dispose();
  }

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

  void _showSnackBar(String msg, {bool isError = true}) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(msg),
        backgroundColor: isError ? Colors.red : Colors.green,
      ),
    );
  }

  // --- STEP 1 LOGIC: Email Check ---
  Future<void> _handleStep1Email() async {
    final email = _emailController.text.toLowerCase().trim();
    if (!_emailRegex.hasMatch(email)) {
      _showSnackBar("Định dạng email không hợp lệ.");
      return;
    }

    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      final dio = DioClient(onLogout: () {});

      // 1. Check if email exists
      final checkRes = await dio.dio.post('/auth/check-email', data: {
        'email': email,
      });

      if (checkRes.statusCode != 200) {
        _showSnackBar(checkRes.data['message'] ?? "Lỗi server khi kiểm tra email.");
        setState(() => _isLoading = false);
        return;
      }

      if (checkRes.data['exists'] != true) {
        _showSnackBar("Email này chưa được đăng ký trong hệ thống.");
        setState(() => _isLoading = false);
        return;
      }

      // 2. Send OTP
      final otpRes = await dio.dio.post('/auth/forgot-send-otp', data: {
        'email': email,
      });

      if (otpRes.statusCode != 200 && otpRes.data['status'] != 'success') {
        _showSnackBar(otpRes.data['message'] ?? "Không thể gửi mã xác thực.");
        setState(() => _isLoading = false);
        return;
      }

      _showSnackBar("✅ Mã OTP đã được gửi đến email của bạn!", isError: false);
      setState(() {
        _isLoading = false;
        _currentStep = 2;
      });
      _startTimer();
    } on DioException catch (e) {
      _showSnackBar(e.response?.data?['message'] ?? "Lỗi kết nối. Vui lòng thử lại.");
      setState(() => _isLoading = false);
    } catch (e) {
      _showSnackBar("Lỗi kết nối. Vui lòng thử lại.");
      setState(() => _isLoading = false);
    }
  }

  // --- STEP 2 LOGIC: Verify OTP ---
  Future<void> _handleStep2Otp() async {
    final otp = _otpController.text.trim();
    if (otp.length < 6) {
      _showSnackBar("Vui lòng nhập đủ 6 số OTP");
      return;
    }

    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      final dio = DioClient(onLogout: () {});
      final email = _emailController.text.toLowerCase().trim();

      final verifyRes = await dio.dio.post('/auth/verify-otp', data: {
        'email': email,
        'otp': otp,
      });

      if (verifyRes.data['status'] == 'success' || verifyRes.statusCode == 200) {
        _showSnackBar("✅ Xác minh OTP thành công!", isError: false);
        setState(() {
          _isLoading = false;
          _currentStep = 3;
        });
      } else {
        _showSnackBar("❌ Mã OTP không hợp lệ hoặc đã hết hạn");
        setState(() => _isLoading = false);
      }
    } on DioException catch (e) {
      _showSnackBar(e.response?.data?['message'] ?? "Lỗi xác minh OTP");
      setState(() => _isLoading = false);
    } catch (e) {
      _showSnackBar("Lỗi xác minh OTP");
      setState(() => _isLoading = false);
    }
  }

  // --- RESEND OTP LOGIC ---
  Future<void> _handleResendOtp() async {
    if (_timer > 0) return;
    final email = _emailController.text.toLowerCase().trim();

    setState(() => _isLoading = true);
    try {
      final dio = DioClient(onLogout: () {});
      await dio.dio.post('/auth/forgot-send-otp', data: {
        'email': email,
      });

      _showSnackBar("✅ Mã OTP mới đã được gửi lại!", isError: false);
      setState(() {
        _isLoading = false;
        _otpController.clear();
      });
      _startTimer();
    } on DioException catch (e) {
      _showSnackBar(e.response?.data?['message'] ?? "Gửi lại OTP thất bại");
      setState(() => _isLoading = false);
    } catch (e) {
      _showSnackBar("Gửi lại OTP thất bại");
      setState(() => _isLoading = false);
    }
  }

  // --- STEP 3 LOGIC: Reset Password ---
  Future<void> _handleStep3ResetPassword() async {
    final password = _passwordController.text;
    final confirmPassword = _confirmPasswordController.text;

    if (password != confirmPassword) {
      _showSnackBar("Mật khẩu và xác nhận mật khẩu không khớp.");
      return;
    }

    if (password.length < 6) {
      _showSnackBar("Mật khẩu phải có ít nhất 6 ký tự.");
      return;
    }

    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      final dio = DioClient(onLogout: () {});
      final email = _emailController.text.toLowerCase().trim();
      final otp = _otpController.text.trim();

      final res = await dio.dio.post('/auth/reset-password', data: {
        'email': email,
        'newPassword': password,
        'otp': otp,
      });

      if (res.statusCode == 200 || res.data['status'] == 'success') {
        _showSnackBar("✅ Đổi mật khẩu thành công! Hãy đăng nhập lại...", isError: false);
        setState(() {
          _isLoading = false;
          _successMessage = "✅ Đổi mật khẩu thành công!";
        });
        Future.delayed(const Duration(seconds: 2), () {
          if (mounted) context.go('/login');
        });
      } else {
        _showSnackBar(res.data['message'] ?? "Có lỗi xảy ra khi cập nhật mật khẩu.");
        setState(() => _isLoading = false);
      }
    } on DioException catch (e) {
      _showSnackBar(e.response?.data?['message'] ?? "Có lỗi xảy ra khi cập nhật mật khẩu.");
      setState(() => _isLoading = false);
    } catch (e) {
      _showSnackBar("Có lỗi xảy ra khi cập nhật mật khẩu.");
      setState(() => _isLoading = false);
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
            child: Container(
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
                  // Logo & Back button
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      IconButton(
                        icon: const Icon(Icons.arrow_back),
                        onPressed: () => context.go('/login'),
                      ),
                      Image.asset(
                        'assets/images/app_logo.png',
                        width: 40,
                        height: 40,
                      ),
                    ],
                  ),
                  const SizedBox(height: 20),

                  if (_currentStep == 1) ..._buildStep1Email(),
                  if (_currentStep == 2) ..._buildStep2Otp(),
                  if (_currentStep == 3) ..._buildStep3NewPassword(),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }

  // --- UI FOR STEP 1 ---
  List<Widget> _buildStep1Email() {
    return [
      const Text(
        "ĐẶT LẠI MẬT KHẨU",
        textAlign: TextAlign.center,
        style: TextStyle(
          fontSize: 22,
          fontWeight: FontWeight.bold,
          color: Colors.indigo,
        ),
      ),
      const SizedBox(height: 10),
      const Text(
        "Nhập email đã đăng ký để nhận mã xác thực OTP.",
        textAlign: TextAlign.center,
        style: TextStyle(fontSize: 14, color: Colors.grey),
      ),
      const SizedBox(height: 25),
      TextField(
        controller: _emailController,
        enabled: !_isLoading,
        keyboardType: TextInputType.emailAddress,
        decoration: InputDecoration(
          hintText: "Email đã đăng ký",
          border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(10),
          ),
        ),
      ),
      const SizedBox(height: 25),
      ElevatedButton(
        onPressed: _isLoading ? null : _handleStep1Email,
        style: ElevatedButton.styleFrom(
          backgroundColor: Colors.blue,
          padding: const EdgeInsets.symmetric(vertical: 15),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(10),
          ),
        ),
        child: _isLoading
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
                    "Đang kiểm tra...",
                    style: TextStyle(
                      color: Colors.white,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ],
              )
            : const Text(
                "Gửi mã xác thực",
                style: TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.bold,
                  color: Colors.white,
                ),
              ),
      ),
      const SizedBox(height: 20),
      TextButton(
        onPressed: () => context.go('/login'),
        child: const Text(
          "Quay lại Đăng Nhập",
          style: TextStyle(color: Colors.blue, fontSize: 14),
        ),
      ),
    ];
  }

  // --- UI FOR STEP 2 ---
  List<Widget> _buildStep2Otp() {
    return [
      const Text(
        "XÁC MINH OTP",
        textAlign: TextAlign.center,
        style: TextStyle(
          fontSize: 22,
          fontWeight: FontWeight.bold,
          color: Colors.indigo,
        ),
      ),
      const SizedBox(height: 10),
      Text(
        "Mã OTP đã được gửi đến:\n${_emailController.text}",
        textAlign: TextAlign.center,
        style: const TextStyle(fontSize: 14, color: Colors.grey),
      ),
      const SizedBox(height: 25),
      TextField(
        controller: _otpController,
        enabled: !_isLoading,
        keyboardType: TextInputType.number,
        maxLength: 6,
        textAlign: TextAlign.center,
        style: const TextStyle(fontSize: 20, fontWeight: FontWeight.bold, letterSpacing: 8),
        decoration: InputDecoration(
          hintText: "Mã OTP 6 số",
          hintStyle: const TextStyle(fontSize: 14, letterSpacing: 0, fontWeight: FontWeight.normal),
          counterText: "",
          border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(10),
          ),
        ),
      ),
      const SizedBox(height: 15),
      Center(
        child: TextButton(
          onPressed: _timer > 0 ? null : _handleResendOtp,
          child: Text(
            _timer > 0 ? "Gửi lại mã sau ${_timer}s" : "Gửi lại mã OTP",
            style: TextStyle(
              color: _timer > 0 ? Colors.grey : Colors.blue,
              fontWeight: FontWeight.bold,
            ),
          ),
        ),
      ),
      const SizedBox(height: 15),
      ElevatedButton(
        onPressed: _isLoading ? null : _handleStep2Otp,
        style: ElevatedButton.styleFrom(
          backgroundColor: Colors.blue,
          padding: const EdgeInsets.symmetric(vertical: 15),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(10),
          ),
        ),
        child: _isLoading
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
                "Xác nhận",
                style: TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.bold,
                  color: Colors.white,
                ),
              ),
      ),
      const SizedBox(height: 20),
      TextButton(
        onPressed: () => context.go('/login'),
        child: const Text(
          "Quay lại Đăng Nhập",
          style: TextStyle(color: Colors.blue, fontSize: 14),
        ),
      ),
    ];
  }

  // --- UI FOR STEP 3 ---
  List<Widget> _buildStep3NewPassword() {
    return [
      const Text(
        "MẬT KHẨU MỚI",
        textAlign: TextAlign.center,
        style: TextStyle(
          fontSize: 22,
          fontWeight: FontWeight.bold,
          color: Colors.indigo,
        ),
      ),
      const SizedBox(height: 10),
      const Text(
        "Vui lòng tạo mật khẩu mới cho tài khoản của bạn.",
        textAlign: TextAlign.center,
        style: TextStyle(fontSize: 14, color: Colors.grey),
      ),
      const SizedBox(height: 25),
      TextField(
        controller: _passwordController,
        obscureText: !_showPassword,
        enabled: !_isLoading,
        decoration: InputDecoration(
          hintText: "Mật khẩu mới",
          border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(10),
          ),
          suffixIcon: IconButton(
            icon: Icon(
              _showPassword ? Icons.visibility : Icons.visibility_off,
            ),
            onPressed: () => setState(() => _showPassword = !_showPassword),
          ),
        ),
      ),
      const SizedBox(height: 15),
      TextField(
        controller: _confirmPasswordController,
        obscureText: !_showConfirmPassword,
        enabled: !_isLoading,
        decoration: InputDecoration(
          hintText: "Xác nhận mật khẩu",
          border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(10),
          ),
          suffixIcon: IconButton(
            icon: Icon(
              _showConfirmPassword ? Icons.visibility : Icons.visibility_off,
            ),
            onPressed: () => setState(() => _showConfirmPassword = !_showConfirmPassword),
          ),
        ),
      ),
      const SizedBox(height: 25),
      ElevatedButton(
        onPressed: _isLoading ? null : _handleStep3ResetPassword,
        style: ElevatedButton.styleFrom(
          backgroundColor: Colors.blue,
          padding: const EdgeInsets.symmetric(vertical: 15),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(10),
          ),
        ),
        child: _isLoading
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
                "Xác nhận",
                style: TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.bold,
                  color: Colors.white,
                ),
              ),
      ),
      const SizedBox(height: 20),
      if (_successMessage != null)
        Padding(
          padding: const EdgeInsets.symmetric(vertical: 10),
          child: Text(
            _successMessage!,
            textAlign: TextAlign.center,
            style: const TextStyle(color: Colors.green, fontWeight: FontWeight.bold, fontSize: 14),
          ),
        ),
    ];
  }
}
