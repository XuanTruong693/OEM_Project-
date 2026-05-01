abstract class AuthEvent {}

class RegisterSubmitEvent extends AuthEvent {
  final String fullName;
  final String email;
  final String password;
  final String role;
  final String? roomId;
  final String? roomCode;

  RegisterSubmitEvent({
    required this.fullName,
    required this.email,
    required this.password,
    required this.role,
    this.roomId,
    this.roomCode,
  });
}

class LoginEvent extends AuthEvent {
  final String email;
  final String password;
  final String role;
  final String? roomId;

  LoginEvent({
    required this.email,
    required this.password,
    required this.role,
    this.roomId,
  });
}

class SendOtpEvent extends AuthEvent {
  final String email;
  SendOtpEvent(this.email);
}

class VerifyOtpEvent extends AuthEvent {
  final String email;
  final String otp;
  VerifyOtpEvent({required this.email, required this.otp});
}

class SelectRoleEvent extends AuthEvent {
  final String role;
  SelectRoleEvent(this.role);
}

class GoogleAuthEvent extends AuthEvent {
  // Không cần truyền idToken từ UI, BLoC sẽ tự lấy

  final String role;
  final String? roomId;

  GoogleAuthEvent({required this.role, this.roomId});
}

class VerifyRoomSubmitEvent extends AuthEvent {
  final String roomCode;

  VerifyRoomSubmitEvent({required this.roomCode});
}
