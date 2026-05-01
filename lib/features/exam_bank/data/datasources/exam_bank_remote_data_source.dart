import '../../../../core/network/dio_client.dart';
import '../models/exam_bank_model.dart';

abstract class ExamBankRemoteDataSource {
  Future<List<ExamBankModel>> getExams({
    int page = 1,
    int limit = 10,
    String? search,
    String? status,
  });

  Future<void> deleteExam(String id);
}

class ExamBankRemoteDataSourceImpl implements ExamBankRemoteDataSource {
  final DioClient dioClient;

  ExamBankRemoteDataSourceImpl({required this.dioClient});

  @override
  Future<List<ExamBankModel>> getExams({
    int page = 1,
    int limit = 10,
    String? search,
    String? status,
  }) async {
    try {
      final Map<String, dynamic> queryParams = {'page': page, 'limit': limit};

      // Chỉ gửi tham số search và status nếu chúng có giá trị thật
      if (search != null && search.trim().isNotEmpty) {
        queryParams['search'] = search;
      }
      if (status != null && status != 'all') {
        queryParams['status'] = status;
      }

      final response = await dioClient.dio.get(
        '/assign-bank/exams',
        queryParameters: queryParams,
      );

      // Trích xuất mảng 'data' từ JSON trả về: { data: [...], pagination: {...} }
      final List<dynamic> dataList = response.data['data'] ?? [];

      return dataList.map((json) => ExamBankModel.fromJson(json)).toList();
    } catch (e) {
      throw Exception('Failed to load bank exams: $e');
    }
  }

  @override
  Future<void> deleteExam(String id) async {
    try {
      await dioClient.dio.delete('/assign-bank/exams/$id');
    } catch (e) {
      throw Exception('Failed to delete exam: $e');
    }
  }
}
