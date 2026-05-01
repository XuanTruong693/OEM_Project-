import 'package:mobile/features/instructor_rooms/domain/entities/room_student_entity.dart';
import 'package:mobile/features/instructor_rooms/domain/entities/cheating_event_entity.dart';

abstract class InstructorRoomDetailEvent {}

class LoadRoomDetailEvent extends InstructorRoomDetailEvent {
  final String id;
  LoadRoomDetailEvent(this.id);
}

class UpdateRoomConfigEvent extends InstructorRoomDetailEvent {
  final Map<String, dynamic> config;
  UpdateRoomConfigEvent(this.config);
}

class StudentActionEvent extends InstructorRoomDetailEvent {
  final String submissionId;
  final String action;
  StudentActionEvent(this.submissionId, this.action);
}

class SearchStudentsEvent extends InstructorRoomDetailEvent {
  final String query;
  SearchStudentsEvent(this.query);
}

// Socket events
class StudentRegisteredEvent extends InstructorRoomDetailEvent {
  final RoomStudentEntity student;
  StudentRegisteredEvent(this.student);
}

class StudentStatusUpdatedEvent extends InstructorRoomDetailEvent {
  final String submissionId;
  final Map<String, dynamic> data;
  StudentStatusUpdatedEvent(this.submissionId, this.data);
}

class CheatingDetectedEvent extends InstructorRoomDetailEvent {
  final CheatingEventEntity violation;
  CheatingDetectedEvent(this.violation);
}

class ClearLatestViolationEvent extends InstructorRoomDetailEvent {}

class StudentSubmissionFinishedEvent extends InstructorRoomDetailEvent {
  final String submissionId;
  StudentSubmissionFinishedEvent(this.submissionId);
}

class ExamConfigUpdatedEvent extends InstructorRoomDetailEvent {
  final Map<String, dynamic> updates;
  ExamConfigUpdatedEvent(this.updates);
}
