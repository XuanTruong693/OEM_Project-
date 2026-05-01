import '../../../../core/network/dio_client.dart';
import '../models/dashboard_stats_model.dart';
import '../models/instructor_student_model.dart';
import '../models/instructor_submission_model.dart';
import '../models/monthly_chart_model.dart';
import '../models/exam_model.dart';

abstract class InstructorRemoteDataSource {
  Future<DashboardStatsModel> getDashboardStats();
  Future<List<MonthlyChartModel>> getMonthlyChartData();
  Future<List<ExamModel>> getMyExams();
  Future<List<InstructorSubmissionModel>> getSubmissions();
  Future<List<InstructorStudentModel>> getStudents();
}

class InstructorRemoteDataSourceImpl implements InstructorRemoteDataSource {
  final DioClient dioClient;

  InstructorRemoteDataSourceImpl({required this.dioClient});

  @override
  Future<DashboardStatsModel> getDashboardStats() async {
    try {
      // DioClient đã tự động gắn Token, chỉ việc gọi endpoint
      final response = await dioClient.dio.get('/instructor/dashboard');
      return DashboardStatsModel.fromJson(response.data);
    } catch (e) {
      throw Exception('Không thể tải thống kê: ${e.toString()}');
    }
  }

  @override
  Future<List<MonthlyChartModel>> getMonthlyChartData() async {
    try {
      final response = await dioClient.dio.get('/instructor/dashboard/monthly');

      // Ép kiểu list JSON thành List<MonthlyChartModel>
      if (response.data is List) {
        return (response.data as List)
            .map((item) => MonthlyChartModel.fromJson(item))
            .toList();
      }
      return [];
    } catch (e) {
      throw Exception('Không thể tải dữ liệu biểu đồ: ${e.toString()}');
    }
  }

  @override
  Future<List<ExamModel>> getMyExams() async {
    try {
      final response = await dioClient.dio.get('/instructor/exams/my');

      if (response.data is List) {
        return (response.data as List)
            .map((item) => ExamModel.fromJson(item))
            .toList();
      }
      return [];
    } catch (e) {
      throw Exception('Lỗi tải danh sách đề thi: ${e.toString()}');
    }
  }

  @override
  Future<List<InstructorSubmissionModel>> getSubmissions() async {
    try {
      final response = await dioClient.dio.get(
        '/instructor/dashboard/submissions',
      );
      // Đảm bảo data là List, nếu API trả null thì dùng list rỗng []
      final List<dynamic> data = response.data ?? [];

      // Map từng phần tử JSON thành Model
      return data
          .map((json) => InstructorSubmissionModel.fromJson(json))
          .toList();
    } catch (e) {
      throw Exception('Failed to load submissions: $e');
    }
  }

  @override
  Future<List<InstructorStudentModel>> getStudents() async {
    try {
      final response = await dioClient.dio.get(
        '/instructor/dashboard/students',
      );
      final List<dynamic> data = response.data ?? [];

      return data.map((json) => InstructorStudentModel.fromJson(json)).toList();
    } catch (e) {
      throw Exception('Failed to load students: $e');
    }
  }
}
