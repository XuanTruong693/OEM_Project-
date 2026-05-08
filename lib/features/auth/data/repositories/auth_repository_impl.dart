import 'package:dartz/dartz.dart';
import 'package:mobile/core/error/failures.dart';
import 'package:mobile/features/auth/data/datasources/auth_remote_data_source.dart';
import 'package:mobile/features/auth/domain/entities/user_entity.dart';
import 'package:mobile/features/auth/domain/entities/room_verification_entity.dart';
import 'package:mobile/features/auth/domain/repositories/auth_repository.dart';

// Bản thực thi Hợp đồng
class AuthRepositoryImpl implements AuthRepository {
  final AuthRemoteDataSource authRemoteDataSource;

  // Tiêm Data Source vào đây
  AuthRepositoryImpl({required this.authRemoteDataSource});

  @override
  Future<UserEntity> login({
    required String email,
    required String password,
    required String role,
    String? roomId,
  }) async {
    // Gọi thẳng xuống DataSource. Vì UserModel kế thừa UserEntity nên trả về hợp lệ 100%
    return await authRemoteDataSource.login(
      email: email,
      password: password,
      role: role,
      roomId: roomId,
    );
  }

  @override
  Future<UserEntity> register({
    required String fullName,
    required String email,
    required String password,
    required String role,
    String? roomCode,
  }) async {
    return await authRemoteDataSource.register(
      fullName: fullName,
      email: email,
      password: password,
      role: role,
      roomCode: roomCode,
    );
  }

  @override
  Future<UserEntity> googleAuth({
    required String idToken,
    required String role,
    String? roomId,
  }) async {
    return await authRemoteDataSource.googleAuth(
      idToken: idToken,
      role: role,
      roomId: roomId,
    );
  }

  @override
  Future<void> setServerRole(String role) async {}

  @override
  Future<void> sendOtp(String email) async {
    return await authRemoteDataSource.sendOtp(email);
  }

  @override
  Future<void> verifyOtp({required String email, required String otp}) async {
    return await authRemoteDataSource.verifyOtp(email: email, otp: otp);
  }

  @override
  Future<Either<Failure, RoomVerificationEntity>> verifyRoom(String roomCode) async {
    try {
      final result = await authRemoteDataSource.verifyRoom(roomCode);
      if (result.isValid) {
        return Right(result);
      } else {
        return Left(ServerFailure(result.message ?? 'Mã phòng không hợp lệ'));
      }
    } catch (e) {
      return Left(ServerFailure(e.toString()));
    }
  }
}
