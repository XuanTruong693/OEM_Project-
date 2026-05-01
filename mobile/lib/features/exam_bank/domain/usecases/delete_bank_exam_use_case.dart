import 'package:dartz/dartz.dart';
import '../../../../core/error/failures.dart';
import '../repositories/exam_bank_repository.dart';

class DeleteBankExamUseCase {
  final ExamBankRepository repository;

  DeleteBankExamUseCase(this.repository);

  Future<Either<Failure, void>> call(String id) {
    return repository.deleteExam(id);
  }
}
