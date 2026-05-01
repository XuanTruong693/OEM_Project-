import 'package:dartz/dartz.dart';
import '../../../../core/error/failures.dart';
import '../entities/open_exam_entity.dart';
import '../repositories/open_exam_repository.dart';

class GetOpenExamsUseCase {
  final OpenExamRepository repository;

  GetOpenExamsUseCase(this.repository);

  Future<Either<Failure, List<OpenExamEntity>>> call() {
    return repository.getOpenExams();
  }
}
