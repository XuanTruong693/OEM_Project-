import '../../../../core/network/dio_client.dart';
import '../models/open_exam_model.dart';

abstract class OpenExamRemoteDataSource {
  Future<List<OpenExamModel>> getOpenExams();
}

class OpenExamRemoteDataSourceImpl implements OpenExamRemoteDataSource {
  final DioClient dioClient;

  OpenExamRemoteDataSourceImpl({required this.dioClient});

  @override
  Future<List<OpenExamModel>> getOpenExams() async {
    try {
      final response = await dioClient.dio.get('/instructor/exams/my');

      // Xử lý linh hoạt: API có thể trả về List trực tiếp hoặc nằm trong field 'data'
      List<dynamic> dataList = [];
      if (response.data is List) {
        dataList = response.data;
      } else if (response.data != null && response.data['data'] is List) {
        dataList = response.data['data'];
      }

      return dataList.map((json) => OpenExamModel.fromJson(json)).toList();
    } catch (e) {
      throw Exception('Failed to load open exams: $e');
    }
  }
}
