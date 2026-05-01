import 'package:dartz/dartz.dart';
import '../../../../core/error/failures.dart';
import '../entities/exam_bank_entity.dart';

abstract class ExamBankRepository {
  Future<Either<Failure, List<ExamBankEntity>>> getExams({
    int page = 1,
    int limit = 10,
    String? search,
    String? status,
  });

  Future<Either<Failure, void>> deleteExam(String id);
}
