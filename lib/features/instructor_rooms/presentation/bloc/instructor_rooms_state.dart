import 'package:mobile/features/instructor_rooms/domain/entities/exam_room_entity.dart';

abstract class InstructorRoomsState {}

class InstructorRoomsInitial extends InstructorRoomsState {}

class InstructorRoomsLoading extends InstructorRoomsState {}

class InstructorRoomsLoaded extends InstructorRoomsState {
  final List<ExamRoomEntity> allRooms;
  final List<ExamRoomEntity> filteredRooms;
  final String searchQuery;

  InstructorRoomsLoaded({
    required this.allRooms,
    required this.filteredRooms,
    this.searchQuery = '',
  });

  InstructorRoomsLoaded copyWith({
    List<ExamRoomEntity>? allRooms,
    List<ExamRoomEntity>? filteredRooms,
    String? searchQuery,
  }) {
    return InstructorRoomsLoaded(
      allRooms: allRooms ?? this.allRooms,
      filteredRooms: filteredRooms ?? this.filteredRooms,
      searchQuery: searchQuery ?? this.searchQuery,
    );
  }
}

class InstructorRoomsError extends InstructorRoomsState {
  final String message;
  InstructorRoomsError(this.message);
}
