import 'package:dartz/dartz.dart';
import '../../../../core/error/failures.dart';
import '../entities/assign_exam_result_entity.dart';
import '../repositories/assign_exam_repository.dart';

class CommitExamUseCase {
  final AssignExamRepository repository;

  CommitExamUseCase(this.repository);

  Future<Either<Failure, String>> call({
    required AssignExamResultEntity data,
    required String title,
    required int duration,
  }) async {
    // 1. Kiểm tra lỗi chung của File
    if (data.validationErrors.isNotEmpty) {
      return Left(
        ServerFailure(
          "Không thể lưu đề thi:\n${data.validationErrors.join('\n')}",
        ),
      );
    }

    // 2. Kiểm tra lỗi từng câu (chưa chọn đáp án đúng, thiếu điểm, v.v.)
    final hasErrors = data.preview.any((q) => q.errors.isNotEmpty);
    if (hasErrors) {
      return Left(
        ServerFailure(
          "Có câu hỏi bị lỗi. Vui lòng kiểm tra lại trước khi commit.",
        ),
      );
    }

    // 3. ⚖️ LUẬT SẮT: TỔNG ĐIỂM PHẢI BẰNG 10
    double totalPoints = 0;
    for (var q in data.preview) {
      totalPoints += q.points ?? 0;
    }

    const tolerance = 0.00001;
    if ((totalPoints - 10.0).abs() > tolerance) {
      return Left(
        ServerFailure(
          "Tổng điểm phải bằng chính xác 10.0đ (Hiện tại: ${totalPoints.toStringAsFixed(2)}đ).\nVui lòng điều chỉnh lại điểm trong file và upload lại.",
        ),
      );
    }

    // Nếu qua hết các ải kiểm duyệt, mới gọi Repository đẩy lên API
    return repository.commitExam(data: data, title: title, duration: duration);
  }
}
