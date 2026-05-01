import 'package:dartz/dartz.dart';
import '../../../../core/error/exceptions.dart';
import '../../../../core/error/failures.dart';
import '../../domain/entities/exam_info_entity.dart';
import '../../domain/repositories/prepare_exam_repository.dart';
import '../datasources/prepare_exam_remote_data_source.dart';
import '../../domain/entities/join_exam_entity.dart';

class PrepareExamRepositoryImpl implements PrepareExamRepository {
  final PrepareExamRemoteDataSource remoteDataSource;

  PrepareExamRepositoryImpl({required this.remoteDataSource});

  @override
  Future<Either<Failure, JoinExamEntity>> joinExam(String roomToken) async {
    try {
      final model = await remoteDataSource.joinExam(roomToken);
      return Right(model);
    } on ServerException catch (e) {
      return Left(ServerFailure(e.message));
    } catch (e) {
      return const Left(ServerFailure('Đã xảy ra lỗi không xác định'));
    }
  }

  // 👉 5 HÀM MỚI (Triển khai từ Interface)
  @override
  Future<Either<Failure, ExamInfoEntity>> getExamPublicInfo(int examId) async {
    try {
      final result = await remoteDataSource.getExamPublicInfo(examId);
      return Right(result);
    } on ServerException catch (e) {
      return Left(ServerFailure(e.message));
    } catch (e) {
      // 👉 THÊM DÒNG PRINT NÀY ĐỂ XEM LOG CONSOLE
      print('🚨 LỖI THỰC SỰ KHI GET EXAM INFO: $e');

      // 👉 SỬA DÒNG NÀY ĐỂ HIỂN THỊ LỖI RA MÀN HÌNH ĐIỆN THOẠI
      return Left(ServerFailure('Lỗi chi tiết: $e'));
    }
  }

  @override
  Future<Either<Failure, Map<String, dynamic>>> verifyStudentCode(
    String submissionId,
    String studentCode,
  ) async {
    try {
      final result = await remoteDataSource.verifyStudentCode(
        submissionId,
        studentCode,
      );
      return Right(result);
    } on ServerException catch (e) {
      return Left(ServerFailure(e.message));
    } catch (e) {
      return const Left(
        ServerFailure('Lỗi không xác định khi xác minh mã sinh viên'),
      );
    }
  }

  @override
  Future<Either<Failure, Map<String, dynamic>>> verifyFace(
    String submissionId,
    String faceImagePath,
  ) async {
    try {
      final result = await remoteDataSource.verifyFace(
        submissionId,
        faceImagePath,
      );
      return Right(result);
    } on ServerException catch (e) {
      return Left(ServerFailure(e.message));
    } catch (e) {
      return const Left(
        ServerFailure('Lỗi không xác định khi xác minh khuôn mặt'),
      );
    }
  }

  @override
  Future<Either<Failure, Map<String, dynamic>>> compareFaces(
    String submissionId,
  ) async {
    try {
      final result = await remoteDataSource.compareFaces(submissionId);
      return Right(result);
    } on ServerException catch (e) {
      return Left(ServerFailure(e.message));
    } catch (e) {
      return const Left(
        ServerFailure('Lỗi không xác định khi so sánh khuôn mặt'),
      );
    }
  }

  @override
  Future<Either<Failure, Map<String, dynamic>>> uploadVerifiedImages(
    String submissionId,
    String? facePath,
    String? cardPath,
  ) async {
    try {
      final result = await remoteDataSource.uploadVerifiedImages(
        submissionId,
        facePath,
        cardPath,
      );
      return Right(result);
    } on ServerException catch (e) {
      return Left(ServerFailure(e.message));
    } catch (e) {
      return const Left(ServerFailure('Lỗi tải ảnh lên máy chủ'));
    }
  }

  @override
  Future<Either<Failure, bool>> getSubmissionBypassStatus(
    String submissionId,
  ) async {
    try {
      final result = await remoteDataSource.getSubmissionStatus(submissionId);
      final isBypassed = result['is_bypassed'] == true;
      return Right(isBypassed);
    } on ServerException catch (e) {
      return Left(ServerFailure(e.message));
    } catch (e) {
      return const Left(ServerFailure('Lỗi kiểm tra trạng thái bài thi'));
    }
  }
}
