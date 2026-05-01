import 'dart:io';
import '../../data/models/user_profile_model.dart';

abstract class ProfileEvent {}

class LoadProfileEvent extends ProfileEvent {}

class UpdateProfileInfoEvent extends ProfileEvent {
  final UserProfileModel profile;
  UpdateProfileInfoEvent(this.profile);
}

class UpdateAvatarEvent extends ProfileEvent {
  final File imageFile;
  UpdateAvatarEvent(this.imageFile);
}
