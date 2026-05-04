import 'dart:async';
import 'package:dio/dio.dart';
import '../../../../../core/network/dio_client.dart';
import '../../../../../core/network/socket_client.dart';
import '../../../../../core/error/exceptions.dart';
import '../models/result_detail_model.dart';
import '../models/result_item_model.dart';

class StudentResultsRemoteDataSource {
  final DioClient dioClient;
  final SocketClient socketClient;

  // Ống nước truyền data realtime lên BLoC
  final _configUpdateController =
      StreamController<Map<String, dynamic>>.broadcast();
  Stream<Map<String, dynamic>> get configUpdateStream =>
      _configUpdateController.stream;

  // Biến lưu trữ hàm dọn dẹp listener của Socket
  Function? _removeSocketListener;

  StudentResultsRemoteDataSource({
    required this.dioClient,
    required this.socketClient,
  }) {
    _initSocketListeners();
  }

  void _initSocketListeners() {
    // Sử dụng đúng hàm onEvent từ class SocketClient của bạn
    // Hàm này trả về một function để xoá listener, mình lưu nó vào biến _removeSocketListener
    _removeSocketListener = socketClient.onEvent("exam:config-updated", (data) {
      if (data != null) {
        _configUpdateController.add(Map<String, dynamic>.from(data));
      }
    });
  }

  Future<List<ResultItemModel>> getMyResults() async {
    try {
      final response = await dioClient.dio.get('/results/my');
      final List<dynamic> data = response.data ?? [];
      return data.map((json) => ResultItemModel.fromJson(json)).toList();
    } on DioException catch (e) {
      final msg =
          e.response?.data['message'] ?? 'Lỗi khi tải danh sách kết quả';
      throw ServerException(msg);
    }
  }

  Future<ResultDetailModel> getResultDetail(String submissionId) async {
    try {
      final response = await dioClient.dio.get('/results/$submissionId/detail');
      return ResultDetailModel.fromJson(response.data);
    } on DioException catch (e) {
      final msg = e.response?.data['message'] ?? 'Lỗi khi tải chi tiết bài thi';
      throw ServerException(msg);
    }
  }

  void dispose() {
    _configUpdateController.close();
    // Gọi hàm dọn dẹp cực kỳ an toàn và đúng logic của bạn
    if (_removeSocketListener != null) {
      _removeSocketListener!();
    }
  }
}
