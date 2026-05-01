import '../entities/user_entity.dart';
import '../repositories/auth_repository.dart';

class LoginUseCase {
  final AuthRepository repository;

  LoginUseCase({required this.repository});

  Future<UserEntity> call({
    required String email,
    required String password,
    required String role,
    String? roomId,
  }) async {
    return await repository.login(
      email: email,
      password: password,
      role: role,
      roomId: roomId,
    );
  }
}
