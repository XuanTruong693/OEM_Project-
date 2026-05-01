import 'package:dio/dio.dart';
import '../../../../core/network/dio_client.dart';

abstract class StudentExamRemoteDataSource {
  Future<Map<String, dynamic>> getExamPublicInfo(String examId);
  Future<Map<String, dynamic>> getSubmissionStatus(String submissionId);
  Future<Map<String, dynamic>> uploadImages(String submissionId, FormData formData);
  Future<Map<String, dynamic>> verifyFace(String submissionId);
  Future<Map<String, dynamic>> verifyCard(String submissionId);
  Future<Map<String, dynamic>> verifyStudentCode(String submissionId, String code);
  Future<Map<String, dynamic>> compareFaces(String submissionId);
  Future<Map<String, dynamic>> startExam(String submissionId);
}

class StudentExamRemoteDataSourceImpl implements StudentExamRemoteDataSource {
  final DioClient dioClient;

  StudentExamRemoteDataSourceImpl({required this.dioClient});

  @override
  Future<Map<String, dynamic>> getExamPublicInfo(String examId) async {
    final res = await dioClient.dio.get('/exams/$examId/public-info');
    return res.data;
  }

  @override
  Future<Map<String, dynamic>> getSubmissionStatus(String submissionId) async {
    final res = await dioClient.dio.get('/submissions/$submissionId/status');
    return res.data;
  }

  @override
  Future<Map<String, dynamic>> uploadImages(String submissionId, FormData formData) async {
    final res = await dioClient.dio.post('/submissions/$submissionId/upload-images', data: formData);
    return res.data;
  }

  @override
  Future<Map<String, dynamic>> verifyFace(String submissionId) async {
    final res = await dioClient.dio.post('/submissions/$submissionId/verify-face');
    return res.data;
  }

  @override
  Future<Map<String, dynamic>> verifyCard(String submissionId) async {
    final res = await dioClient.dio.post('/submissions/$submissionId/verify-card');
    return res.data;
  }

  @override
  Future<Map<String, dynamic>> verifyStudentCode(String submissionId, String code) async {
    final res = await dioClient.dio.post('/submissions/$submissionId/verify-student-code', data: {'student_code': code});
    return res.data;
  }

  @override
  Future<Map<String, dynamic>> compareFaces(String submissionId) async {
    final res = await dioClient.dio.post('/submissions/$submissionId/compare-faces');
    return res.data;
  }

  @override
  Future<Map<String, dynamic>> startExam(String submissionId) async {
    final res = await dioClient.dio.post('/submissions/$submissionId/start');
    return res.data;
  }
}
