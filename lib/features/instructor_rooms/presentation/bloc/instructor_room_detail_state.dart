import 'package:mobile/features/instructor_rooms/domain/entities/exam_room_entity.dart';
import 'package:mobile/features/instructor_rooms/domain/entities/room_student_entity.dart';
import 'package:mobile/features/instructor_rooms/domain/entities/cheating_event_entity.dart';

abstract class InstructorRoomDetailState {}

class InstructorRoomDetailInitial extends InstructorRoomDetailState {}

class InstructorRoomDetailLoading extends InstructorRoomDetailState {}

class InstructorRoomDetailLoaded extends InstructorRoomDetailState {
  final ExamRoomEntity exam;
  final List<RoomStudentEntity> allStudents;
  final List<RoomStudentEntity> filteredStudents;
  final String searchQuery;
  final bool isUpdatingConfig;
  final CheatingEventEntity? latestViolation;

  InstructorRoomDetailLoaded({
    required this.exam,
    required this.allStudents,
    required this.filteredStudents,
    this.searchQuery = '',
    this.isUpdatingConfig = false,
    this.latestViolation,
  });

  InstructorRoomDetailLoaded copyWith({
    ExamRoomEntity? exam,
    List<RoomStudentEntity>? allStudents,
    List<RoomStudentEntity>? filteredStudents,
    String? searchQuery,
    bool? isUpdatingConfig,
    CheatingEventEntity? latestViolation,
    bool clearViolation = false,
  }) {
    return InstructorRoomDetailLoaded(
      exam: exam ?? this.exam,
      allStudents: allStudents ?? this.allStudents,
      filteredStudents: filteredStudents ?? this.filteredStudents,
      searchQuery: searchQuery ?? this.searchQuery,
      isUpdatingConfig: isUpdatingConfig ?? this.isUpdatingConfig,
      latestViolation: clearViolation ? null : (latestViolation ?? this.latestViolation),
    );
  }
}

class InstructorRoomDetailError extends InstructorRoomDetailState {
  final String message;
  InstructorRoomDetailError(this.message);
}
