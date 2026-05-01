import 'package:mobile/core/network/dio_client.dart';
import 'package:mobile/features/instructor_rooms/domain/entities/exam_room_entity.dart';
import 'package:mobile/features/instructor_rooms/domain/entities/room_student_entity.dart';

class InstructorRoomsRemoteDataSource {
  final DioClient _dioClient;

  InstructorRoomsRemoteDataSource(this._dioClient);

  Future<List<ExamRoomEntity>> getActiveRooms() async {
    final response = await _dioClient.dio.get('/instructor/rooms/active');
    final List data = response.data;
    return data.map((json) => ExamRoomEntity.fromJson(json)).toList();
  }

  Future<ExamRoomEntity> getRoomDetail(String id) async {
    final response = await _dioClient.dio.get('/instructor/rooms/$id');
    return ExamRoomEntity.fromJson(response.data);
  }

  Future<List<RoomStudentEntity>> getRoomStudents(String id) async {
    final response = await _dioClient.dio.get('/instructor/rooms/$id/students');
    final List data = response.data;
    return data.map((json) => RoomStudentEntity.fromJson(json)).toList();
  }

  Future<void> updateRoomConfig(String id, Map<String, dynamic> config) async {
    await _dioClient.dio.patch('/instructor/rooms/$id/config', data: config);
  }

  Future<void> closeRoom(String id) async {
    await _dioClient.dio.post('/instructor/rooms/$id/close');
  }

  Future<void> performStudentAction(String submissionId, String action) async {
    await _dioClient.dio.post('/instructor/rooms/students/$submissionId/action', data: {'action': action});
  }
}
