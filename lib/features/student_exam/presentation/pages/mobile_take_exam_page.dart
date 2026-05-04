import 'dart:async';
import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:flutter/cupertino.dart';
import 'package:flutter/services.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import 'package:screen_protector/screen_protector.dart';
import '../bloc/take_exam_bloc.dart';
import '../bloc/take_exam_event.dart';
import '../bloc/take_exam_state.dart';

class MobileTakeExamPage extends StatefulWidget {
  final String examId;
  final String submissionId;

  const MobileTakeExamPage({
    super.key,
    required this.examId,
    required this.submissionId,
  });

  @override
  State<MobileTakeExamPage> createState() => _MobileTakeExamPageState();
}

class _MobileTakeExamPageState extends State<MobileTakeExamPage>
    with WidgetsBindingObserver {
  static const _securityChannel = MethodChannel('com.example.mobile/security');
  Timer? _countdownTimer;
  Timer? _inactivityTimer;
  final ValueNotifier<int> _secondsLeftNotifier = ValueNotifier<int>(3600);
  int _inactiveSeconds = 0;
  bool _isDarkMode = false;
  late final DateTime _pageInitTime;
  String? _lastShownError;

  // List of GlobalKeys for scrolling directly to specific question
  final List<GlobalKey> _keys = [];

  @override
  void initState() {
    super.initState();
    _pageInitTime = DateTime.now();
    WidgetsBinding.instance.addObserver(this);

    // Lock to portrait mode to disable rotation entirely
    SystemChrome.setPreferredOrientations([
      DeviceOrientation.portraitUp,
      DeviceOrientation.portraitDown,
    ]);

    // Initial load of the exam questions
    context.read<TakeExamBloc>().add(
          LoadExamQuestionsEvent(submissionId: widget.submissionId),
        );

    // Secure the UI using ScreenProtector
    _enableScreenSecurity();

    // Start local timer
    _startLocalCountdown();

    // Start idle/inactivity monitoring
    _startInactivityMonitoring();
  }

  void _startInactivityMonitoring() {
    _inactivityTimer?.cancel();
    _inactiveSeconds = 0;
    _inactivityTimer = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (!mounted) return;
      _inactiveSeconds++;

      if (_inactiveSeconds == 30) {
        // Warning notification and sound alert
        SystemSound.play(SystemSoundType.alert);
        ScaffoldMessenger.of(context).hideCurrentSnackBar();
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('CẢNH BÁO: Bạn đã treo màn hình 30 giây không tương tác! Vui lòng tập trung làm bài.'),
            backgroundColor: Colors.orange,
            duration: Duration(seconds: 4),
          ),
        );
      } else if (_inactiveSeconds >= 60) {
        // Increment cheating violation due to idle timeout
        _handleCheatingEvent('idle_timeout', 'Học viên đã treo màn hình quá 1 phút không tương tác');
        _inactiveSeconds = 0; // Reset after penalty to allow next interval check
      }
    });
  }

  void _resetInactivityTimer() {
    _inactiveSeconds = 0;
  }

  void _enableScreenSecurity() async {
    try {
      await _securityChannel.invokeMethod('enableSecureMode');
    } catch (e) {
      debugPrint("Native secure mode error: $e");
    }
    try {
      await ScreenProtector.preventScreenshotOn();
      if (Theme.of(context).platform == TargetPlatform.iOS) {
        await ScreenProtector.protectDataLeakageWithColor(Colors.black);
      }

      // Listen for screenshots or recordings
      ScreenProtector.addListener(() {
        if (mounted) {
          _handleCheatingEvent('screenshot_attempt', 'Thí sinh đã chụp màn hình (Screenshot Attempt)');
        }
      }, (screenshotPath) {
        if (mounted) {
          _handleCheatingEvent('screenshot_attempt', 'Thí sinh đã chụp màn hình (Screenshot Attempt)');
        }
      });

      // Periodically check for screen capture (recording or sharing)
      Timer.periodic(const Duration(seconds: 3), (timer) async {
        if (!mounted) {
          timer.cancel();
          return;
        }
        try {
          final Map? status = await _securityChannel.invokeMethod<Map>('checkScreenStatus');
          if (status != null) {
            final bool isRecording = status['isRecording'] == true;
            final bool isSharing = status['isSharing'] == true;
            if (isRecording) {
              _handleCheatingEvent('screen_record_attempt', 'Học viên đang quay màn hình bài thi');
            }
            if (isSharing) {
              _handleCheatingEvent('screen_share_attempt', 'Học viên đang chia sẻ màn hình bài thi');
            }
          }
        } catch (e) {
          // ignore
        }
      });
    } catch (e) {
      debugPrint("Screen security error: $e");
    }
  }

  void _disableScreenSecurity() async {
    try {
      await _securityChannel.invokeMethod('disableSecureMode');
    } catch (e) {
      debugPrint("Native secure mode disable error: $e");
    }
    try {
      await ScreenProtector.preventScreenshotOff();
      await ScreenProtector.protectDataLeakageOff();
    } catch (e) {
      debugPrint("Error removing screen security: $e");
    }
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _countdownTimer?.cancel();
    _inactivityTimer?.cancel();
    _disableScreenSecurity();

    // Re-allow all orientations when leaving
    SystemChrome.setPreferredOrientations([
      DeviceOrientation.portraitUp,
      DeviceOrientation.portraitDown,
      DeviceOrientation.landscapeLeft,
      DeviceOrientation.landscapeRight,
    ]);

    super.dispose();
  }

  void _startLocalCountdown() {
    _countdownTimer = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (!mounted) return;
      if (_secondsLeftNotifier.value > 0) {
        _secondsLeftNotifier.value--;
      } else {
        _countdownTimer?.cancel();
        // Auto submit when time runs out
        context.read<TakeExamBloc>().add(
              SubmitExamEvent(submissionId: widget.submissionId),
            );
      }
    });
  }

  final Map<String, DateTime> _lastEventTimes = {};

  void _handleCheatingEvent(String key, String description) {
    if (!mounted) return;

    final now = DateTime.now();
    if (now.difference(_pageInitTime).inSeconds < 10) {
      return; // Ignore any initial glitches within first 10s
    }

    if (_lastEventTimes.containsKey(key)) {
      final diff = now.difference(_lastEventTimes[key]!);
      if (diff.inSeconds < 3) {
        return; // Debounced
      }
    }
    _lastEventTimes[key] = now;

    final state = context.read<TakeExamBloc>().state;
    final newViolations = state.violations + 1;

    // Check if total violations exceed 10 times
    if (newViolations >= 10) {
      context.read<TakeExamBloc>().add(
            CheatEvent(
              submissionId: widget.submissionId,
              key: key,
              description: '$description - Đã vi phạm quy chế $newViolations lần (QUÁ 10 LẦN). Hệ thống tự động nộp bài.',
            ),
          );

      Future.delayed(const Duration(milliseconds: 500), () {
        if (mounted) {
          context.read<TakeExamBloc>().add(
                SubmitExamEvent(submissionId: widget.submissionId),
              );
        }
      });
    } else {
      context.read<TakeExamBloc>().add(
            CheatEvent(
              submissionId: widget.submissionId,
              key: key,
              description: description,
            ),
          );
    }
  }

  bool _showBlurOverlay = false;
  bool _isExited = false;
  DateTime? _lastLifecycleMinimize;

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    super.didChangeAppLifecycleState(state);

    final now = DateTime.now();
    if (now.difference(_pageInitTime).inSeconds < 10) {
      return; // Ignore initial transition glitches
    }

    // Ignore inactive state completely (triggered when pulling notification/status bars)
    if (state == AppLifecycleState.paused) {
      if (!_isExited || _lastLifecycleMinimize == null || now.difference(_lastLifecycleMinimize!).inSeconds >= 10) {
        _lastLifecycleMinimize = now;
        _isExited = true;
        _handleCheatingEvent('minimize_app', 'Học viên thoát ứng dụng về màn hình Home');
      }
      setState(() {
        _showBlurOverlay = true;
      });
    } else if (state == AppLifecycleState.resumed) {
      Future.delayed(const Duration(milliseconds: 300), () {
        if (mounted) {
          setState(() {
            _showBlurOverlay = false;
            _isExited = false;
          });
        }
      });
    }
  }

  void _showResultOverlayModal(BuildContext context, TakeExamState state) {
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (BuildContext ctx) {
        return BackdropFilter(
          filter: ImageFilter.blur(sigmaX: 5, sigmaY: 5),
          child: AlertDialog(
            backgroundColor: _isDarkMode ? const Color(0xFF1E293B) : Colors.white,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(24),
            ),
            contentPadding: const EdgeInsets.all(24),
            content: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: const Color(0xFFDCFCE7),
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: const Icon(
                    Icons.check_circle_outline_rounded,
                    color: Color(0xFF16A34A),
                    size: 48,
                  ),
                ),
                const SizedBox(height: 16),
                Text(
                  'Nộp bài thành công!',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    fontSize: 20,
                    fontWeight: FontWeight.w900,
                    color: _isDarkMode ? Colors.white : const Color(0xFF1E293B),
                    letterSpacing: -0.5,
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  'Bài thi trắc nghiệm của bạn đã được hệ thống chấm điểm ngay lập tức.',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    fontSize: 13,
                    color: _isDarkMode ? Colors.grey.shade400 : Colors.grey.shade600,
                  ),
                ),
                const SizedBox(height: 20),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                  decoration: BoxDecoration(
                    color: _isDarkMode ? const Color(0xFF334155) : const Color(0xFFF8FAFC),
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: _isDarkMode ? Colors.transparent : const Color(0xFFE2E8F0)),
                  ),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        'Điểm trắc nghiệm:',
                        style: TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.bold,
                          color: _isDarkMode ? Colors.grey.shade300 : const Color(0xFF64748B),
                        ),
                      ),
                      Text(
                        '${state.mcqScore?.toStringAsFixed(1) ?? '0.0'} điểm',
                        style: const TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.w900,
                          color: Color(0xFF2563EB),
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 8),
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: const Color(0xFFEFF6FF),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: const Row(
                    children: [
                      Icon(Icons.info_outline, color: Color(0xFF2563EB), size: 16),
                      SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          'Đối với các câu hỏi tự luận, kết quả sẽ được AI chấm và cập nhật sau.',
                          style: TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.w600,
                            color: Color(0xFF1D4ED8),
                            height: 1.35,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 24),
                SizedBox(
                  width: double.infinity,
                  height: 48,
                  child: ElevatedButton(
                    onPressed: () {
                      Navigator.of(ctx).pop();
                      context.go('/student-dashboard');
                    },
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFF2563EB),
                      elevation: 0,
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12),
                      ),
                    ),
                    child: const Text(
                      'Quay về trang chủ',
                      style: TextStyle(
                        fontSize: 15,
                        fontWeight: FontWeight.bold,
                        color: Colors.white,
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  void _confirmSubmission(BuildContext context, TakeExamState state) {
    // Determine unanswered questions
    final List<int> unansweredIndices = [];
    final questions = state.questions;
    for (int i = 0; i < questions.length; i++) {
      final q = questions[i];
      final qId = q['question_id']?.toString() ?? '';
      final ans = state.localAnswers[qId];
      bool isAnswered = false;
      if (ans != null) {
        if (ans is String && ans.trim().isNotEmpty) {
          isAnswered = true;
        } else if (ans is int || ans is num) {
          isAnswered = true;
        }
      }
      if (!isAnswered) {
        unansweredIndices.add(i + 1);
      }
    }

    showDialog(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text(
          "Xác nhận nộp bài",
          style: TextStyle(fontWeight: FontWeight.bold),
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              "Bạn có muốn nộp bài không?",
              style: TextStyle(fontSize: 15),
            ),
            if (unansweredIndices.isNotEmpty) ...[
              const SizedBox(height: 12),
              const Text(
                "Bạn chưa làm các câu sau:",
                style: TextStyle(
                  color: Colors.red,
                  fontWeight: FontWeight.bold,
                  fontSize: 14,
                ),
              ),
              const SizedBox(height: 4),
              Text(
                unansweredIndices.map((n) => "Câu $n").join(", "),
                style: const TextStyle(color: Colors.red, fontSize: 14),
              ),
            ] else ...[
              const SizedBox(height: 12),
              const Text(
                "Bạn đã hoàn thành tất cả các câu hỏi!",
                style: TextStyle(
                  color: Colors.green,
                  fontWeight: FontWeight.bold,
                  fontSize: 14,
                ),
              ),
            ]
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialogContext),
            child: const Text(
              "Quay lại",
              style: TextStyle(color: Colors.grey, fontWeight: FontWeight.bold),
            ),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFF10B981),
              foregroundColor: Colors.white,
              elevation: 0,
            ),
            onPressed: () {
              Navigator.pop(dialogContext);
              context.read<TakeExamBloc>().add(
                    SubmitExamEvent(submissionId: widget.submissionId),
                  );
            },
            child: const Text(
              "Xác nhận nộp",
              style: TextStyle(fontWeight: FontWeight.bold),
            ),
          ),
        ],
      ),
    );
  }

  void _showQuestionMenu(TakeExamState state) {
    showGeneralDialog(
      context: context,
      barrierDismissible: true,
      barrierLabel: "QuestionMenu",
      transitionDuration: const Duration(milliseconds: 300),
      pageBuilder: (context, animation, secondaryAnimation) {
        return Align(
          alignment: Alignment.centerLeft,
          child: Material(
            color: Colors.transparent,
            child: Container(
              width: MediaQuery.of(context).size.width * 0.7,
              height: double.infinity,
              padding: EdgeInsets.fromLTRB(20, MediaQuery.of(context).padding.top + 20, 20, 20),
              decoration: BoxDecoration(
                color: _isDarkMode ? const Color(0xFF1E293B) : Colors.white,
                boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.2), blurRadius: 15)],
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        "Danh sách câu hỏi",
                        style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: _isDarkMode ? Colors.white : Colors.black),
                      ),
                      CupertinoButton(
                        padding: EdgeInsets.zero,
                        onPressed: () => Navigator.pop(context),
                        child: Icon(CupertinoIcons.xmark, size: 20, color: _isDarkMode ? Colors.grey.shade400 : CupertinoColors.systemGrey),
                      ),
                    ],
                  ),
                  const SizedBox(height: 20),
                  Expanded(
                    child: GridView.builder(
                      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                        crossAxisCount: 4,
                        mainAxisSpacing: 8,
                        crossAxisSpacing: 8,
                      ),
                      itemCount: state.questions.length,
                      itemBuilder: (context, index) {
                        int qNum = index + 1;
                        final q = state.questions[index];
                        final qId = q['question_id']?.toString() ?? '';
                        bool isDone = state.localAnswers.containsKey(qId);

                        return GestureDetector(
                          onTap: () {
                            Navigator.pop(context);
                            if (index < _keys.length && _keys[index].currentContext != null) {
                              Scrollable.ensureVisible(
                                _keys[index].currentContext!,
                                duration: const Duration(milliseconds: 500),
                                curve: Curves.easeInOut,
                              );
                            }
                          },
                          child: Container(
                            decoration: BoxDecoration(
                              color: isDone
                                  ? const Color(0xFFD1FAE5)
                                  : (_isDarkMode ? const Color(0xFF334155) : const Color(0xFFF3F4F6)),
                              borderRadius: BorderRadius.circular(8),
                              border: Border.all(
                                color: isDone ? const Color(0xFF10B981) : Colors.transparent,
                                width: 0.5,
                              ),
                            ),
                            child: Center(
                              child: Text(
                                "$qNum",
                                style: TextStyle(
                                  color: isDone ? const Color(0xFF065F46) : (_isDarkMode ? Colors.grey.shade300 : Colors.black54),
                                  fontWeight: FontWeight.bold,
                                  fontSize: 14,
                                ),
                              ),
                            ),
                          ),
                        );
                      },
                    ),
                  ),
                ],
              ),
            ),
          ),
        );
      },
      transitionBuilder: (context, animation, secondaryAnimation, child) {
        return SlideTransition(
          position: Tween<Offset>(
            begin: const Offset(-1, 0),
            end: Offset.zero,
          ).animate(CurvedAnimation(parent: animation, curve: Curves.easeOutQuad)),
          child: child,
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final Color bgColor = _isDarkMode ? const Color(0xFF0F172A) : const Color(0xFFF8FAFC);
    final Color cardColor = _isDarkMode ? const Color(0xFF1E293B) : Colors.white;
    final Color textColor = _isDarkMode ? Colors.white : const Color(0xFF1E293B);

    return BlocConsumer<TakeExamBloc, TakeExamState>(
      listener: (context, state) {
        if (state.errorMessage != null && state.errorMessage != _lastShownError) {
          _lastShownError = state.errorMessage;
          ScaffoldMessenger.of(context).hideCurrentSnackBar();
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(state.errorMessage!),
              backgroundColor: Colors.red.shade700,
              duration: const Duration(seconds: 4),
            ),
          );
        } else if (state.errorMessage == null) {
          if (_lastShownError != null) {
            _lastShownError = null;
            ScaffoldMessenger.of(context).hideCurrentSnackBar();
          }
        }

        if (state.showResultModal) {
          _showResultOverlayModal(context, state);
        }
        if (state.examData != null && _secondsLeftNotifier.value == 3600) {
          final startedAtStr = state.examData!['started_at'];
          final durationMinutes = state.examData!['duration_minutes'] ?? 60;
          if (startedAtStr != null) {
            final startTime = DateTime.tryParse(startedAtStr) ?? DateTime.now();
            final now = DateTime.now();
            final elapsed = now.difference(startTime).inSeconds;
            _secondsLeftNotifier.value = (durationMinutes * 60) - elapsed;
            if (_secondsLeftNotifier.value <= 0) _secondsLeftNotifier.value = 0;
          } else {
            _secondsLeftNotifier.value = durationMinutes * 60;
          }
        }
      },
      builder: (context, state) {
        if (state.isLoading) {
          return Scaffold(
            backgroundColor: bgColor,
            body: const Center(
              child: CircularProgressIndicator(
                strokeWidth: 3,
                valueColor: AlwaysStoppedAnimation<Color>(Color(0xFF2563EB)),
              ),
            ),
          );
        }

        if (state.isBlurred) {
          return Scaffold(
            backgroundColor: Colors.black,
            body: Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const Icon(
                    Icons.warning_amber_rounded,
                    color: Colors.amberAccent,
                    size: 72,
                  ),
                  const SizedBox(height: 16),
                  const Text(
                    'PHÁT HIỆN HÀNH VI CHỤP MÀN HÌNH!',
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      color: Colors.white,
                      fontSize: 18,
                      fontWeight: FontWeight.w900,
                      letterSpacing: 0.5,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    'Bạn đã vi phạm quy định thi. Vui lòng không tái phạm.',
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      color: Colors.grey.shade400,
                      fontSize: 13,
                    ),
                  ),
                ],
              ),
            ),
          );
        }

        final examTitle = state.examData?['exam_title'] ?? 'Bài thi';
        final totalQuestions = state.questions.length;
        final answeredQuestions = state.localAnswers.length;

        if (_keys.length != totalQuestions) {
          _keys.clear();
          for (int i = 0; i < totalQuestions; i++) {
            _keys.add(GlobalKey());
          }
        }

        Color pingDotColor = const Color(0xFF16A34A);
        if (state.connectionStatus == 'yellow') {
          pingDotColor = const Color(0xFFD97706);
        } else if (state.connectionStatus == 'red') {
          pingDotColor = const Color(0xFFDC2626);
        }

        return Stack(
          children: [
            Listener(
              onPointerDown: (_) => _resetInactivityTimer(),
              child: Scaffold(
                backgroundColor: bgColor,
                appBar: AppBar(
                  automaticallyImplyLeading: false,
                  backgroundColor: cardColor,
                  elevation: 0.5,
                  titleSpacing: 0,
                  leadingWidth: 140,
                  leading: Row(
                    children: [
                      const SizedBox(width: 12),
                      Image.asset('assets/images/Logo.png', width: 22, height: 22, fit: BoxFit.contain),
                      const SizedBox(width: 6),
                      Expanded(
                        child: Text(
                          examTitle,
                          style: TextStyle(color: textColor, fontSize: 13, fontWeight: FontWeight.bold),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                    ],
                  ),
                  centerTitle: true,
                  title: ValueListenableBuilder<int>(
                    valueListenable: _secondsLeftNotifier,
                    builder: (context, secondsLeft, child) {
                      int minutes = secondsLeft ~/ 60;
                      int seconds = secondsLeft % 60;
                      return Row(
                        mainAxisSize: MainAxisSize.min,
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Container(
                            width: 8,
                            height: 8,
                            decoration: BoxDecoration(
                              color: pingDotColor,
                              shape: BoxShape.circle,
                            ),
                          ),
                          const SizedBox(width: 6),
                          Text(
                            "${minutes.toString().padLeft(2, '0')}:${seconds.toString().padLeft(2, '0')}",
                            style: TextStyle(
                              color: pingDotColor,
                              fontSize: 18,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                        ],
                      );
                    },
                  ),
                  actions: [
                    CupertinoButton(
                      padding: EdgeInsets.zero,
                      onPressed: () => _showQuestionMenu(state),
                      child: Icon(CupertinoIcons.list_bullet, size: 16, color: _isDarkMode ? Colors.white : Colors.black87),
                    ),
                    CupertinoButton(
                      padding: EdgeInsets.zero,
                      onPressed: () => setState(() => _isDarkMode = !_isDarkMode),
                      child: Icon(
                        _isDarkMode ? CupertinoIcons.sun_max_fill : CupertinoIcons.moon_fill,
                        size: 16,
                        color: _isDarkMode ? Colors.amber : Colors.black87,
                      ),
                    ),
                    const SizedBox(width: 4),
                    GestureDetector(
                      onTap: state.isSubmitting
                          ? null
                          : () => _confirmSubmission(context, state),
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 5),
                        decoration: BoxDecoration(
                          color: const Color(0xFF10B981),
                          borderRadius: BorderRadius.circular(6),
                        ),
                        child: const Text(
                          "Nộp bài",
                          style: TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.bold),
                        ),
                      ),
                    ),
                    const SizedBox(width: 12),
                  ],
                ),
                body: GestureDetector(
                  onTap: () => FocusScope.of(context).unfocus(),
                  child: ListView.builder(
                    cacheExtent: 9999,
                    keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
                    itemCount: totalQuestions == 0 ? 1 : (totalQuestions + (state.violations > 0 ? 2 : 1)),
                    itemBuilder: (context, idx) {
                      if (idx == 0) {
                        // Progress Bar
                        return Container(
                          padding: const EdgeInsets.symmetric(vertical: 8),
                          child: Row(
                            children: [
                              Expanded(
                                child: ClipRRect(
                                  borderRadius: BorderRadius.circular(4),
                                  child: LinearProgressIndicator(
                                    value: totalQuestions > 0 ? answeredQuestions / totalQuestions : 0,
                                    backgroundColor: _isDarkMode ? const Color(0xFF334155) : const Color(0xFFE2E8F0),
                                    valueColor: const AlwaysStoppedAnimation<Color>(Color(0xFF2563EB)),
                                    minHeight: 4,
                                  ),
                                ),
                              ),
                              const SizedBox(width: 12),
                              Text(
                                "$answeredQuestions/$totalQuestions đã làm",
                                style: TextStyle(color: _isDarkMode ? Colors.grey : const Color(0xFF64748B), fontSize: 12, fontWeight: FontWeight.bold),
                              ),
                            ],
                          ),
                        );
                      }

                      if (state.violations > 0 && idx == 1) {
                        // High visibility cheating violation alert
                        return Container(
                          margin: const EdgeInsets.only(top: 12, bottom: 4),
                          padding: const EdgeInsets.all(12),
                          decoration: BoxDecoration(
                            color: const Color(0xFFFEF2F2),
                            borderRadius: BorderRadius.circular(12),
                            border: Border.all(color: const Color(0xFFFECACA)),
                          ),
                          child: Row(
                            children: [
                              const Icon(Icons.warning_amber_rounded, color: Color(0xFFDC2626), size: 18),
                              const SizedBox(width: 8),
                              Expanded(
                                child: Text(
                                  'Bạn đã vi phạm quy chế ${state.violations}/10 lần. Quá 10 lần bài thi sẽ tự động nộp.',
                                  style: const TextStyle(color: Color(0xFF991B1B), fontSize: 13, fontWeight: FontWeight.bold),
                                ),
                              ),
                            ],
                          ),
                        );
                      }

                      if (totalQuestions == 0) {
                        return const Padding(
                          padding: EdgeInsets.only(top: 40),
                          child: Center(
                            child: Text("Không tìm thấy câu hỏi trong đề thi."),
                          ),
                        );
                      }

                      // Adjust the index for questions
                      final qIdx = idx - (state.violations > 0 ? 2 : 1);
                      if (qIdx < 0 || qIdx >= totalQuestions) {
                        return const SizedBox.shrink();
                      }

                      final q = state.questions[qIdx];
                      final qId = q['question_id']?.toString() ?? '';
                      final qText = q['question_text'] ?? '';
                      final qType = q['type'] ?? 'MCQ';
                      final points = q['points'] ?? 1.0;
                      final options = q['options'] ?? [];
                      final isAnswered = state.localAnswers.containsKey(qId);
                      final currentAnswer = state.localAnswers[qId];

                      return Container(
                        key: _keys[qIdx],
                        margin: const EdgeInsets.only(top: 12, bottom: 16),
                        padding: const EdgeInsets.all(16),
                        decoration: BoxDecoration(
                          color: cardColor,
                          borderRadius: BorderRadius.circular(16),
                          boxShadow: [
                            BoxShadow(color: Colors.black.withOpacity(0.01), blurRadius: 10),
                          ],
                          border: Border.all(
                            color: isAnswered ? const Color(0xFFDBEAFE) : (_isDarkMode ? const Color(0xFF334155) : const Color(0xFFE2E8F0)),
                            width: 1.5,
                          ),
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              children: [
                                Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                                  decoration: BoxDecoration(
                                    color: const Color(0xFF2563EB),
                                    borderRadius: BorderRadius.circular(8),
                                  ),
                                  child: Text(
                                    "${qIdx + 1}",
                                    style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 13),
                                  ),
                                ),
                                const SizedBox(width: 8),
                                Text(
                                  "CÂU HỎI ${qIdx + 1}",
                                  style: const TextStyle(color: Color(0xFF2563EB), fontSize: 11, fontWeight: FontWeight.bold),
                                ),
                                const SizedBox(width: 8),
                                Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                  decoration: BoxDecoration(
                                    color: _isDarkMode ? const Color(0xFF334155) : const Color(0xFFF1F5F9),
                                    borderRadius: BorderRadius.circular(4),
                                  ),
                                  child: Text(
                                    qType == 'MCQ' ? 'TRẮC NGHIỆM' : 'TỰ LUẬN',
                                    style: TextStyle(color: _isDarkMode ? Colors.grey.shade300 : const Color(0xFF64748B), fontSize: 9, fontWeight: FontWeight.bold),
                                  ),
                                ),
                                const Spacer(),
                                Text(
                                  "$points Điểm",
                                  style: TextStyle(color: _isDarkMode ? Colors.grey.shade400 : const Color(0xFF64748B), fontSize: 11, fontWeight: FontWeight.bold),
                                ),
                              ],
                            ),
                            const SizedBox(height: 12),
                            Text(
                              qText,
                              style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: textColor, height: 1.4),
                            ),
                            const SizedBox(height: 16),

                            if (qType == 'MCQ') ...[
                              ...options.asMap().entries.map((optEntry) {
                                int optIdx = optEntry.key;
                                final opt = optEntry.value;
                                final optId = opt['option_id'];
                                final optText = opt['option_text'] ?? '';
                                String letter = String.fromCharCode(65 + optIdx); // A, B, C, D
                                bool isSelected = currentAnswer == optId;

                                return Container(
                                  margin: const EdgeInsets.only(bottom: 8),
                                  child: CupertinoButton(
                                    padding: EdgeInsets.zero,
                                    onPressed: () {
                                      context.read<TakeExamBloc>().add(
                                            SaveAnswerEvent(
                                              submissionId: widget.submissionId,
                                              questionId: qId,
                                              answer: optId,
                                            ),
                                          );
                                    },
                                    child: Container(
                                      padding: const EdgeInsets.all(12),
                                      decoration: BoxDecoration(
                                        color: isSelected ? const Color(0xFF2563EB).withOpacity(0.05) : cardColor,
                                        borderRadius: BorderRadius.circular(10),
                                        border: Border.all(
                                          color: isSelected ? const Color(0xFF2563EB) : (_isDarkMode ? const Color(0xFF475569) : const Color(0xFFE2E8F0)),
                                          width: isSelected ? 1.5 : 1,
                                        ),
                                      ),
                                      child: Row(
                                        children: [
                                          Container(
                                            width: 24,
                                            height: 24,
                                            decoration: BoxDecoration(
                                              color: isSelected ? const Color(0xFF2563EB) : (_isDarkMode ? const Color(0xFF334155) : const Color(0xFFF1F5F9)),
                                              borderRadius: BorderRadius.circular(6),
                                            ),
                                            child: Center(
                                              child: Text(
                                                letter,
                                                style: TextStyle(
                                                  color: isSelected ? Colors.white : (_isDarkMode ? Colors.grey.shade300 : Colors.black54),
                                                  fontSize: 11,
                                                  fontWeight: FontWeight.bold,
                                                ),
                                              ),
                                            ),
                                          ),
                                          const SizedBox(width: 12),
                                          Expanded(
                                            child: Text(
                                              optText,
                                              style: TextStyle(
                                                color: isSelected ? const Color(0xFF2563EB) : textColor,
                                                fontWeight: isSelected ? FontWeight.w600 : FontWeight.w500,
                                                fontSize: 14,
                                              ),
                                            ),
                                          ),
                                        ],
                                      ),
                                    ),
                                  ),
                                );
                              }),
                            ] else ...[
                              TextFormField(
                                initialValue: currentAnswer ?? '',
                                maxLines: 4,
                                decoration: InputDecoration(
                                  hintText: 'Nhập câu trả lời tự luận của bạn...',
                                  hintStyle: TextStyle(color: Colors.grey.shade400, fontSize: 13),
                                  filled: true,
                                  fillColor: _isDarkMode ? const Color(0xFF334155) : const Color(0xFFF8FAFC),
                                  border: OutlineInputBorder(
                                    borderRadius: BorderRadius.circular(8),
                                    borderSide: BorderSide(color: _isDarkMode ? Colors.transparent : const Color(0xFFE2E8F0)),
                                  ),
                                  enabledBorder: OutlineInputBorder(
                                    borderRadius: BorderRadius.circular(8),
                                    borderSide: BorderSide(color: _isDarkMode ? Colors.transparent : const Color(0xFFE2E8F0)),
                                  ),
                                  focusedBorder: OutlineInputBorder(
                                    borderRadius: BorderRadius.circular(8),
                                    borderSide: const BorderSide(color: Color(0xFF2563EB)),
                                  ),
                                ),
                                style: TextStyle(fontSize: 13, color: textColor),
                                onChanged: (val) {
                                  context.read<TakeExamBloc>().add(
                                        SaveAnswerEvent(
                                          submissionId: widget.submissionId,
                                          questionId: qId,
                                          answer: val,
                                        ),
                                      );
                                },
                              ),
                            ],
                          ],
                        ),
                      );
                    },
                  ),
                ),
              ),
            ),
            if (_showBlurOverlay)
              Positioned.fill(
                child: BackdropFilter(
                  filter: ImageFilter.blur(sigmaX: 10, sigmaY: 10),
                  child: Container(
                    color: Colors.black.withOpacity(0.5),
                    child: const Center(
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(Icons.lock, size: 64, color: Colors.white),
                          SizedBox(height: 16),
                          Text(
                            'Ứng dụng đang tạm thời bị khóa',
                            style: TextStyle(
                              color: Colors.white,
                              fontSize: 18,
                              fontWeight: FontWeight.bold,
                              decoration: TextDecoration.none,
                            ),
                          ),
                          SizedBox(height: 8),
                          Text(
                            'Vui lòng quay lại màn hình thi để tiếp tục',
                            style: TextStyle(
                              color: Colors.white70,
                              fontSize: 14,
                              decoration: TextDecoration.none,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              ),
          ],
        );
      },
    );
  }
}
