import '../../domain/entities/user_entity.dart';

class UserModel extends UserEntity {
  UserModel({
    required int id,
    required String fullName,
    required String email,
    required String role,
    String? accessToken,
    String? refreshToken,
  }) : super(
         id: id,
         fullName: fullName,
         email: email,
         role: role,
         accessToken: accessToken ?? '',
         refreshToken: refreshToken ?? '',
       );

  // Ép cục JSON to đùng từ Backend thành UserModel
  factory UserModel.fromJson(Map<String, dynamic> json) {
    // Trích xuất object 'user' nằm bên trong
    final userData = json['user'];

    return UserModel(
      id: userData['id'],
      fullName:
          userData['full_name'] ??
          userData['fullName'], // Phòng hờ API trả về camelCase
      email: userData['email'],
      role: userData['role'],
      accessToken: json['token'], // Lấy chữ 'token' ở vòng ngoài
      refreshToken: json['refreshToken'], // Lấy ở vòng ngoài
    );
  }
}
