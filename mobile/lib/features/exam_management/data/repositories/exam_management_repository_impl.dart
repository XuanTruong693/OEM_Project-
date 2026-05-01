import '../../../../core/error/failures.dart';
import '../../domain/entities/exam_detail_entity.dart';
import '../../domain/entities/exam_setting_entity.dart';
import '../../domain/entities/exam_summary_entity.dart';
import '../../domain/repositories/exam_management_repository.dart';
import '../datasources/exam_management_remote_data_source.dart';
import 'package:dartz/dartz.dart';

import '../models/exam_setting_request.dart.dart';

class ExamManagementRepositoryImpl implements ExamManagementRepository {
  final ExamManagementRemoteDataSource remoteDataSource;

  ExamManagementRepositoryImpl({required this.remoteDataSource});

  @override
  Future<ExamDetailEntity> getExamDetail(String examId) async {
    return await remoteDataSource.getExamDetail(examId);
  }

  @override
  Future<void> updateExam(String examId, Map<String, dynamic> payload) async {
    await remoteDataSource.updateExam(examId, payload);
  }

  @override
  Future<Either<Failure, ExamDetailEntity>> getExamPreview(
    String examId,
  ) async {
    try {
      final result = await remoteDataSource.getExamPreview(examId);
      return Right(result);
    } catch (e) {
      return Left(ServerFailure(e.toString()));
    }
  }

  @override
  Future<Either<Failure, ExamSummaryEntity>> getExamSummary(
    String examId,
  ) async {
    try {
      final result = await remoteDataSource.getExamSummary(examId);
      return Right(result);
    } catch (e) {
      return Left(ServerFailure(e.toString()));
    }
  }

  @override
  Future<Either<Failure, void>> purgeExamData(String examId) async {
    try {
      await remoteDataSource.purgeExamData(examId);
      return const Right(null);
    } catch (e) {
      return Left(ServerFailure(e.toString()));
    }
  }

  @override
  Future<Either<Failure, String>> cloneExam(String examId) async {
    try {
      final newExamId = await remoteDataSource.cloneExam(examId);
      return Right(newExamId);
    } catch (e) {
      return Left(ServerFailure(e.toString()));
    }
  }

  @override
  Future<Either<Failure, String>> submitExamSetting(
    int examId,
    ExamSettingEntity entity,
  ) async {
    try {
      // Ép kiểu Entity thành Model (Request DTO)
      final request = ExamSettingRequest.fromEntity(entity);

      // Gọi Data Source
      final roomCode = await remoteDataSource.submitExamSetting(
        examId,
        request,
      );

      return Right(roomCode);
    } catch (e) {
      // Xử lý lỗi hệ thống hoặc lỗi API và trả về Failure
      return Left(ServerFailure(e.toString()));
    }
  }
}
