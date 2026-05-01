import '../repositories/auth_repository.dart';

class SendOtpUseCase {
  final AuthRepository repository;

  SendOtpUseCase({required this.repository});

  Future<void> call(String email) async {
    return await repository.sendOtp(email);
  }
}
