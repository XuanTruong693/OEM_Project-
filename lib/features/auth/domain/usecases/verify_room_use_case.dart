import 'package:dartz/dartz.dart';
import '../../../../core/error/failures.dart';
import '../entities/room_verification_entity.dart';
import '../repositories/auth_repository.dart';

class VerifyRoomUseCase {
  final AuthRepository repository;

  VerifyRoomUseCase({required this.repository});

  Future<Either<Failure, RoomVerificationEntity>> call(String roomCode) async {
    // Gọi thẳng xuống Repository, không chứa logic if/else rườm rà ở đây
    return await repository.verifyRoom(roomCode);
  }
}
