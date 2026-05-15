import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';
import 'package:video_player/video_player.dart';
import 'package:dio/dio.dart';
import '../../../../core/network/dio_client.dart';
import '../../data/datasources/exam_results_remote_datasource.dart';
import '../../domain/entities/exam_result_entity.dart';
import '../../domain/entities/exam_cheating_log_entity.dart';
import '../../domain/entities/exam_answer_entity.dart';
import 'package:flutter_widget_from_html/flutter_widget_from_html.dart';
import '../../../../core/utils/violation_dictionary.dart';

const violationMap = {
  'copy_attempt': 'Cố tình sao chép (Copy)',
  'paste_attempt': 'Cố tình dán (Paste)',
  'drag_drop_in': 'Kéo thả tài liệu vào',
  'screenshot_attempt': 'Chụp màn hình',
  'blocked_key': 'Nhấn phím cấm (Alt/Tab/Esc...)',
  'visibility_hidden': 'Chuyển tab/Ẩn trình duyệt',
  'fullscreen_lost': 'Thoát toàn màn hình',
  'window_blur': 'Chuyển cửa sổ (Mất Focus)',
  'tab_switch': 'Chuyển Tab',
  'alt_tab': 'Nhấn phím tắt Alt+Tab',
  'multiple_faces': 'Phát hiện nhiều khuôn mặt',
  'no_face_detected': 'Không thấy khuôn mặt',
  'inactivity': 'Không hoạt động quá lâu',
  'split_screen': 'Chia đôi màn hình',
  'ai_detected_cheating': 'AI phát hiện gian lận',
  'devtools_attempt': 'Mở công cụ lập trình viên',
  'multi_monitor_attempt': 'Sử dụng nhiều màn hình',
  'mouse_outside': 'Chuột ra ngoài vùng thi',
  'typing_speed_violation': 'Tốc độ gõ bất thường',
  'screen_share_stopped': 'Dừng chia sẻ màn hình',
  'prolonged_away': 'Rời khỏi camera quá lâu',
};

class ResultDetailPage extends StatefulWidget {
  final ExamResultEntity result;
  final String examId;
  const ResultDetailPage({
    super.key,
    required this.result,
    required this.examId,
  });

  @override
  State<ResultDetailPage> createState() => _ResultDetailPageState();
}

