import 'dart:io';
import 'package:dio/dio.dart';
import '../../../../core/network/dio_client.dart';
import '../models/user_profile_model.dart';

abstract class ProfileRemoteDataSource {
  Future<UserProfileModel> getProfile();
  Future<UserProfileModel> updateProfile(UserProfileModel profile);
  Future<String> uploadAvatar(File imageFile);
}

class ProfileRemoteDataSourceImpl implements ProfileRemoteDataSource {
  final DioClient dioClient;

  ProfileRemoteDataSourceImpl({required this.dioClient});

  @override
  Future<UserProfileModel> getProfile() async {
    try {
      final response = await dioClient.dio.get('/profile');
      return UserProfileModel.fromJson(response.data);
    } on DioException catch (e) {
      final errorMessage = e.response?.data['message'] ?? 'Không thể tải hồ sơ: ${e.message}';
      throw Exception(errorMessage);
    } catch (e) {
      throw Exception('Lỗi không xác định: $e');
    }
  }

  @override
  Future<UserProfileModel> updateProfile(UserProfileModel profile) async {
    try {
      final response = await dioClient.dio.put(
        '/profile',
        data: profile.toJson(),
      );
      return UserProfileModel.fromJson(response.data);
    } on DioException catch (e) {
      final errorMessage = e.response?.data['message'] ?? 'Không thể cập nhật hồ sơ: ${e.message}';
      throw Exception(errorMessage);
    } catch (e) {
      throw Exception('Lỗi không xác định: $e');
    }
  }

  @override
  Future<String> uploadAvatar(File imageFile) async {
    try {
      String fileName = imageFile.path.split('/').last;
      FormData formData = FormData.fromMap({
        "avatar": await MultipartFile.fromFile(imageFile.path, filename: fileName),
      });

      final response = await dioClient.dio.post(
        "/profile/avatar",
        data: formData,
      );

      if (response.data['success'] == true) {
        return response.data['data']['avatar'];
      }
      throw Exception('Upload thất bại');
    } on DioException catch (e) {
      final errorMessage = e.response?.data['message'] ?? 'Không thể tải ảnh lên: ${e.message}';
      throw Exception(errorMessage);
    } catch (e) {
      throw Exception('Lỗi không xác định: $e');
    }
  }
}
