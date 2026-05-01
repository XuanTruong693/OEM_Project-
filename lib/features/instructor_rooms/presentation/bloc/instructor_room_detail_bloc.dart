import 'dart:async';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:mobile/core/network/socket_client.dart';
import 'package:mobile/features/instructor_rooms/data/datasources/instructor_rooms_remote_datasource.dart';
import 'package:mobile/features/instructor_rooms/domain/entities/room_student_entity.dart';
import 'package:mobile/features/instructor_rooms/domain/entities/cheating_event_entity.dart';
import 'package:mobile/features/instructor_rooms/presentation/bloc/instructor_room_detail_event.dart';
import 'package:mobile/features/instructor_rooms/presentation/bloc/instructor_room_detail_state.dart';
import 'package:mobile/core/storage/secure_storage_helper.dart';

class InstructorRoomDetailBloc extends Bloc<InstructorRoomDetailEvent, InstructorRoomDetailState> {
  final InstructorRoomsRemoteDataSource _dataSource;
  InstructorRoomsRemoteDataSource get dataSource => _dataSource;
  final SocketClient _socketClient;
  final List<Function> _socketUnsubscribers = [];

  InstructorRoomDetailBloc(this._dataSource, this._socketClient) : super(InstructorRoomDetailInitial()) {
    on<LoadRoomDetailEvent>(_onLoadRoomDetail);
    on<UpdateRoomConfigEvent>(_onUpdateRoomConfig);
    on<StudentActionEvent>(_onStudentAction);
    on<SearchStudentsEvent>(_onSearchStudents);
    on<StudentRegisteredEvent>(_onStudentRegistered);
    on<StudentStatusUpdatedEvent>(_onStudentStatusUpdated);
    on<CheatingDetectedEvent>(_onCheatingDetected);
    on<ClearLatestViolationEvent>(_onClearLatestViolation);
    on<StudentSubmissionFinishedEvent>(_onStudentSubmissionFinished);
    on<ExamConfigUpdatedEvent>(_onExamConfigUpdated);
  }

  @override
  Future<void> close() {
    for (final unsub in _socketUnsubscribers) {
      unsub();
    }
    _socketUnsubscribers.clear();
    _socketClient.emit('instructor:leave-exam', null);
    return super.close();
  }

  Future<void> _onLoadRoomDetail(LoadRoomDetailEvent event, Emitter<InstructorRoomDetailState> emit) async {
    emit(InstructorRoomDetailLoading());
    try {
      final exam = await _dataSource.getRoomDetail(event.id);
      final students = await _dataSource.getRoomStudents(event.id);

      emit(InstructorRoomDetailLoaded(
        exam: exam,
        allStudents: students,
        filteredStudents: _applySearch(students, ''),
      ));

      // Setup Socket
      if (!_socketClient.isConnected) {
        final token = await SecureStorageHelper.getAccessToken();
        if (token != null) {
          _socketClient.connectSocket(token);
        }
      }
      
      _socketClient.emit('instructor:join-exam', event.id);
      
      _socketUnsubscribers.add(_socketClient.onEvent('student:registered', (data) {
        if (data != null) {
          final student = RoomStudentEntity(
            submissionId: data['submissionId']?.toString() ?? '',
            studentId: data['studentId']?.toString(),
            name: data['studentName']?.toString() ?? '',
            status: 'pending',
            attemptNo: data['attempt_no'] as int? ?? 1,
          );
          add(StudentRegisteredEvent(student));
        }
      }));

      _socketUnsubscribers.add(_socketClient.onEvent('instructor:student-status-updated', (data) {
        if (data != null && data['submissionId'] != null) {
          add(StudentStatusUpdatedEvent(data['submissionId'].toString(), data));
        }
      }));

      _socketUnsubscribers.add(_socketClient.onEvent('cheating:detected', (data) {
        if (data != null && data['submissionId'] != null) {
          final violation = CheatingEventEntity.fromJson(data);
          add(CheatingDetectedEvent(violation));
        }
      }));

      _socketUnsubscribers.add(_socketClient.onEvent('student:submission-finished', (data) {
        if (data != null && data['submissionId'] != null) {
          add(StudentSubmissionFinishedEvent(data['submissionId'].toString()));
        }
      }));

      _socketUnsubscribers.add(_socketClient.onEvent('exam:config-updated', (data) {
        if (data != null) {
          add(ExamConfigUpdatedEvent(data));
        }
      }));

    } catch (e) {
      emit(InstructorRoomDetailError(e.toString()));
    }
  }

  Future<void> _onUpdateRoomConfig(UpdateRoomConfigEvent event, Emitter<InstructorRoomDetailState> emit) async {
    if (state is InstructorRoomDetailLoaded) {
      final currentState = state as InstructorRoomDetailLoaded;
      emit(currentState.copyWith(isUpdatingConfig: true));
      try {
        await _dataSource.updateRoomConfig(currentState.exam.id, event.config);
        final updatedExam = await _dataSource.getRoomDetail(currentState.exam.id);
        emit(currentState.copyWith(exam: updatedExam, isUpdatingConfig: false));
      } catch (e) {
        emit(currentState.copyWith(isUpdatingConfig: false));
        // You could emit a temporary error state or use a snackbar in UI
      }
    }
  }

