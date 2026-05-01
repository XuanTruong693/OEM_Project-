import 'package:mobile/features/instructor_rooms/domain/entities/cheating_event_entity.dart';

abstract class InstructorOverlayState {}

class InstructorOverlayInitial extends InstructorOverlayState {}

class InstructorOverlayActive extends InstructorOverlayState {
  final CheatingEventEntity violation;
  final DateTime timestamp;

  InstructorOverlayActive({required this.violation, required this.timestamp});
}
