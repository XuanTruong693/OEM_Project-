import '../entities/exam_entity.dart';
import '../repositories/instructor_repository.dart';

class GetMyExamsUseCase {
  final InstructorRepository repository;

  GetMyExamsUseCase(this.repository);

  Future<List<ExamEntity>> call() async {
    return await repository.getMyExams();
  }
}
