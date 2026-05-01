import 'package:dartz/dartz.dart';
import '../../../../core/error/failures.dart';
import '../entities/exam_bank_entity.dart';
import '../repositories/exam_bank_repository.dart';

class GetBankExamsUseCase {
  final ExamBankRepository repository;

  GetBankExamsUseCase(this.repository);

  Future<Either<Failure, List<ExamBankEntity>>> call({
    int page = 1,
    int limit = 10,
    String? search,
    String? status,
  }) {
    return repository.getExams(
      page: page,
      limit: limit,
      search: search,
      status: status,
    );
  }
}