class _ResultDetailPageState extends State<ResultDetailPage>
    with SingleTickerProviderStateMixin {
  late TabController _tabController;
  late ExamResultsRemoteDataSource _dataSource;
  late ExamResultEntity _currentResult;

  List<ExamCheatingLogEntity> _logs = [];
  List<ExamAnswerEntity> _answers = [];
  bool _isLoading = true;
  bool _isSavingAll = false;

  @override
  void initState() {
    super.initState();
    _currentResult = widget.result;
    _tabController = TabController(length: 3, vsync: this);
    _dataSource = ExamResultsRemoteDataSource(DioClient());
    _loadData();

    _tabController.addListener(() {
      if (mounted) setState(() {});
    });
  }

  Future<void> _loadData() async {
    final subId = _currentResult.submissionId;
    if (subId == null) {
      setState(() => _isLoading = false);
      return;
    }

    try {
      final logs = await _dataSource.getCheatingLogs(subId);
      final answers = await _dataSource.getSubmissionAnswers(subId);

      setState(() {
        _logs = logs;
        _answers = answers;
        _isLoading = false;
      });
    } catch (e) {
      setState(() => _isLoading = false);
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text("Lỗi tải dữ liệu: $e")));
      }
    }
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.grey[50],
      appBar: AppBar(
        title: Text(
          _currentResult.studentName ?? 'Chi tiết bài làm',
          style: const TextStyle(
            color: Colors.black87,
            fontSize: 18,
            fontWeight: FontWeight.bold,
          ),
        ),
        backgroundColor: Colors.white,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, color: Colors.black87),
          onPressed: () => context.pop(),
        ),
        bottom: TabBar(
          controller: _tabController,
          labelColor: Colors.blue[700],
          unselectedLabelColor: Colors.grey[500],
          indicatorColor: Colors.blue[700],
          indicatorWeight: 3,
          labelStyle: const TextStyle(fontWeight: FontWeight.bold),
          tabs: const [
            Tab(text: "Tổng quan"),
            Tab(text: "Gian lận"),
            Tab(text: "Chấm điểm"),
          ],
        ),
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : TabBarView(
              controller: _tabController,
              children: [
                _buildOverviewTab(),
                _buildCheatingTab(),
                _buildGradingTab(),
              ],
            ),
      bottomNavigationBar: _tabController.index == 2 ? _buildBottomBar() : null,
    );
  }

  Widget _buildBottomBar() {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.05),
            blurRadius: 10,
            offset: const Offset(0, -4),
          ),
        ],
      ),
      child: SafeArea(
        child: SizedBox(
          width: double.infinity,
          child: ElevatedButton.icon(
            onPressed: _isSavingAll ? null : _saveAndConfirmAll,
            icon: _isSavingAll
                ? const SizedBox(
                    width: 20,
                    height: 20,
                    child: CircularProgressIndicator(
                      strokeWidth: 2,
                      color: Colors.white,
                    ),
                  )
                : const Icon(Icons.check_circle),
            label: const Text(
              "Lưu & Xác nhận",
              style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
            ),
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(
                0xFF1E293B,
              ), // Dark slate like Image 3
              foregroundColor: Colors.white,
              padding: const EdgeInsets.symmetric(vertical: 16),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(12),
              ),
              elevation: 0,
            ),
          ),
        ),
      ),
    );
  }

  Future<void> _saveAndConfirmAll() async {
    setState(() => _isSavingAll = true);
    try {
      final perQuestionScores = _answers
          .map(
            (q) => {
              'answer_id': q.answer?.id,
              'score': q.answer?.score ?? 0,
              'feedback': q.answer?.feedback ?? '',
            },
          )
          .toList();

      await _dataSource.confirmGrading(
        examId: widget.examId,
        studentId: _currentResult.studentId ?? '',
        mcqScore: _currentResult.totalScore ?? 0,
        aiScore: _currentResult.aiScore ?? 0,
        perQuestionScores: perQuestionScores,
        submissionId: _currentResult.submissionId,
      );

      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text(
            "Đã lưu và duyệt bài thi thành công!",
            style: TextStyle(color: Colors.white),
          ),
          backgroundColor: Colors.green,
        ),
      );

      await _loadData();
      setState(() {
        _isSavingAll = false;
        _currentResult = _currentResult.copyWith(
          status: 'confirmed',
        ); // Optimistic update
      });
    } catch (e) {
      setState(() => _isSavingAll = false);
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text("Lỗi: $e")));
    }
  }

  Widget _buildOverviewTab() {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _infoCard("Thông tin thí sinh", Icons.person, Colors.blue, [
            _rowItem("Họ tên", _currentResult.studentName ?? '-'),
            _rowItem("Mã SV", _currentResult.studentId ?? '-'),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  "Trạng thái",
                  style: TextStyle(color: Colors.grey[600], fontSize: 14),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 10,
                    vertical: 4,
                  ),
                  decoration: BoxDecoration(
                    color:
                        (_currentResult.status == 'confirmed' ||
                            _currentResult.status == 'graded')
                        ? Colors.green[50]
                        : Colors.orange[50],
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(
                      color:
                          (_currentResult.status == 'confirmed' ||
                              _currentResult.status == 'graded')
                          ? Colors.green[200]!
                          : Colors.orange[200]!,
                    ),
                  ),
                  child: Text(
                    (_currentResult.status == 'confirmed' ||
                            _currentResult.status == 'graded')
                        ? "ĐÃ DUYỆT"
                        : "CHỜ DUYỆT",
                    style: TextStyle(
                      color:
                          (_currentResult.status == 'confirmed' ||
                              _currentResult.status == 'graded')
                          ? Colors.green[700]
                          : Colors.orange[700],
                      fontSize: 11,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ),
              ],
            ),
          ]),
          const SizedBox(height: 16),
          _infoCard("Thời gian làm bài", Icons.access_time, Colors.green, [
            _rowItem("Bắt đầu", _currentResult.startedAt ?? '-'),
            _rowItem("Nộp bài", _currentResult.submittedAt ?? '-'),
            _rowItem(
              "Thời lượng",
              "${_currentResult.durationMinutes ?? 0} phút",
              isBold: true,
              color: Colors.purple[700],
            ),
          ]),
          const SizedBox(height: 16),
          _infoCard("Điểm số", Icons.star, Colors.amber[700]!, [
            _rowItem(
              "MCQ",
              _currentResult.totalScore?.toString() ?? '-',
              onEdit: () =>
                  _showEditScoreDialog("MCQ", _currentResult.totalScore ?? 0),
            ),
            _rowItem(
              "Tự luận (AI)",
              _currentResult.aiScore?.toString() ?? '-',
              onEdit: () =>
                  _showEditScoreDialog("Essay", _currentResult.aiScore ?? 0),
            ),
            _rowItem(
              "Gợi ý",
              _currentResult.suggestedTotalScore?.toString() ?? '-',
            ),
            const Divider(height: 24),
            _rowItem(
              "Chính thức",
              _currentResult.suggestedTotalScore?.toString() ?? '-',
              isBold: true,
              color: Colors.blue[700],
              size: 20,
              onEdit: () => _showEditScoreDialog(
                "Total",
                _currentResult.suggestedTotalScore ?? 0,
              ),
            ),
          ]),
          const SizedBox(height: 16),
          _infoCard("ẢNH XÁC THỰC", Icons.camera_alt, Colors.blueGrey[700]!, [
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        "Khuôn mặt",
                        style: TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.bold,
                          color: Colors.black54,
                        ),
                      ),
                      const SizedBox(height: 8),
                      SizedBox(
                        height: 140,
                        width: double.infinity,
                        child: _currentResult.hasFaceImage
                            ? _AuthenticatedImage(
                                path:
                                    "/instructor/submissions/${_currentResult.submissionId}/face-image",
                              )
                            : Container(
                                decoration: BoxDecoration(
                                  color: Colors.grey[100],
                                  borderRadius: BorderRadius.circular(8),
                                ),
                                child: const Center(
                                  child: Text(
                                    "Không có ảnh",
                                    style: TextStyle(
                                      fontSize: 12,
                                      color: Colors.grey,
                                    ),
                                  ),
                                ),
                              ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        "Thẻ sinh viên",
                        style: TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.bold,
                          color: Colors.black54,
                        ),
                      ),
                      const SizedBox(height: 8),
                      SizedBox(
                        height: 140,
                        width: double.infinity,
                        child: _currentResult.hasStudentCard
                            ? _AuthenticatedImage(
                                path:
                                    "/instructor/submissions/${_currentResult.submissionId}/student-card",
                              )
                            : Container(
                                decoration: BoxDecoration(
                                  color: Colors.grey[100],
                                  borderRadius: BorderRadius.circular(8),
                                ),
                                child: const Center(
                                  child: Text(
                                    "Không có ảnh",
                                    style: TextStyle(
                                      fontSize: 12,
                                      color: Colors.grey,
                                    ),
                                  ),
                                ),
                              ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ]),
        ],
      ),
    );
  }

  Widget _infoCard(
    String title,
    IconData icon,
    Color iconColor,
    List<Widget> children,
  ) {
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Colors.grey[200]!),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.02),
            blurRadius: 10,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: iconColor.withOpacity(0.1),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Icon(icon, color: iconColor, size: 20),
              ),
              const SizedBox(width: 12),
              Text(
                title,
                style: const TextStyle(
                  fontWeight: FontWeight.w700,
                  fontSize: 16,
                  color: Colors.black87,
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          ...children,
        ],
      ),
    );
  }

  Widget _rowItem(
    String label,
    String value, {
    bool isBold = false,
    Color? color,
    double? size,
    VoidCallback? onEdit,
  }) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12.0),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Row(
            children: [
              Text(
                label,
                style: TextStyle(color: Colors.grey[600], fontSize: 14),
              ),
              if (onEdit != null) ...[
                const SizedBox(width: 4),
                IconButton(
                  onPressed: onEdit,
                  icon: const Icon(
                    Icons.edit,
                    size: 14,
                    color: Colors.blueAccent,
                  ),
                  padding: EdgeInsets.zero,
                  constraints: const BoxConstraints(),
                  visualDensity: VisualDensity.compact,
                ),
              ],
            ],
          ),
          Text(
            value,
            style: TextStyle(
              fontWeight: isBold ? FontWeight.bold : FontWeight.w600,
              color: color ?? Colors.black87,
              fontSize: size ?? 14,
            ),
          ),
        ],
      ),
    );
  }

  void _showEditScoreDialog(String type, num currentScore) {
    final controller = TextEditingController(text: currentScore.toString());
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: Text("Sửa điểm $type"),
        content: TextField(
          controller: controller,
          keyboardType: const TextInputType.numberWithOptions(decimal: true),
          decoration: const InputDecoration(labelText: "Điểm mới"),
          autofocus: true,
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text("Hủy"),
          ),
          TextButton(
            onPressed: () async {
              final newScore = num.tryParse(controller.text);
              if (newScore != null) {
                Navigator.pop(context);
                await _updateOverviewScore(type, newScore);
              }
            },
            child: const Text(
              "Lưu",
              style: TextStyle(fontWeight: FontWeight.bold),
            ),
          ),
        ],
      ),
    );
  }

  Future<void> _updateOverviewScore(String type, num newScore) async {
    try {
      num mcq = _currentResult.totalScore ?? 0;
      num essay = _currentResult.aiScore ?? 0;

      if (type == "MCQ") {
        mcq = newScore;
      } else if (type == "Essay")
        essay = newScore;

      await _dataSource.confirmGrading(
        examId: widget.examId,
        studentId: _currentResult.studentId ?? '',
        mcqScore: mcq,
        aiScore: essay,
        perQuestionScores: [],
        submissionId: _currentResult.submissionId,
      );

      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text("Cập nhật điểm thành công!")),
      );
      _loadData();
    } catch (e) {
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text("Lỗi: $e")));
    }
  }

  Widget _buildCheatingTab() {
    if (_logs.isEmpty) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              Icons.check_circle_outline,
              size: 64,
              color: Colors.green[400],
            ),
            const SizedBox(height: 16),
            Text(
              "Không có hành vi gian lận",
              style: TextStyle(color: Colors.grey[600], fontSize: 16),
            ),
          ],
        ),
      );
    }

    return Column(
      children: [
        const Padding(
          padding: EdgeInsets.fromLTRB(16.0, 16.0, 16.0, 8.0),
          child: Row(
            children: [
              Text(
                "CHI TIẾT TỪNG LẦN VI PHẠM",
                style: TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.bold,
                  color: Colors.grey,
                  letterSpacing: 1.2,
                ),
              ),
            ],
          ),
        ),
        Expanded(
          child: ListView.builder(
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 0),
            itemCount: _logs.length,
            itemBuilder: (context, index) {
              final log = _logs[index];
              final translatedType = ViolationDictionary.getDynamicViolationTitle(
                log.eventType ?? '',
                keyId: log.keyId,
              );
              final severityColor = log.severity == 'high'
                  ? Colors.red
                  : (log.severity == 'low'
                        ? Colors.yellow[700]!
                        : Colors.orange);

              return Container(
                margin: const EdgeInsets.only(bottom: 16),
                decoration: BoxDecoration(
                  color: severityColor.withOpacity(0.05),
                  border: Border.all(color: severityColor.withOpacity(0.3)),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Row(
                            children: [
                              Icon(
                                log.severity == 'high'
                                    ? Icons.error_outline
                                    : Icons.warning_amber_rounded,
                                color: severityColor,
                                size: 20,
                              ),
                              const SizedBox(width: 8),
                              Text(
                                translatedType,
                                style: TextStyle(
                                  fontWeight: FontWeight.bold,
                                  fontSize: 16,
                                  color: severityColor,
                                ),
                              ),
                            ],
                          ),
                          Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 10,
                              vertical: 4,
                            ),
                            decoration: BoxDecoration(
                              color: severityColor.withOpacity(0.1),
                              borderRadius: BorderRadius.circular(20),
                              border: Border.all(
                                color: severityColor.withOpacity(0.3),
                              ),
                            ),
                            child: Text(
                              log.severity?.toUpperCase() ?? '',
                              style: TextStyle(
                                fontSize: 10,
                                fontWeight: FontWeight.bold,
                                color: severityColor,
                              ),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 12),
                      Container(
                        padding: const EdgeInsets.all(12),
                        width: double.infinity,
                        decoration: BoxDecoration(
                          color: Colors.grey[50],
                          borderRadius: BorderRadius.circular(8),
                          border: Border.all(color: Colors.grey[200]!),
                        ),
                        child: Text(
                          ViolationDictionary.getDynamicViolationReason(
                            log.eventType ?? '',
                            keyId: log.keyId,
                            defaultMsg: log.message ?? log.eventDetails ?? 'Không có chi tiết vi phạm',
                          ),
                          style: TextStyle(
                            fontSize: 14,
                            color: Colors.blueGrey[800],
                            height: 1.4,
                          ),
                        ),
                      ),
                      const SizedBox(height: 12),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Text(
                            log.recordedAt ?? '',
                            style: TextStyle(
                              color: Colors.grey[600],
                              fontSize: 12,
                            ),
                          ),
                          _VideoPlayButton(
                            submissionId: widget.result.submissionId!,
                            snapshotId: log.snapshotId,
                            dataSource: _dataSource,
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              );
            },
          ),
        ),
        // Full Video Footer
        Container(
          margin: const EdgeInsets.all(16),
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            gradient: LinearGradient(
              colors: [Colors.indigo[800]!, Colors.indigo[600]!],
            ),
            borderRadius: BorderRadius.circular(16),
            boxShadow: [
              BoxShadow(
                color: Colors.indigo.withOpacity(0.3),
                blurRadius: 10,
                offset: const Offset(0, 4),
              ),
            ],
          ),
          child: Row(
            children: [
              Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: Colors.white.withOpacity(0.2),
                  shape: BoxShape.circle,
                ),
                child: const Icon(
                  Icons.movie_filter,
                  color: Colors.white,
                  size: 24,
                ),
              ),
              const SizedBox(width: 16),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      "Video tổng hợp bằng chứng",
                      style: TextStyle(
                        color: Colors.white,
                        fontWeight: FontWeight.bold,
                        fontSize: 16,
                      ),
                    ),
                    Text(
                      "Ghép nối tất cả ${_logs.length} lần vi phạm",
                      style: TextStyle(
                        color: Colors.white.withOpacity(0.8),
                        fontSize: 12,
                      ),
                    ),
                  ],
                ),
              ),
              _VideoPlayButton(
                submissionId: widget.result.submissionId!,
                snapshotId: null, // Null means full video merge
                dataSource: _dataSource,
                isFullVideo: true,
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildGradingTab() {
    if (_answers.isEmpty) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.description_outlined, size: 64, color: Colors.grey[400]),
            const SizedBox(height: 16),
            Text(
              "Không có câu hỏi/câu trả lời",
              style: TextStyle(color: Colors.grey[600], fontSize: 16),
            ),
          ],
        ),
      );
    }

    return ListView.builder(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 100),
      itemCount: _answers.length,
      itemBuilder: (context, index) {
        final q = _answers[index];
        final isMcq = q.type?.toUpperCase() == 'MCQ';

        return _GradingCard(
          question: q,
          index: index + 1,
          isMcq: isMcq,
          onSave: (score, feedback) async {
            try {
              if (q.answer?.id != null) {
                await _dataSource.updateStudentScore(
                  submissionId: _currentResult.submissionId!,
                  answerId: q.answer!.id!,
                  score: score,
                  feedback: feedback,
                );
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(
                    content: Text(
                      "Đã lưu điểm câu này!",
                      style: TextStyle(color: Colors.white),
                    ),
                    backgroundColor: Colors.green,
                  ),
                );

                // Update local state score to avoid jumping
                setState(() {
                  _answers[index] = q.copyWith(
                    answer: q.answer?.copyWith(
                      score: score,
                      feedback: feedback,
                    ),
                  );
                });
              }
            } catch (e) {
              ScaffoldMessenger.of(context).showSnackBar(
                SnackBar(content: Text("Lỗi: $e"), backgroundColor: Colors.red),
              );
            }
          },
        );
      },
    );
  }
}

