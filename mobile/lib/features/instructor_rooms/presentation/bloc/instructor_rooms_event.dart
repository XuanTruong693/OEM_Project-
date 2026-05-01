abstract class InstructorRoomsEvent {}

class LoadActiveRoomsEvent extends InstructorRoomsEvent {}

class CloseRoomEvent extends InstructorRoomsEvent {
  final String id;
  CloseRoomEvent(this.id);
}

class SearchRoomsEvent extends InstructorRoomsEvent {
  final String query;
  SearchRoomsEvent(this.query);
}
