import '../entities/user_entity.dart';
import '../repositories/auth_repository.dart';

class RegisterUseCase {
  final AuthRepository repository;

  RegisterUseCase({required this.repository});

  Future<UserEntity> call({
    required String fullName,
    required String email,
    required String password,
    required String role,
    String? roomCode,
  }) {
    return repository.register(
      fullName: fullName,
      email: email,
      password: password,
      role: role,
      roomCode: roomCode,
    );
  }
}