class _VideoPlayButton extends StatefulWidget {
  final String submissionId;
  final String? snapshotId;
  final ExamResultsRemoteDataSource dataSource;
  final bool isFullVideo;
  const _VideoPlayButton({
    required this.submissionId,
    this.snapshotId,
    required this.dataSource,
    this.isFullVideo = false,
  });

  @override
  State<_VideoPlayButton> createState() => _VideoPlayButtonState();
}

class _VideoPlayButtonState extends State<_VideoPlayButton> {
  bool _isLoading = false;
  @override
  Widget build(BuildContext context) {
    final themeColor = widget.isFullVideo ? Colors.white : Colors.purple[700]!;
    final bgColor = widget.isFullVideo
        ? Colors.white.withOpacity(0.2)
        : Colors.purple[50];

    return InkWell(
      onTap: _isLoading
          ? null
          : () async {
              setState(() => _isLoading = true);
              try {
                final url = await widget.dataSource.getViolationVideoUrl(
                  widget.submissionId,
                  snapshotId: widget.snapshotId,
                );
                if (mounted) {
                  setState(() => _isLoading = false);
                  if (url != null) {
                    _showVideoDialog(context, url);
                  } else {
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(
                        content: Text("Không có video cho vi phạm này"),
                      ),
                    );
                  }
                }
              } catch (e) {
                if (mounted) {
                  setState(() => _isLoading = false);
                  ScaffoldMessenger.of(
                    context,
                  ).showSnackBar(SnackBar(content: Text("Lỗi tải video: $e")));
                }
              }
            },
      borderRadius: BorderRadius.circular(8),
      child: Container(
        padding: EdgeInsets.symmetric(
          horizontal: widget.isFullVideo ? 16 : 8,
          vertical: widget.isFullVideo ? 10 : 4,
        ),
        decoration: BoxDecoration(
          color: bgColor,
          borderRadius: BorderRadius.circular(8),
          border: widget.isFullVideo
              ? Border.all(color: Colors.white.withOpacity(0.5))
              : null,
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            _isLoading
                ? SizedBox(
                    width: 14,
                    height: 14,
                    child: CircularProgressIndicator(
                      strokeWidth: 2,
                      color: themeColor,
                    ),
                  )
                : Icon(
                    Icons.play_circle_fill,
                    size: widget.isFullVideo ? 20 : 16,
                    color: themeColor,
                  ),
            const SizedBox(width: 6),
            Text(
              widget.isFullVideo ? "Xem ngay" : "Xem đoạn này",
              style: TextStyle(
                color: themeColor,
                fontSize: widget.isFullVideo ? 14 : 12,
                fontWeight: FontWeight.bold,
              ),
            ),
          ],
        ),
      ),
    );
  }

  void _showVideoDialog(BuildContext context, String urlPath) {
    // Get the base URL from DioClient (e.g., https://api.oes.io.vn/api)
    final baseUrl = DioClient().dio.options.baseUrl;

    // Remove /api from the end and combine with urlPath safely
    // Safely extract the origin (scheme + host + port) from baseUrl
    final uri = Uri.parse(baseUrl);
    String host = uri.origin;

    if (urlPath.startsWith('/')) urlPath = urlPath.substring(1);

    final fullUrl = "$host/$urlPath";
    print("🎬 Playing video at: $fullUrl");

    showDialog(
      context: context,
      builder: (context) => _VideoPlayerDialog(videoUrl: fullUrl),
    );
  }
}

