import 'dart:io';
import 'package:dartz/dartz.dart';
import '../../../../core/error/failures.dart';
import '../entities/assign_exam_result_entity.dart';

abstract class AssignExamRepository {
  // Hàm đọc file. Cho phép truyền tên Sheet nếu là file Excel nhiều Sheet
  Future<Either<Failure, AssignExamResultEntity>> parseFile(
    File file, {
    String? sheetName,
  });

  // Hàm đẩy dữ liệu lên server. Trả về String là mã đề thi (Exam ID) nếu thành công
  Future<Either<Failure, String>> commitExam({
    required AssignExamResultEntity data,
    required String title,
    required int duration,
  });
}
