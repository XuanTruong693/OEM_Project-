import 'dart:async';
import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import '../../../../core/network/dio_client.dart';
import '../../../../core/network/socket_client.dart';
import '../../../../core/storage/secure_storage_helper.dart';
import 'take_exam_event.dart';
import 'take_exam_state.dart';

class TakeExamBloc extends Bloc<TakeExamEvent, TakeExamState> {
  final DioClient dioClient;
  static const _storage = FlutterSecureStorage();
  Timer? _pingTimer;
  Function? _configListenerRemover;
  Function? _kickedListenerRemover;

  TakeExamBloc({required this.dioClient}) : super(const TakeExamState()) {
    on<LoadExamQuestionsEvent>(_onLoadExamQuestions);
    on<SaveAnswerEvent>(_onSaveAnswer);
    on<CheatEvent>(_onCheat);
    on<CheckPingAndSyncEvent>(_onCheckPingAndSync);
    on<SubmitExamEvent>(_onSubmitExam);
    on<ExamConfigUpdatedEvent>(_onExamConfigUpdated);
    on<StudentKickedEvent>(_onStudentKicked);
  }

  Future<void> _onLoadExamQuestions(
    LoadExamQuestionsEvent event,
    Emitter<TakeExamState> emit,
  ) async {
    emit(state.copyWith(isLoading: true, errorMessage: null));

    // Initialize local answers from local cache
    Map<String, dynamic> localAnswers = {};
    try {
      final cachedStr = await _storage.read(key: 'answers_backup_${event.submissionId}');
      if (cachedStr != null) {
        localAnswers = Map<String, dynamic>.from(jsonDecode(cachedStr));
      }
    } catch (e) {
      debugPrint("Error loading local answers backup: $e");
    }

    try {
      final response = await dioClient.dio.post('/submissions/${event.submissionId}/start');
      final data = response.data;

      final questions = data['questions'] ?? [];
      final serverNowStr = data['server_now'];
      final DateTime serverNow = DateTime.tryParse(serverNowStr ?? '') ?? DateTime.now();
      final int offsetMs = serverNow.difference(DateTime.now()).inMilliseconds;

      final examData = {
        'exam_id': data['exam_id'],
        'exam_title': data['exam_title'] ?? '',
        'duration_minutes': data['duration_minutes'] ?? 60,
        'started_at': data['started_at'],
        'time_close': data['time_close'],
        'server_now': serverNowStr,
        'monitor_screen': data['monitor_screen'] ?? false,
        'last_sync': DateTime.now().millisecondsSinceEpoch, // To trigger UI update
      };

      // Also merge BE answers into local answers if they are not already cached locally
      if (data['answers'] != null && data['answers'] is List) {
        for (var ans in data['answers']) {
          final qId = ans['question_id']?.toString();
          if (qId != null && !localAnswers.containsKey(qId)) {
            if (ans['selected_option_id'] != null) {
              localAnswers[qId] = ans['selected_option_id'];
            } else if (ans['answer_text'] != null) {
              localAnswers[qId] = ans['answer_text'];
            }
          }
        }
        await _storage.write(
          key: 'answers_backup_${event.submissionId}',
          value: jsonEncode(localAnswers),
        );
      }

      emit(state.copyWith(
        isLoading: false,
        questions: questions,
        examData: examData,
        localAnswers: localAnswers,
        timeOffsetMs: offsetMs,
        violations: data['cheating_count'] != null ? (data['cheating_count'] as num).toInt() : 0,
      ));

      // Setup ping and sync interval every 3 seconds
      _pingTimer?.cancel();
      _pingTimer = Timer.periodic(const Duration(seconds: 3), (timer) {
        add(CheckPingAndSyncEvent(submissionId: event.submissionId));
      });

      // Socket initialization (Realtime alert)
      try {
        if (!socketClient.isConnected) {
          final token = await SecureStorageHelper.getAccessToken();
          if (token != null) {
            socketClient.connectSocket(token);
          }
        }

        // Register for real-time updates
        final userId = await SecureStorageHelper.getUserId();
        final studentName = await SecureStorageHelper.getFullName();
        
        socketClient.emit('student:register-submission', {
          'submissionId': int.tryParse(event.submissionId) ?? event.submissionId,
          'studentId': int.tryParse(userId ?? '') ?? userId,
          'examId': data['exam_id'],
          'studentName': studentName ?? 'Student',
        });

        _configListenerRemover?.call();
        _configListenerRemover = socketClient.onEvent('exam:config-updated', (updates) {
          if (!isClosed) {
             add(ExamConfigUpdatedEvent(updates: Map<String, dynamic>.from(updates)));
          }
        });

        _kickedListenerRemover?.call();
        _kickedListenerRemover = socketClient.onEvent('student:kicked:${event.submissionId}', (data) {
          if (!isClosed) {
            add(StudentKickedEvent(message: data is Map ? (data['message'] ?? 'Bạn đã bị giảng viên mời ra khỏi phòng thi.') : 'Bạn đã bị giảng viên mời ra khỏi phòng thi.'));
          }
        });
      } catch (e) {
        debugPrint("Error initiating socket inside TakeExamBloc: $e");
      }
    } catch (e) {
      emit(state.copyWith(
        isLoading: false,
        errorMessage: "Không thể tải đề thi. Vui lòng kiểm tra lại mạng.",
        localAnswers: localAnswers,
      ));
    }
  }

