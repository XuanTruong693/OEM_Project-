import '../../domain/entities/room_verification_entity.dart';

abstract class AuthState {}

class AuthOtpSentSuccess extends AuthState {}

class AuthOtpVerifiedSuccess extends AuthState {}

class AuthInitial extends AuthState {}

class RoleSelectedState extends AuthState {
  final String role;
  RoleSelectedState(this.role);
}

class AuthLoading extends AuthState {}

class AuthSuccess extends AuthState {
  final String message;
  final String role;

  AuthSuccess({required this.message, required this.role});
}

class AuthFailure extends AuthState {
  final String error;

  AuthFailure({required this.error});
}

class AuthVerifyRoomSuccess extends AuthState {
  final RoomVerificationEntity entity;
  // Giữ lại mã phòng gốc do user nhập để lưu két sắt
  final String originalRoomCode;

  AuthVerifyRoomSuccess({required this.entity, required this.originalRoomCode});
}

// 👉 THÊM STATE THẤT BẠI (Chuyên biệt cho Verify Room)
class AuthVerifyRoomFailure extends AuthState {
  final String errorMessage;

  AuthVerifyRoomFailure({required this.errorMessage});
}