  Future<void> _onStudentAction(StudentActionEvent event, Emitter<InstructorRoomDetailState> emit) async {
    try {
      await _dataSource.performStudentAction(event.submissionId, event.action);
      // Logic for optimistic update or wait for socket
    } catch (e) {
      // Handle error
    }
  }

  void _onSearchStudents(SearchStudentsEvent event, Emitter<InstructorRoomDetailState> emit) {
    if (state is InstructorRoomDetailLoaded) {
      final currentState = state as InstructorRoomDetailLoaded;
      emit(currentState.copyWith(
        searchQuery: event.query,
        filteredStudents: _applySearch(currentState.allStudents, event.query),
      ));
    }
  }

  void _onStudentRegistered(StudentRegisteredEvent event, Emitter<InstructorRoomDetailState> emit) {
    if (state is InstructorRoomDetailLoaded) {
      final currentState = state as InstructorRoomDetailLoaded;
      if (currentState.allStudents.any((s) => s.submissionId == event.student.submissionId)) return;
      
      final updatedAll = [event.student, ...currentState.allStudents];
      emit(currentState.copyWith(
        allStudents: updatedAll,
        filteredStudents: _applySearch(updatedAll, currentState.searchQuery),
      ));
    }
  }

  void _onStudentStatusUpdated(StudentStatusUpdatedEvent event, Emitter<InstructorRoomDetailState> emit) {
    if (state is InstructorRoomDetailLoaded) {
      final currentState = state as InstructorRoomDetailLoaded;
      final updatedAll = currentState.allStudents.map((s) {
        if (s.submissionId == event.submissionId) {
          // Update status or isBypassed
          bool isBypassed = s.isBypassed;
          if (event.data['is_bypassed'] != null) {
            isBypassed = event.data['is_bypassed'] == 1 || event.data['is_bypassed'] == true;
          }
          return s.copyWith(
            status: event.data['status']?.toString() ?? s.status,
            isBypassed: isBypassed,
          );
        }
        return s;
      }).toList();

      emit(currentState.copyWith(
        allStudents: updatedAll,
        filteredStudents: _applySearch(updatedAll, currentState.searchQuery),
      ));
    }
  }

  void _onCheatingDetected(CheatingDetectedEvent event, Emitter<InstructorRoomDetailState> emit) {
    if (state is InstructorRoomDetailLoaded) {
      final currentState = state as InstructorRoomDetailLoaded;
      final updatedAll = currentState.allStudents.map((s) {
        if (s.submissionId == event.violation.submissionId) {
          return s.copyWith(cheatingCount: event.violation.cheatingCount);
        }
        return s;
      }).toList();

      emit(currentState.copyWith(
        allStudents: updatedAll,
        filteredStudents: _applySearch(updatedAll, currentState.searchQuery),
        latestViolation: event.violation,
      ));
    }
  }

  void _onClearLatestViolation(ClearLatestViolationEvent event, Emitter<InstructorRoomDetailState> emit) {
    if (state is InstructorRoomDetailLoaded) {
      final currentState = state as InstructorRoomDetailLoaded;
      emit(currentState.copyWith(clearViolation: true));
    }
  }

  void _onStudentSubmissionFinished(StudentSubmissionFinishedEvent event, Emitter<InstructorRoomDetailState> emit) {
    if (state is InstructorRoomDetailLoaded) {
      final currentState = state as InstructorRoomDetailLoaded;
      final updatedAll = currentState.allStudents.map((s) {
        if (s.submissionId == event.submissionId) {
          return s.copyWith(status: 'submitted');
        }
        return s;
      }).toList();

      emit(currentState.copyWith(
        allStudents: updatedAll,
        filteredStudents: _applySearch(updatedAll, currentState.searchQuery),
      ));
    }
  }

  void _onExamConfigUpdated(ExamConfigUpdatedEvent event, Emitter<InstructorRoomDetailState> emit) {
    if (state is InstructorRoomDetailLoaded) {
      final currentState = state as InstructorRoomDetailLoaded;
      // Update exam entity with new values
      final updatedExam = currentState.exam.copyWith(
        durationMinutes: event.updates['duration_minutes'] as int?,
        monitorScreen: event.updates['monitor_screen'] is bool 
            ? event.updates['monitor_screen'] 
            : (event.updates['monitor_screen'] == 1),
        // Add other fields as needed
      );

      emit(currentState.copyWith(exam: updatedExam));
    }
  }

  List<RoomStudentEntity> _applySearch(List<RoomStudentEntity> students, String query) {
    if (query.isEmpty) return students;
    final q = query.toLowerCase();
    return students.where((s) {
      return (s.name?.toLowerCase().contains(q) ?? false) ||
             (s.email?.toLowerCase().contains(q) ?? false) ||
             (s.studentId?.toLowerCase().contains(q) ?? false);
    }).toList();
  }
}