  Future<void> _onSaveAnswer(
    SaveAnswerEvent event,
    Emitter<TakeExamState> emit,
  ) async {
    final updatedAnswers = Map<String, dynamic>.from(state.localAnswers);
    updatedAnswers[event.questionId] = event.answer;

    emit(state.copyWith(localAnswers: updatedAnswers));

    // Backup to FlutterSecureStorage immediately
    try {
      await _storage.write(
        key: 'answers_backup_${event.submissionId}',
        value: jsonEncode(updatedAnswers),
      );
    } catch (e) {
      debugPrint("Error backing up answers locally: $e");
    }

    // Try sending to the backend if connected
    if (state.connectionStatus != 'red') {
      try {
        // Find question type from questions list
        final q = state.questions.firstWhere(
          (element) => element['question_id']?.toString() == event.questionId,
          orElse: () => null,
        );
        final qType = q != null ? q['type'] : 'MCQ';

        final payload = {
          'question_id': int.tryParse(event.questionId) ?? event.questionId,
          'type': qType,
        };

        if (qType == 'MCQ') {
          payload['selected_option_id'] = event.answer;
        } else {
          payload['answer_text'] = event.answer;
        }

        await dioClient.dio.post('/submissions/${event.submissionId}/answer', data: payload);
      } catch (e) {
        debugPrint("Saving answer online failed temporarily. Cached offline.");
      }
    }
  }

  final Map<String, DateTime> _lastEventTimes = {};

  Future<void> _onCheat(
    CheatEvent event,
    Emitter<TakeExamState> emit,
  ) async {
    final now = DateTime.now();
    if (_lastEventTimes.containsKey(event.key)) {
      final diff = now.difference(_lastEventTimes[event.key]!);
      if (diff.inSeconds < 1) {
        return; // Skip duplicate within 1s
      }
    }
    _lastEventTimes[event.key] = now;

    final newViolations = state.violations + 1;
    emit(state.copyWith(
      violations: newViolations,
      isBlurred: event.key == 'screenshot_attempt' ? true : state.isBlurred,
    ));

    String eventTypeInVi = event.key;
    if (event.key == 'screenshot_attempt') eventTypeInVi = 'Chụp màn hình';
    if (event.key == 'screen_record_attempt') eventTypeInVi = 'Quay màn hình';
    if (event.key == 'screen_share_attempt') eventTypeInVi = 'Chia sẻ màn hình';
    if (event.key == 'minimize_app') eventTypeInVi = 'Thoát về Home';
    if (event.key == 'window_blur') eventTypeInVi = 'Mất tiêu điểm';
    if (event.key == 'app_switching') eventTypeInVi = 'Chuyển đổi ứng dụng';
    if (event.key == 'copy_attempt') eventTypeInVi = 'Sao chép nội dung';
    if (event.key == 'paste_attempt') eventTypeInVi = 'Dán nội dung';

    // Send realtime violation event via Socket
    try {
      if (socketClient.isConnected) {
        socketClient.emit('student:cheating', {
          'submissionId': event.submissionId,
          'reason': eventTypeInVi,
          'details': event.description,
        });
      }
    } catch (e) {
      debugPrint("Realtime socket warning failed: $e");
    }

    // Send to backend via proctor-event API to log in DB
    try {
      final response = await dioClient.dio.post('/submissions/${event.submissionId}/proctor-event', data: {
        'event_type': eventTypeInVi,
        'cheating_count': newViolations,
        'details': {
          'message': event.description,
          'key': eventTypeInVi,
          'severity': 'high',
        },
      });
      final count = response.data?['cheating_count'];
      if (count != null) {
        emit(state.copyWith(violations: (count as num).toInt()));
      }
    } catch (e) {
      debugPrint("Logging cheat in backend DB failed: $e");
    }

    // Restore blurred state after 2.5 seconds
    if (event.key == 'screenshot_attempt') {
      await Future.delayed(const Duration(milliseconds: 2500));
      emit(state.copyWith(isBlurred: false));
    }
  }

