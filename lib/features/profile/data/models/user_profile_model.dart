import '../../domain/entities/user_profile_entity.dart';

class UserProfileModel extends UserProfileEntity {
  UserProfileModel({
    required super.id,
    required super.fullName,
    required super.email,
    super.phoneNumber,
    super.address,
    super.avatar,
    super.gender,
    required super.role,
    super.isTwoFactorEnabled = false,
  });

  factory UserProfileModel.fromJson(Map<String, dynamic> json) {
    final data = json['data'] ?? json;
    return UserProfileModel(
      id: int.tryParse(data['id']?.toString() ?? '0') ?? 0,
      fullName: data['full_name'] ?? '',
      email: data['email'] ?? '',
      phoneNumber: data['phone_number'],
      address: data['address'],
      avatar: data['avatar'],
      gender: data['gender'],
      role: data['role'] ?? '',
      isTwoFactorEnabled: data['is_two_factor_enabled'] == true || data['is_two_factor_enabled'] == 1,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'full_name': fullName,
      'phone_number': phoneNumber,
      'address': address,
      'gender': gender,
    };
  }
}
