import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:mobile/features/instructor_rooms/data/datasources/instructor_rooms_remote_datasource.dart';
import 'package:mobile/features/instructor_rooms/presentation/bloc/instructor_rooms_event.dart';
import 'package:mobile/features/instructor_rooms/presentation/bloc/instructor_rooms_state.dart';

class InstructorRoomsBloc extends Bloc<InstructorRoomsEvent, InstructorRoomsState> {
  final InstructorRoomsRemoteDataSource _dataSource;
  InstructorRoomsRemoteDataSource get dataSource => _dataSource;

  InstructorRoomsBloc(this._dataSource) : super(InstructorRoomsInitial()) {
    on<LoadActiveRoomsEvent>(_onLoadActiveRooms);
    on<CloseRoomEvent>(_onCloseRoom);
    on<SearchRoomsEvent>(_onSearchRooms);
  }

  Future<void> _onLoadActiveRooms(LoadActiveRoomsEvent event, Emitter<InstructorRoomsState> emit) async {
    emit(InstructorRoomsLoading());
    try {
      final rooms = await _dataSource.getActiveRooms();
      emit(InstructorRoomsLoaded(allRooms: rooms, filteredRooms: rooms));
    } catch (e) {
      emit(InstructorRoomsError(e.toString()));
    }
  }

  Future<void> _onCloseRoom(CloseRoomEvent event, Emitter<InstructorRoomsState> emit) async {
    try {
      await _dataSource.closeRoom(event.id);
      add(LoadActiveRoomsEvent());
    } catch (e) {
      emit(InstructorRoomsError("Không thể đóng phòng: $e"));
    }
  }

  void _onSearchRooms(SearchRoomsEvent event, Emitter<InstructorRoomsState> emit) {
    if (state is InstructorRoomsLoaded) {
      final currentState = state as InstructorRoomsLoaded;
      final query = event.query.toLowerCase();
      final filtered = currentState.allRooms.where((room) {
        return (room.title?.toLowerCase().contains(query) ?? false) ||
               (room.examRoomCode?.toLowerCase().contains(query) ?? false);
      }).toList();
      emit(currentState.copyWith(filteredRooms: filtered, searchQuery: event.query));
    }
  }
}
