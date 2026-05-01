import 'package:dartz/dartz.dart';
import '../../../../core/error/failures.dart';
import '../entities/exam_info_entity.dart';
import '../entities/join_exam_entity.dart';

abstract class PrepareExamRepository {
  Future<Either<Failure, JoinExamEntity>> joinExam(String roomToken);
  Future<Either<Failure, ExamInfoEntity>> getExamPublicInfo(int examId);
  Future<Either<Failure, Map<String, dynamic>>> verifyStudentCode(
    String submissionId,
    String studentCode,
  );
  Future<Either<Failure, Map<String, dynamic>>> verifyFace(
    String submissionId,
    String faceImagePath,
  );
  Future<Either<Failure, Map<String, dynamic>>> compareFaces(
    String submissionId,
  );
  Future<Either<Failure, Map<String, dynamic>>> uploadVerifiedImages(
    String submissionId,
    String? facePath,
    String? cardPath,
  );
  Future<Either<Failure, bool>> getSubmissionBypassStatus(String submissionId);
}
