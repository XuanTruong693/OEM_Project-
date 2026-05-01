import '../repositories/auth_repository.dart';

class VerifyOtpUseCase {
  final AuthRepository repository;

  VerifyOtpUseCase({required this.repository});

  Future<void> call({required String email, required String otp}) async {
    return await repository.verifyOtp(email: email, otp: otp);
  }
}
