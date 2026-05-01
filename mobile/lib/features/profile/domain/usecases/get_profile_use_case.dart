import '../entities/user_profile_entity.dart';
import '../repositories/profile_repository.dart';

class GetProfileUseCase {
  final ProfileRepository repository;

  GetProfileUseCase(this.repository);

  Future<UserProfileEntity> call() {
    return repository.getProfile();
  }
}
