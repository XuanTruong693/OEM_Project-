import 'dart:io';
import '../repositories/profile_repository.dart';

class UpdateAvatarUseCase {
  final ProfileRepository repository;

  UpdateAvatarUseCase(this.repository);

  Future<String> call(File imageFile) {
    return repository.uploadAvatar(imageFile);
  }
}
