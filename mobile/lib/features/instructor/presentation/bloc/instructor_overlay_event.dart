import 'package:mobile/features/instructor_rooms/domain/entities/cheating_event_entity.dart';

abstract class InstructorOverlayEvent {}

class JoinInstructorExamsEvent extends InstructorOverlayEvent {
  final List<String> examIds;
  JoinInstructorExamsEvent(this.examIds);
}

class OverlayCheatingDetectedEvent extends InstructorOverlayEvent {
  final CheatingEventEntity violation;
  OverlayCheatingDetectedEvent(this.violation);
}

class DismissOverlayEvent extends InstructorOverlayEvent {}
