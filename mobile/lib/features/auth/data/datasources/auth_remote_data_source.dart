import 'package:dio/dio.dart';
import '../../../../core/network/dio_client.dart';
import '../models/user_model.dart';

class AuthRemoteDataSource {
  final DioClient dioClient;

  // Tiêm DioClient vào thông qua Constructor
  AuthRemoteDataSource({required this.dioClient});

  // --- API ĐĂNG NHẬP ---
  Future<UserModel> login({
    required String email,
    required String password,
    required String role,
    String? roomId, // roomId có thể null nếu role là instructor
  }) async {
    try {
      final response = await dioClient.dio.post(
        '/auth/login', // Không cần gõ http://10.0.2.2... nữa
        data: {
          'email': email,
          'password': password,
          'role': role,
          if (role == 'student' && roomId != null) 'roomId': roomId,
        },
      );

      // Nhét thẳng cái response.data (bản chất là Map<String, dynamic>) vào hàm fromJson
      return UserModel.fromJson(response.data);
    } on DioException catch (e) {
      // Bắt lỗi từ Backend trả về (Ví dụ: 403 Tài khoản bị khóa, 400 Sai pass)
      final errorMessage = e.response?.data['message'] ?? 'Lỗi kết nối máy chủ';
      throw Exception(errorMessage); // Ném lỗi này lên cho BLoC xử lý
    }
  }

  // --- API ĐĂNG KÝ ---
  Future<UserModel> register({
    required String fullName,
    required String email,
    required String password,
    required String role,
    String? roomCode,
  }) async {
    try {
      final response = await dioClient.dio.post(
        '/auth/register',
        data: {
          'fullName': fullName,
          'email': email,
          'password_hash':
              password, // Tên biến dựa theo authController.js của bạn
          'confirmPassword': password, // Tạm thời để giống password
          'role': role,
          if (role == 'student' && roomCode != null) 'roomCode': roomCode,
        },
      );

      return UserModel.fromJson(response.data);
    } on DioException catch (e) {
      final errorMessage = e.response?.data['message'] ?? 'Lỗi kết nối máy chủ';
      throw Exception(errorMessage);
    }
  }
}
