import 'dart:io';
import '../../domain/entities/user_profile_entity.dart';
import '../../domain/repositories/profile_repository.dart';
import '../datasources/profile_remote_data_source.dart';
import '../models/user_profile_model.dart';

class ProfileRepositoryImpl implements ProfileRepository {
  final ProfileRemoteDataSource remoteDataSource;

  ProfileRepositoryImpl({required this.remoteDataSource});

  @override
  Future<UserProfileEntity> getProfile() {
    return remoteDataSource.getProfile();
  }

  @override
  Future<UserProfileEntity> updateProfile(UserProfileModel profile) {
    return remoteDataSource.updateProfile(profile);
  }

  @override
  Future<String> uploadAvatar(File imageFile) {
    return remoteDataSource.uploadAvatar(imageFile);
  }
}