  Future<void> _onCheckPingAndSync(
    CheckPingAndSyncEvent event,
    Emitter<TakeExamState> emit,
  ) async {
    final stopwatch = Stopwatch()..start();
    try {
      // Small fast ping request
      await dioClient.dio.get('/submissions/${event.submissionId}/status');
      stopwatch.stop();

      final rtt = stopwatch.elapsedMilliseconds;
      String status = 'green';
      if (rtt > 500) {
        status = 'red';
      } else if (rtt > 200) {
        status = 'yellow';
      }

      emit(state.copyWith(pingMs: rtt, connectionStatus: status));

      // Synchronize any cached/unsynced answers from local storage
      if (status != 'red') {
        for (var qId in state.localAnswers.keys) {
          final ans = state.localAnswers[qId];
          final q = state.questions.firstWhere(
            (element) => element['question_id']?.toString() == qId,
            orElse: () => null,
          );
          final qType = q != null ? q['type'] : 'MCQ';

          final payload = {
            'question_id': int.tryParse(qId) ?? qId,
            'type': qType,
          };

          if (qType == 'MCQ') {
            payload['selected_option_id'] = ans;
          } else {
            payload['answer_text'] = ans;
          }

          await dioClient.dio.post('/submissions/${event.submissionId}/answer', data: payload);
        }
      }
    } catch (e) {
      stopwatch.stop();
      emit(state.copyWith(pingMs: 999, connectionStatus: 'red'));
    }
  }

  Future<void> _onSubmitExam(
    SubmitExamEvent event,
    Emitter<TakeExamState> emit,
  ) async {
    if (state.connectionStatus == 'red') {
      emit(state.copyWith(
        errorMessage: "Bị mất kết nối. Vui lòng kết nối lại mạng để nộp bài.",
      ));
      return;
    }

    emit(state.copyWith(isSubmitting: true, errorMessage: null));

    // Compute local MCQ score
    double mcqScore = 0.0;
    try {
      for (var q in state.questions) {
        if (q['type'] == 'MCQ') {
          final qId = q['question_id']?.toString() ?? '';
          final chosen = state.localAnswers[qId];
          final options = q['options'] ?? [];
          bool isCorrect = false;
          for (var opt in options) {
            final isCorrectOpt = opt['is_correct'] == true ||
                opt['is_correct'] == 1 ||
                opt['correct'] == true ||
                opt['correct'] == 1;
            final optId = opt['option_id'];
            if (isCorrectOpt && chosen == optId) {
              isCorrect = true;
              break;
            }
          }
          if (isCorrect) {
            mcqScore += (q['points'] ?? 1.0).toDouble();
          }
        }
      }
    } catch (e) {
      debugPrint("Error calculating local MCQ score on mobile: $e");
    }

    try {
      final response = await dioClient.dio.post(
        '/submissions/${event.submissionId}/submit',
        data: event.reason != null ? {'reason': event.reason} : {},
      );
      final totalScore = response.data?['total_score'] ?? mcqScore;
      final aiScore = response.data?['ai_score'];

      emit(state.copyWith(
        isSubmitting: false,
        isSubmitted: true,
        mcqScore: (totalScore as num?)?.toDouble() ?? mcqScore,
        aiScore: (aiScore as num?)?.toDouble(),
        showResultModal: true,
        successMessage: "Nộp bài thi thành công!",
      ));
    } catch (e) {
      emit(state.copyWith(
        isSubmitting: false,
        errorMessage: "Có lỗi khi nộp bài. Vui lòng nhấn Nộp bài lần nữa.",
      ));
    }
  }

  Future<void> _onExamConfigUpdated(
    ExamConfigUpdatedEvent event,
    Emitter<TakeExamState> emit,
  ) async {
    if (state.examData == null) return;

    final updatedExamData = Map<String, dynamic>.from(state.examData!);
    
    bool changed = false;
    if (event.updates.containsKey('duration_minutes')) {
      updatedExamData['duration_minutes'] = event.updates['duration_minutes'];
      changed = true;
    }
    if (event.updates.containsKey('time_close')) {
      updatedExamData['time_close'] = event.updates['time_close'];
      changed = true;
    }

    if (changed) {
      updatedExamData['last_sync'] = DateTime.now().millisecondsSinceEpoch;
      // We don't refresh server_now here because we rely on the initial offset and started_at
      emit(state.copyWith(examData: updatedExamData));
    }
  }

  Future<void> _onStudentKicked(
    StudentKickedEvent event,
    Emitter<TakeExamState> emit,
  ) async {
    // 1. Show high-visibility notification via errorMessage
    emit(state.copyWith(
      errorMessage: event.message,
      isSubmitting: true,
      isKicked: true,
    ));

    // 2. Automatically submit answers
    final submissionId = state.examData?['submission_id']?.toString() ?? 
                       state.examData?['id']?.toString() ?? '';
    
    if (submissionId.isNotEmpty) {
      add(SubmitExamEvent(submissionId: submissionId, reason: 'kicked'));
    }
  }

  @override
  Future<void> close() {
    _pingTimer?.cancel();
    _configListenerRemover?.call();
    _kickedListenerRemover?.call();
    return super.close();
  }
}
