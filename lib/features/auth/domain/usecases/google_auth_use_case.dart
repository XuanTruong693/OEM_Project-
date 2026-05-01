import '../entities/user_entity.dart';
import '../repositories/auth_repository.dart';

class GoogleAuthUseCase {
  final AuthRepository repository;
  GoogleAuthUseCase({required this.repository});

  Future<UserEntity> call({
    required String idToken,
    required String role,
    String? roomId,
  }) async {
    return await repository.googleAuth(
      idToken: idToken,
      role: role,
      roomId: roomId,
    );
  }
}
