class UserProfileEntity {
  final int id;
  final String fullName;
  final String email;
  final String? phoneNumber;
  final String? address;
  final String? avatar;
  final String? gender;
  final String role;

  UserProfileEntity({
    required this.id,
    required this.fullName,
    required this.email,
    this.phoneNumber,
    this.address,
    this.avatar,
    this.gender,
    required this.role,
  });
}
