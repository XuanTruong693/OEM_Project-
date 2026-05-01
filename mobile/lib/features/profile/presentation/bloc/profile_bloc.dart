import 'package:flutter_bloc/flutter_bloc.dart';
import '../../domain/usecases/get_profile_use_case.dart';
import '../../domain/usecases/update_profile_use_case.dart';
import '../../domain/usecases/update_avatar_use_case.dart';
import 'profile_event.dart';
import 'profile_state.dart';

class ProfileBloc extends Bloc<ProfileEvent, ProfileState> {
  final GetProfileUseCase getProfileUseCase;
  final UpdateProfileUseCase updateProfileUseCase;
  final UpdateAvatarUseCase updateAvatarUseCase;

  ProfileBloc({
    required this.getProfileUseCase,
    required this.updateProfileUseCase,
    required this.updateAvatarUseCase,
  }) : super(ProfileInitial()) {
    on<LoadProfileEvent>(_onLoadProfile);
    on<UpdateProfileInfoEvent>(_onUpdateProfile);
    on<UpdateAvatarEvent>(_onUpdateAvatar);
  }

  Future<void> _onLoadProfile(LoadProfileEvent event, Emitter<ProfileState> emit) async {
    emit(ProfileLoading());
    try {
      final profile = await getProfileUseCase.call();
      emit(ProfileLoaded(profile));
    } catch (e) {
      emit(ProfileError(e.toString()));
    }
  }

  Future<void> _onUpdateProfile(UpdateProfileInfoEvent event, Emitter<ProfileState> emit) async {
    emit(ProfileUpdating());
    try {
      final profile = await updateProfileUseCase.call(event.profile);
      emit(ProfileUpdated(profile));
    } catch (e) {
      emit(ProfileError(e.toString()));
    }
  }

  Future<void> _onUpdateAvatar(UpdateAvatarEvent event, Emitter<ProfileState> emit) async {
    emit(AvatarUploading());
    try {
      final avatarUrl = await updateAvatarUseCase.call(event.imageFile);
      emit(AvatarUploaded(avatarUrl));
      // Refresh profile after upload
      add(LoadProfileEvent());
    } catch (e) {
      emit(ProfileError(e.toString()));
    }
  }
}
