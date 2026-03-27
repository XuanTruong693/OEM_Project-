class UserEntity {
  final int id;
  final String fullName; // Đổi từ username thành fullName cho khớp DB
  final String email;
  final String role; // THÊM MỚI: student hoặc instructor
  final String accessToken;
  final String refreshToken;

  UserEntity({
    required this.id,
    required this.fullName,
    required this.email,
    required this.role,
    this.accessToken = '',
    this.refreshToken = '',
  });
}
