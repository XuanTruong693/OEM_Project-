abstract class PrepareExamState {}

class PrepareExamInitial extends PrepareExamState {}

class PrepareExamLoading extends PrepareExamState {}

// Vào phòng thành công, trả về chiến lợi phẩm
class PrepareExamJoinSuccess extends PrepareExamState {
  final String submissionId;
  final String examId;

  PrepareExamJoinSuccess({required this.submissionId, required this.examId});
}

// Bị chặn (Hết lượt, bài thi đã đóng...)
class PrepareExamJoinFailure extends PrepareExamState {
  final String message;

  PrepareExamJoinFailure({required this.message});
}
