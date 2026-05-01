import 'dart:io';
import '../entities/user_profile_entity.dart';
import '../../data/models/user_profile_model.dart';

abstract class ProfileRepository {
  Future<UserProfileEntity> getProfile();
  Future<UserProfileEntity> updateProfile(UserProfileModel profile);
  Future<String> uploadAvatar(File imageFile);
}