class _VideoPlayerDialog extends StatefulWidget {
  final String videoUrl;
  const _VideoPlayerDialog({required this.videoUrl});
  @override
  State<_VideoPlayerDialog> createState() => _VideoPlayerDialogState();
}

class _VideoPlayerDialogState extends State<_VideoPlayerDialog> {
  late VideoPlayerController _controller;
  bool _initialized = false;
  bool _error = false;

  @override
  void initState() {
    super.initState();
    // Force landscape mode for video playback
    SystemChrome.setPreferredOrientations([
      DeviceOrientation.landscapeLeft,
      DeviceOrientation.landscapeRight,
    ]);
    _controller =
        VideoPlayerController.networkUrl(
            Uri.parse(widget.videoUrl),
            httpHeaders: {
              'User-Agent':
                  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
              'Referer': 'https://oes.io.vn/',
            },
          )
          ..initialize()
              .then((_) {
                if (mounted) {
                  setState(() => _initialized = true);
                  _controller.play();
                }
              })
              .catchError((e) {
                debugPrint("❌ VideoPlayer Error: $e");
                if (mounted) setState(() => _error = true);
              });
  }

  @override
  void dispose() {
    // Reset to default orientations
    SystemChrome.setPreferredOrientations([
      DeviceOrientation.portraitUp,
      DeviceOrientation.portraitDown,
      DeviceOrientation.landscapeLeft,
      DeviceOrientation.landscapeRight,
    ]);
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Dialog(
      backgroundColor: Colors.black,
      insetPadding: const EdgeInsets.all(10),
      child: Stack(
        alignment: Alignment.center,
        children: [
          if (_error)
            const Text(
              "Không thể phát video",
              style: TextStyle(color: Colors.white),
            ),
          if (!_initialized && !_error)
            const CircularProgressIndicator(color: Colors.purple),
          if (_initialized)
            AspectRatio(
              aspectRatio: _controller.value.aspectRatio,
              child: VideoPlayer(_controller),
            ),
          if (_initialized)
            GestureDetector(
              onTap: () => setState(
                () => _controller.value.isPlaying
                    ? _controller.pause()
                    : _controller.play(),
              ),
              child: Container(
                color: Colors.transparent,
                child: Center(
                  child: Icon(
                    _controller.value.isPlaying
                        ? Icons.pause
                        : Icons.play_arrow,
                    color: Colors.white.withOpacity(0.5),
                    size: 64,
                  ),
                ),
              ),
            ),
          Positioned(
            top: 10,
            right: 10,
            child: IconButton(
              icon: const Icon(Icons.close, color: Colors.white),
              onPressed: () => context.pop(),
            ),
          ),
        ],
      ),
    );
  }
}

