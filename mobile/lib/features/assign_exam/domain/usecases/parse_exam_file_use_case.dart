import 'dart:io';
import 'package:dartz/dartz.dart';
import '../../../../core/error/failures.dart';
import '../entities/assign_exam_result_entity.dart';
import '../repositories/assign_exam_repository.dart';

class ParseExamFileUseCase {
  final AssignExamRepository repository;

  ParseExamFileUseCase(this.repository);

  Future<Either<Failure, AssignExamResultEntity>> call(
    File file, {
    String? sheetName,
  }) {
    return repository.parseFile(file, sheetName: sheetName);
  }
}
