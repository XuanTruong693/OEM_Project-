import 'package:flutter/services.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:mobile/core/network/socket_client.dart';
import 'package:mobile/features/instructor_rooms/domain/entities/cheating_event_entity.dart';
import 'package:mobile/core/utils/notification_helper.dart';
import 'instructor_overlay_event.dart';
import 'instructor_overlay_state.dart';

class InstructorOverlayBloc
    extends Bloc<InstructorOverlayEvent, InstructorOverlayState> {
  final SocketClient _socketClient;
  List<String> _currentExamIds = [];
  final List<CheatingEventEntity> _pendingViolations = [];
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
          final examId = (data['examId'] ?? data['exam_id'] ?? data['eventDetails']?['examId'])?.toString();
          print("🔍 [OverlayBloc] Checking examId: $examId against joined exams: $_currentExamIds");

          if (examId == null || _currentExamIds.isEmpty || !_currentExamIds.contains(examId)) {
            print("ℹ️ [OverlayBloc] Skipping alert. ExamId $examId not matching current instructor's joined exams.");
            return;
          }

          // Rung dồn dập 3 nhịp kiểu Messenger/Zalo để giảng viên nhận biết khi đút túi quần / tắt màn hình
          Future.wait([
            HapticFeedback.vibrate(),
            Future.delayed(const Duration(milliseconds: 300), () => HapticFeedback.vibrate()),
            Future.delayed(const Duration(milliseconds: 600), () => HapticFeedback.vibrate()),
          ]);

          final violation = CheatingEventEntity.fromJson(data);

          // Thêm sự kiện vào hàng đợi thông minh
          if (violation.deviceChange) {
            // Đưa xin đổi thiết bị lên đầu danh sách ưu tiên hiển thị số 1
            _pendingViolations.insert(0, violation);
          } else {
            _pendingViolations.add(violation);
          }

          // Hiển thị thông báo dạng Push Notification ngay trên màn hình điện thoại
          if (violation.deviceChange) {
            final m1 = violation.firstDeviceName.isEmpty ? "Không rõ" : violation.firstDeviceName;
            final m2 = violation.secondDeviceName.isEmpty ? "Không rõ" : violation.secondDeviceName;
            NotificationHelper.showNotification(
              id: DateTime.now().millisecondsSinceEpoch ~/ 1000,
              title: '🚨 XIN ĐỔI THIẾT BỊ - ${violation.studentName}',
              body: '🔴 Máy 1: $m1 ➡️ Máy 2: $m2',
            );
          } else {
            String eventDesc = 'Hành vi bất thường';
            switch (violation.eventType) {
              case 'blur_event':
                eventDesc = 'Chuyển tab / Rời màn hình';
                break;
              case 'paste_attempt':
                eventDesc = 'Thao tác dán nội dung';
                break;
              case 'full_screen_exit':
                eventDesc = 'Thoát chế độ toàn màn hình';
                break;
              case 'multiple_faces':
                eventDesc = 'Phát hiện nhiều khuôn mặt';
                break;
              case 'no_face':
                eventDesc = 'Không phát hiện khuôn mặt';
                break;
              default:
                eventDesc = violation.reason.isNotEmpty ? violation.reason : 'Vi phạm quy chế thi';
            }

            NotificationHelper.showNotification(
              id: DateTime.now().millisecondsSinceEpoch ~/ 1000,
              title: '🚨 GIAN LẬN - ${violation.studentName}',
              body: '🔴 $eventDesc',
            );
          }

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
    if (_pendingViolations.isNotEmpty) {
      emit(
        InstructorOverlayActive(
          violation: _pendingViolations.first,
          timestamp: DateTime.now(),
        ),
      );
    }
  }

  void _onDismissOverlay(
    DismissOverlayEvent event,
    Emitter<InstructorOverlayState> emit,
  ) {
    if (_pendingViolations.isNotEmpty) {
      _pendingViolations.removeAt(0);
    }
    if (_pendingViolations.isNotEmpty) {
      emit(
        InstructorOverlayActive(
          violation: _pendingViolations.first,
          timestamp: DateTime.now(),
        ),
      );
    } else {
      emit(InstructorOverlayInitial());
    }
  }
}
