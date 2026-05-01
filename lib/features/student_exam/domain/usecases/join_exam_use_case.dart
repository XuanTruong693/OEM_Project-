import 'package:dartz/dartz.dart';
import '../../../../core/error/failures.dart';
import '../entities/join_exam_entity.dart';
import '../repositories/prepare_exam_repository.dart';

class JoinExamUseCase {
  final PrepareExamRepository repository;

  JoinExamUseCase(this.repository);

  Future<Either<Failure, JoinExamEntity>> call(String roomToken) async {
    return await repository.joinExam(roomToken);
  }
}