class _GradingCard extends StatefulWidget {
  final ExamAnswerEntity question;
  final int index;
  final bool isMcq;
  final Function(num score, String feedback) onSave;
  const _GradingCard({
    required this.question,
    required this.index,
    required this.isMcq,
    required this.onSave,
  });

  @override
  State<_GradingCard> createState() => _GradingCardState();
}

class _GradingCardState extends State<_GradingCard> {
  late TextEditingController _scoreController;
  late TextEditingController _feedbackController;

  @override
  void initState() {
    super.initState();
    _scoreController = TextEditingController(
      text: widget.question.answer?.score?.toString() ?? '0',
    );
    _feedbackController = TextEditingController(
      text: widget.question.answer?.feedback ?? '',
    );
  }

  @override
  void dispose() {
    _scoreController.dispose();
    _feedbackController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Colors.grey[200]!),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.02),
            blurRadius: 10,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: 32,
                height: 32,
                decoration: BoxDecoration(
                  color: Colors.indigo[50],
                  shape: BoxShape.circle,
                ),
                alignment: Alignment.center,
                child: Text(
                  widget.index.toString(),
                  style: TextStyle(
                    fontWeight: FontWeight.bold,
                    color: Colors.indigo[700],
                  ),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 8,
                            vertical: 2,
                          ),
                          decoration: BoxDecoration(
                            color: widget.isMcq
                                ? Colors.blue[50]
                                : Colors.purple[50],
                            borderRadius: BorderRadius.circular(4),
                          ),
                          child: Text(
                            widget.isMcq ? "Trắc nghiệm" : "Tự luận",
                            style: TextStyle(
                              fontSize: 11,
                              fontWeight: FontWeight.bold,
                              color: widget.isMcq
                                  ? Colors.blue[700]
                                  : Colors.purple[700],
                            ),
                          ),
                        ),
                        const SizedBox(width: 8),
                        Text(
                          "${widget.question.points ?? 1} điểm",
                          style: TextStyle(
                            color: Colors.grey[500],
                            fontSize: 11,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 8),
                    HtmlWidget(
                      widget.question.text ?? 'Không có nội dung câu hỏi',
                      textStyle: const TextStyle(fontWeight: FontWeight.w500),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          Padding(
            padding: const EdgeInsets.only(left: 44),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  "Câu trả lời:",
                  style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.bold,
                    color: Colors.black54,
                  ),
                ),
                const SizedBox(height: 8),
                if (widget.isMcq)
                  _buildMcqOptions()
                else
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: Colors.grey[50],
                      border: Border.all(color: Colors.grey[200]!),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: HtmlWidget(
                      widget.question.answer?.studentAnswer ??
                          'Không có câu trả lời',
                    ),
                  ),
                if (!widget.isMcq && widget.question.modelAnswer != null) ...[
                  const SizedBox(height: 12),
                  Row(
                    children: [
                      Container(
                        width: 8,
                        height: 8,
                        decoration: const BoxDecoration(
                          color: Colors.green,
                          shape: BoxShape.circle,
                        ),
                      ),
                      const SizedBox(width: 6),
                      const Text(
                        "Đáp án mẫu:",
                        style: TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.bold,
                          color: Colors.green,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 4),
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: Colors.green[50],
                      border: Border.all(color: Colors.green[100]!),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: HtmlWidget(widget.question.modelAnswer!),
                  ),
                ],
                if (!widget.isMcq &&
                    widget.question.answer?.aiFeedback != null) ...[
                  const SizedBox(height: 16),
                  _buildAiReasoning(widget.question.answer!.aiFeedback!),
                ],
                if (!widget.isMcq) ...[
                  const SizedBox(height: 20),
                  Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: Colors.indigo[50]!.withOpacity(0.3),
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: Colors.indigo[100]!),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            const Icon(
                              Icons.edit_note,
                              size: 20,
                              color: Colors.indigo,
                            ),
                            const SizedBox(width: 8),
                            const Text(
                              "CHẤM ĐIỂM CÂU NÀY",
                              style: TextStyle(
                                fontWeight: FontWeight.bold,
                                fontSize: 13,
                                color: Colors.indigo,
                              ),
                            ),
                            const Spacer(),
                            if (widget.question.answer?.score != null)
                              Text(
                                "AI: ${widget.question.answer!.score}/${widget.question.points}",
                                style: TextStyle(
                                  color: Colors.grey[600],
                                  fontSize: 12,
                                  fontWeight: FontWeight.bold,
                                ),
                              ),
                          ],
                        ),
                        const SizedBox(height: 16),
                        Row(
                          children: [
                            Expanded(
                              child: TextField(
                                controller: _scoreController,
                                keyboardType:
                                    const TextInputType.numberWithOptions(
                                      decimal: true,
                                    ),
                                decoration: InputDecoration(
                                  labelText: "Điểm chấm",
                                  border: OutlineInputBorder(
                                    borderRadius: BorderRadius.circular(8),
                                  ),
                                  contentPadding: const EdgeInsets.symmetric(
                                    horizontal: 12,
                                    vertical: 8,
                                  ),
                                  filled: true,
                                  fillColor: Colors.white,
                                ),
                              ),
                            ),
                            const SizedBox(width: 12),
                            ElevatedButton.icon(
                              onPressed: () => widget.onSave(
                                num.tryParse(_scoreController.text) ?? 0,
                                _feedbackController.text,
                              ),
                              icon: const Icon(Icons.save, size: 18),
                              label: const Text("Lưu điểm"),
                              style: ElevatedButton.styleFrom(
                                backgroundColor: Colors.indigo[600],
                                foregroundColor: Colors.white,
                                padding: const EdgeInsets.symmetric(
                                  horizontal: 16,
                                  vertical: 12,
                                ),
                                shape: RoundedRectangleBorder(
                                  borderRadius: BorderRadius.circular(8),
                                ),
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 12),
                        TextField(
                          controller: _feedbackController,
                          maxLines: 1,
                          decoration: InputDecoration(
                            hintText: "Nhận xét của GV...",
                            border: OutlineInputBorder(
                              borderRadius: BorderRadius.circular(8),
                            ),
                            contentPadding: const EdgeInsets.symmetric(
                              horizontal: 12,
                              vertical: 8,
                            ),
                            filled: true,
                            fillColor: Colors.white,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildAiReasoning(String feedback) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Colors.purple[50],
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: Colors.purple[100]!),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(Icons.psychology, size: 20, color: Colors.purple[700]),
              const SizedBox(width: 8),
              Text(
                "LÝ GIẢI CHẤM ĐIỂM (AI REASONING)",
                style: TextStyle(
                  fontWeight: FontWeight.bold,
                  fontSize: 12,
                  color: Colors.purple[700],
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          const Divider(),
          const SizedBox(height: 4),
          HtmlWidget(feedback),
        ],
      ),
    );
  }

  Widget _buildMcqOptions() {
    final options = widget.question.options as List? ?? [];
    final selectedId = widget.question.answer?.selectedOptionId;
    final hasAnswered = selectedId != null && selectedId.toString().isNotEmpty;

    return Column(
      children: options.map((opt) {
        final optId = (opt['option_id'] ?? opt['id'])?.toString();
        final isSelected = optId == selectedId;
        final isCorrect = opt['is_correct'] == 1 || opt['is_correct'] == true;

        Color bgColor = Colors.white;
        Color borderColor = Colors.grey[200]!;

        if (!hasAnswered) {
          // Bôi đỏ toàn bộ nếu sinh viên không trả lời
          bgColor = Colors.red[50]!.withOpacity(0.4);
          borderColor = Colors.red[200]!;
        } else {
          if (isSelected) {
            bgColor = isCorrect ? Colors.green[50]! : Colors.red[50]!;
            borderColor = isCorrect ? Colors.green[400]! : Colors.red[400]!;
          } else if (isCorrect) {
            bgColor = Colors.green[50]!.withOpacity(0.3);
            borderColor = Colors.green[200]!;
          }
        }

        return Container(
          margin: const EdgeInsets.only(bottom: 8),
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
          decoration: BoxDecoration(
            color: bgColor,
            border: Border.all(color: borderColor),
            borderRadius: BorderRadius.circular(8),
          ),
          child: Row(
            children: [
              Icon(
                !hasAnswered
                    ? Icons.report_problem_outlined
                    : (isSelected
                          ? (isCorrect ? Icons.check_circle : Icons.cancel)
                          : (isCorrect
                                ? Icons.check_circle_outline
                                : Icons.radio_button_unchecked)),
                size: 20,
                color: !hasAnswered
                    ? Colors.red[300]
                    : (isSelected
                          ? (isCorrect ? Colors.green : Colors.red)
                          : (isCorrect ? Colors.green[300] : Colors.grey[400])),
              ),
              const SizedBox(width: 12),
              Expanded(child: HtmlWidget(opt['option_text']?.toString() ?? '')),
              if (isSelected)
                Padding(
                  padding: const EdgeInsets.only(left: 8.0),
                  child: Text(
                    "Đã chọn",
                    style: TextStyle(
                      fontSize: 10,
                      color: isCorrect ? Colors.green[700] : Colors.red[700],
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ),
              if (!hasAnswered)
                Padding(
                  padding: const EdgeInsets.only(left: 8.0),
                  child: Text(
                    "CHƯA TRẢ LỜI",
                    style: TextStyle(
                      fontSize: 9,
                      color: Colors.red[700],
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ),
            ],
          ),
        );
      }).toList(),
    );
  }
}

class _AuthenticatedImage extends StatefulWidget {
  final String path;
  const _AuthenticatedImage({required this.path});

  @override
  State<_AuthenticatedImage> createState() => _AuthenticatedImageState();
}

class _AuthenticatedImageState extends State<_AuthenticatedImage> {
  Uint8List? _bytes;
  bool _isLoading = true;
  bool _error = false;

  @override
  void initState() {
    super.initState();
    _fetchImage();
  }

  Future<void> _fetchImage() async {
    try {
      final response = await DioClient().dio.get(
        widget.path,
        options: Options(responseType: ResponseType.bytes),
      );
      if (mounted) {
        setState(() {
          _bytes = Uint8List.fromList(response.data);
          _isLoading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _isLoading = false;
          _error = true;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoading) {
      return const Center(
        child: SizedBox(
          width: 20,
          height: 20,
          child: CircularProgressIndicator(strokeWidth: 2),
        ),
      );
    }
    if (_error || _bytes == null) {
      return Container(
        decoration: BoxDecoration(
          color: Colors.grey[100],
          borderRadius: BorderRadius.circular(8),
        ),
        child: const Center(
          child: Icon(Icons.broken_image_outlined, color: Colors.grey),
        ),
      );
    }
    return GestureDetector(
      onTap: () {
        showDialog(
          context: context,
          useSafeArea: false,
          builder: (context) => _FullScreenImageDialog(bytes: _bytes!),
        );
      },
      child: ClipRRect(
        borderRadius: BorderRadius.circular(8),
        child: Image.memory(
          _bytes!,
          fit: BoxFit.cover,
          width: double.infinity,
          height: double.infinity,
        ),
      ),
    );
  }
}

class _FullScreenImageDialog extends StatefulWidget {
  final Uint8List bytes;
  const _FullScreenImageDialog({required this.bytes});

  @override
  State<_FullScreenImageDialog> createState() => _FullScreenImageDialogState();
}

class _FullScreenImageDialogState extends State<_FullScreenImageDialog> {
  @override
  void initState() {
    super.initState();
    // Allow rotation for full screen image
    SystemChrome.setPreferredOrientations([
      DeviceOrientation.portraitUp,
      DeviceOrientation.portraitDown,
      DeviceOrientation.landscapeLeft,
      DeviceOrientation.landscapeRight,
    ]);
  }

  @override
  void dispose() {
    // Reset to portrait only (standard for the app)
    SystemChrome.setPreferredOrientations([DeviceOrientation.portraitUp]);
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      body: Stack(
        children: [
          GestureDetector(
            onTap: () => Navigator.pop(context),
            child: Container(
              color: Colors.black,
              width: double.infinity,
              height: double.infinity,
              child: InteractiveViewer(
                minScale: 0.5,
                maxScale: 4.0,
                child: Center(
                  child: Image.memory(widget.bytes, fit: BoxFit.contain),
                ),
              ),
            ),
          ),
          SafeArea(
            child: Align(
              alignment: Alignment.topRight,
              child: Padding(
                padding: const EdgeInsets.all(16.0),
                child: IconButton(
                  icon: const Icon(Icons.close, color: Colors.white, size: 32),
                  onPressed: () => Navigator.pop(context),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
