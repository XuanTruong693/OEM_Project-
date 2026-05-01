import 'dart:io';
import 'package:dartz/dartz.dart';
import '../../../../core/error/failures.dart';
import '../../domain/entities/assign_exam_result_entity.dart';
import '../../domain/repositories/assign_exam_repository.dart';
import '../datasources/assign_exam_local_data_source.dart';
import '../datasources/assign_exam_remote_data_source.dart';

class AssignExamRepositoryImpl implements AssignExamRepository {
  final AssignExamLocalDataSource localDataSource;
  final AssignExamRemoteDataSource remoteDataSource;

  AssignExamRepositoryImpl({
    required this.localDataSource,
    required this.remoteDataSource,
  });

  @override
  Future<Either<Failure, AssignExamResultEntity>> parseFile(
    File file, {
    String? sheetName,
  }) async {
    try {
      // Chạy hoàn toàn dưới máy local (offline)
      final result = await localDataSource.parseFile(
        file,
        sheetName: sheetName,
      );
      return Right(result);
    } catch (e) {
      return Left(ServerFailure(e.toString()));
    }
  }

  @override
  Future<Either<Failure, String>> commitExam({
    required AssignExamResultEntity data,
    required String title,
    required int duration,
  }) async {
    try {
      // Gắn token và đẩy lên server
      final examId = await remoteDataSource.commitExam(
        data: data,
        title: title,
        duration: duration,
      );
      return Right(examId);
    } catch (e) {
      return Left(ServerFailure(e.toString()));
    }
  }
}
