import '../datasources/auth_remote_data_source.dart';
import '../../domain/entities/user_entity.dart';
//import '../../domain/repositories/auth_repository.dart';

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
}
