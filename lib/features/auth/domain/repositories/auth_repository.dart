import 'package:dartz/dartz.dart';
import '../../../../core/error/failures.dart';
import '../entities/user_entity.dart'; // File cũ của bạn
import '../entities/room_verification_entity.dart';

abstract class AuthRepository {
  Future<UserEntity> login({
    required String email,
    required String password,
    required String role,
    String? roomId,
  });

  Future<UserEntity> register({
    required String fullName,
    required String email,
    required String password,
    required String role,
    String? roomCode,
  });

  Future<UserEntity> googleAuth({
    required String idToken,
    required String role,
    String? roomId,
  });

  Future<void> setServerRole(String role);

  Future<void> sendOtp(String email);

  Future<void> verifyOtp({required String email, required String otp});

  Future<Either<Failure, RoomVerificationEntity>> verifyRoom(String roomCode);
}
