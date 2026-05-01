abstract class ExamSettingState {}

class ExamSettingInitial extends ExamSettingState {}

class ExamSettingLoading extends ExamSettingState {}

class ExamSettingSuccess extends ExamSettingState {
  final String roomCode;
  ExamSettingSuccess(this.roomCode);
}

class ExamSettingFailure extends ExamSettingState {
  final String errorMessage;
  ExamSettingFailure(this.errorMessage);
}
