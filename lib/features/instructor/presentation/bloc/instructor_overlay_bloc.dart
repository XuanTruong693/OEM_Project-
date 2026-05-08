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
          print("🔍 [OverlayBloc] Processing cheating event for examId: $examId");

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
            final Map<String, String> eventDict = {
              'alt_tab': "Chuyển ứng dụng (Alt+Tab)",
              'visibility_hidden': "Ẩn hoặc đổi tab bài thi",
              'window_blur': "Rời khỏi vùng làm bài (Mất Focus)",
              'fullscreen_lost': "Thoát chế độ toàn màn hình",
              'split_screen': "Sử dụng chia đôi màn hình",
              'multi_monitor_attempt': "Sử dụng nhiều màn hình",
              'screenshot_attempt': "Cố tình chụp màn hình",
              'screen_record_attempt': "Cố tình quay video màn hình",
              'screen_share_attempt': "Cố tình chia sẻ màn hình",
              'minimize_app': "Thoát ứng dụng về màn hình Home",
              'idle_timeout': "Treo máy không tương tác quá 1 phút",
              'blocked_key': "Sử dụng phím tắt bị cấm",
              'inactivity': "Không hoạt động trong thời gian dài",
              'blur_event': "Chuyển tab / Rời màn hình",
              'paste_attempt': "Thao tác dán nội dung",
              'copy_attempt': "Thao tác sao chép nội dung",
              'drag_drop_in': "Kéo thả tài liệu từ ngoài vào",
              'drag_drop_attempt': "Kéo thả tài liệu",
              'tab_switch': "Liên tục đổi tab bài thi",
              'multiple_faces': "Phát hiện có người lạ trong camera",
              'no_face': "Không thấy thí sinh trước camera",
              'no_face_detected': "Không phát hiện khuôn mặt",
              'ai_detected_cheating': "Tổng hợp hành vi đáng ngờ (AI phân tích)",
              'devtools_attempt': "Mở công cụ phát triển (DevTools)",
              'mouse_outside': "Chuột rời khỏi vùng làm bài",
              'typing_speed_violation': "Tốc độ gõ phím bất thường (Dùng Tool)",
              'screen_share_stopped': "Ngắt chia sẻ màn hình giám sát",
              'prolonged_away': "Vắng mặt quá lâu (>15 giây)",
              'Chia sẻ màn hình': "Cố tình chia sẻ màn hình",
              'Quay màn hình': "Cố tình quay video màn hình",
              'Chụp màn hình': "Cố tình chụp màn hình",
              'Thoát về Home': "Thoát ứng dụng về màn hình Home",
              'Mất tiêu điểm': "Rời khỏi vùng làm bài (Mất Focus)",
            };
            
            eventDesc = eventDict[violation.eventType] ?? 
                        (violation.reason.isNotEmpty ? (eventDict[violation.reason] ?? violation.reason) : 'Vi phạm quy chế thi');

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
        for (final id in _currentExamIds) {
          _socketClient.emit('instructor:join-exam', id);
        }
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

    for (final id in _currentExamIds) {
      _socketClient.emit('instructor:join-exam', id);
    }
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
