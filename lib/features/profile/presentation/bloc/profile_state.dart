import '../../domain/entities/user_profile_entity.dart';

abstract class ProfileState {}

class ProfileInitial extends ProfileState {}

class ProfileLoading extends ProfileState {}

class ProfileLoaded extends ProfileState {
  final UserProfileEntity profile;
  ProfileLoaded(this.profile);
}

class ProfileUpdating extends ProfileState {}

class ProfileUpdated extends ProfileState {
  final UserProfileEntity profile;
  ProfileUpdated(this.profile);
}

class ProfileError extends ProfileState {
  final String message;
  ProfileError(this.message);
}

class AvatarUploading extends ProfileState {}

class AvatarUploaded extends ProfileState {
  final String avatarUrl;
  AvatarUploaded(this.avatarUrl);
}
