import '../../domain/entities/student_profile_entity.dart';

class StudentProfileModel extends StudentProfileEntity {
  StudentProfileModel({required super.fullName, required super.avatar});

  factory StudentProfileModel.fromJson(Map<String, dynamic> json) {
    // Trích xuất từ json['data'] nếu API bọc trong biến data
    return StudentProfileModel(
      fullName: json['full_name']?.toString() ?? 'Người dùng',
      avatar:
          json['avatar']?.toString() ?? '/icons/UI Image/default-avatar.png',
    );
  }
}
