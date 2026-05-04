import 'package:flutter/services.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:mobile/core/network/socket_client.dart';
import 'package:mobile/features/instructor_rooms/domain/entities/cheating_event_entity.dart';
import 'instructor_overlay_event.dart';
import 'instructor_overlay_state.dart';

class InstructorOverlayBloc
    extends Bloc<InstructorOverlayEvent, InstructorOverlayState> {
  final SocketClient _socketClient;
  List<String> _currentExamIds = [];
  Function? _cheatingListener;

  InstructorOverlayBloc(this._socketClient)
    : super(InstructorOverlayInitial()) {
    on<JoinInstructorExamsEvent>(_onJoinExams);
    on<OverlayCheatingDetectedEvent>(_onCheatingDetected);
    on<DismissOverlayEvent>(_onDismissOverlay);

    // 1. Lắng nghe gian lận toàn cục (Đăng ký 1 lần duy nhất)
    _cheatingListener = _socketClient.onEvent('cheating:detected', (data) {
      try {
        print("📡 [OverlayBloc] Global cheating detected: $data");
        if (data != null && data['deviceChangeApproval'] == true) {
          print("ℹ️ [OverlayBloc] Skipping own device change approval event on mobile");
          return;
        }
        if (data != null &&
            (data['submissionId'] != null || data['submission_id'] != null || data['deviceChange'] == true)) {
          // Haptic Feedback để giảng viên chú ý
          HapticFeedback.vibrate();

          final violation = CheatingEventEntity.fromJson(data);
          add(OverlayCheatingDetectedEvent(violation));
        }
      } catch (e) {
        print("❌ [OverlayBloc] Error parsing cheating data: $e");
      }
    });

    // 2. Tự động RE-JOIN khi socket kết nối lại (Quan trọng!)
    _socketClient.onEvent('connect', (_) {
      if (_currentExamIds.isNotEmpty) {
        print(
          "🔄 [OverlayBloc] Socket reconnected, auto joining rooms: $_currentExamIds",
        );
        _socketClient.emit('instructor:join-exam', _currentExamIds);
      }
    });
  }

  @override
  Future<void> close() {
    _cheatingListener?.call();
    return super.close();
  }

  void _onJoinExams(
    JoinInstructorExamsEvent event,
    Emitter<InstructorOverlayState> emit,
  ) {
    _currentExamIds = event.examIds;
    print("📡 [OverlayBloc] Joining exam rooms: $_currentExamIds");

    _socketClient.emit('instructor:join-exam', _currentExamIds);
    _socketClient.socket?.emit('instructor:join-exam', _currentExamIds);
  }

  void _onCheatingDetected(
    OverlayCheatingDetectedEvent event,
    Emitter<InstructorOverlayState> emit,
  ) {
    emit(
      InstructorOverlayActive(
        violation: event.violation,
        timestamp: DateTime.now(),
      ),
    );
  }

  void _onDismissOverlay(
    DismissOverlayEvent event,
    Emitter<InstructorOverlayState> emit,
  ) {
    emit(InstructorOverlayInitial());
  }
}
