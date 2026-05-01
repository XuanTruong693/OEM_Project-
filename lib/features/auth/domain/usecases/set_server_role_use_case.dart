import '../repositories/auth_repository.dart';

class SetServerRoleUseCase {
  final AuthRepository repository;
  SetServerRoleUseCase({required this.repository});

  Future<void> call(String role) async {
    return await repository.setServerRole(role);
  }
}
