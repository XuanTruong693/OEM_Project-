import 'package:dartz/dartz.dart';
import '../../../../core/error/failures.dart';
import '../entities/exam_setting_entity.dart';
import '../repositories/exam_management_repository.dart';

class SubmitExamSettingUseCase {
  final ExamManagementRepository repository;

  SubmitExamSettingUseCase(this.repository);

  // Sử dụng hàm call() giúp UseCase có thể được gọi như một function
  // Ví dụ: final result = await submitExamSettingUseCase(examId, entity);
  Future<Either<Failure, String>> call(
    int examId,
    ExamSettingEntity entity,
  ) async {
    // Tầng UseCase là nơi chứa luật nghiệp vụ.
    // Nếu bạn muốn chặn mở phòng khi duration <= 0 mà không cần gọi API,
    // bạn có thể viết câu lệnh if (entity.duration <= 0) return Left(...) tại đây.

    return await repository.submitExamSetting(examId, entity);
  }
}
