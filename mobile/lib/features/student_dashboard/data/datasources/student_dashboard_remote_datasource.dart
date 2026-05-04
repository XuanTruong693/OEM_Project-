import 'package:dio/dio.dart';
import '../../../../../core/network/dio_client.dart';
import '../../../../../core/error/exceptions.dart';
import '../models/student_result_model.dart';
import '../models/student_profile_model.dart';

class StudentDashboardRemoteDataSource {
  final DioClient dioClient;

  StudentDashboardRemoteDataSource(this.dioClient);

  Future<List<StudentResultModel>> getMyResults() async {
    try {
      final response = await dioClient.dio.get('/results/my');
      final List<dynamic> data = response.data ?? [];
      return data.map((json) => StudentResultModel.fromJson(json)).toList();
    } on DioException catch (e) {
      final message = e.response?.data['message'] ?? 'Lỗi khi tải kết quả thi';
      throw ServerException(message);
    }
  }

  Future<StudentProfileModel> getProfile() async {
    try {
      final response = await dioClient.dio.get('/profile');
      final data = response.data['data'] ?? response.data; // Xử lý bọc data
      return StudentProfileModel.fromJson(data);
    } on DioException catch (e) {
      final message = e.response?.data['message'] ?? 'Lỗi khi tải hồ sơ';
      throw ServerException(message);
    }
  }
}
