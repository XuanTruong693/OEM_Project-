import '../../data/models/user_profile_model.dart';
import '../entities/user_profile_entity.dart';
import '../repositories/profile_repository.dart';

class UpdateProfileUseCase {
  final ProfileRepository repository;

  UpdateProfileUseCase(this.repository);

  Future<UserProfileEntity> call(UserProfileModel profile) {
    return repository.updateProfile(profile);
  }
}
