import 'package:dartz/dartz.dart';
import '../../../../core/error/failures.dart';
import '../entities/open_exam_entity.dart';

abstract class OpenExamRepository {
  Future<Either<Failure, List<OpenExamEntity>>> getOpenExams();
}
