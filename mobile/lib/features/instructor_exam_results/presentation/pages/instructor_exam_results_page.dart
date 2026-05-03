import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import 'package:excel/excel.dart' hide Border;
import 'package:path_provider/path_provider.dart';
import 'package:share_plus/share_plus.dart';

import '../bloc/exam_results_bloc.dart';
import '../bloc/exam_results_event.dart';
import '../bloc/exam_results_state.dart';
import '../../domain/entities/exam_result_entity.dart';

class InstructorExamResultsPage extends StatefulWidget {
  final String? initialExamId;
  const InstructorExamResultsPage({super.key, this.initialExamId});

  @override
  State<InstructorExamResultsPage> createState() =>
      _InstructorExamResultsPageState();
}

class _InstructorExamResultsPageState extends State<InstructorExamResultsPage> {
  final TextEditingController _searchController = TextEditingController();

  @override
  void initState() {
    super.initState();
    context.read<ExamResultsBloc>().add(
      LoadExamsEvent(initialExamId: widget.initialExamId),
    );
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  void _showFilterSheet(BuildContext context, ExamResultsLoaded state) {
    final bloc = context.read<ExamResultsBloc>();
    showModalBottomSheet(
      context: context,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (sheetContext) {
        return Padding(
          padding: const EdgeInsets.all(20),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                "Lọc trạng thái",
                style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 16),
              Wrap(
                spacing: 10,
                children: [
                  _filterChip('all', 'Tất cả', state.statusFilter, bloc),
                  _filterChip('confirmed', 'Đã chốt', state.statusFilter, bloc),
                  _filterChip('graded', 'Chờ duyệt', state.statusFilter, bloc),
                  _filterChip('pending', 'Chưa chấm', state.statusFilter, bloc),
                ],
              ),
              const SizedBox(height: 20),
            ],
          ),
        );
      },
    );
  }

  Widget _filterChip(
    String value,
    String label,
    String currentStatus,
    ExamResultsBloc bloc,
  ) {
    final isSelected = value == currentStatus;
    return ChoiceChip(
      label: Text(label),
      selected: isSelected,
      onSelected: (selected) {
        if (selected) {
          bloc.add(StatusFilterChangedEvent(value));
          Navigator.pop(context);
        }
      },
    );
  }

  Future<void> _exportExcel(ExamResultsLoaded state) async {
    try {
      final excel = Excel.createExcel();
      final sheet = excel['Results'];
      excel.setDefaultSheet('Results');

      // Headers
      sheet.appendRow([
        TextCellValue('Student'),
        TextCellValue('Student ID'),
        TextCellValue('Submission ID'),
        TextCellValue('MCQ'),
        TextCellValue('Essay (AI)'),
        TextCellValue('Suggested'),
        TextCellValue('Final'),
        TextCellValue('Status'),
      ]);

      // Data
      for (var r in state.filteredResults) {
        sheet.appendRow([
          TextCellValue(r.studentName ?? ''),
          TextCellValue(r.studentId ?? ''),
          TextCellValue(r.submissionId ?? ''),
          TextCellValue(r.mcqScore?.toString() ?? ''),
          TextCellValue(r.aiScore?.toString() ?? ''),
          TextCellValue(r.suggestedTotalScore?.toString() ?? ''),
          TextCellValue(r.finalScore?.toString() ?? ''),
          TextCellValue(r.status ?? ''),
        ]);
      }

      final fileBytes = excel.save();
      if (fileBytes != null) {
        final directory = await getApplicationDocumentsDirectory();
        final path =
            '${directory.path}/ExamResults_${state.selectedExamId}.xlsx';
        final file = File(path);
        await file.writeAsBytes(fileBytes);

        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Xuất Excel thành công!')),
          );
          Share.shareXFiles([XFile(path)], text: 'Kết quả bài thi');
        }
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text('Lỗi xuất Excel: $e')));
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.grey[50],
      appBar: AppBar(
        title: BlocBuilder<ExamResultsBloc, ExamResultsState>(
          builder: (context, state) {
            if (state is ExamResultsLoaded && state.exams.isNotEmpty) {
              return DropdownButtonHideUnderline(
                child: DropdownButton<String>(
                  value: state.selectedExamId,
                  isExpanded: true,
                  icon: const Icon(
                    Icons.arrow_drop_down,
                    color: Colors.black87,
                  ),
                  onChanged: (String? newValue) {
                    if (newValue != null) {
                      context.read<ExamResultsBloc>().add(
                        SelectExamEvent(newValue),
                      );
                    }
                  },
                  items: state.exams.map<DropdownMenuItem<String>>((
                    Map<String, dynamic> exam,
                  ) {
                    return DropdownMenuItem<String>(
                      value: exam['id'].toString(),
                      child: Text(
                        exam['title'] ?? 'Exam ${exam['id']}',
                        style: const TextStyle(
                          color: Colors.black87,
                          fontWeight: FontWeight.bold,
                          fontSize: 16,
                        ),
                        overflow: TextOverflow.ellipsis,
                      ),
                    );
                  }).toList(),
                ),
              );
            }
            return const Text(
              "Kết quả bài thi",
              style: TextStyle(color: Colors.black87, fontSize: 16),
            );
          },
        ),
        backgroundColor: Colors.white,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, color: Colors.black87),
          onPressed: () => context.pop(),
        ),
        actions: [
          BlocBuilder<ExamResultsBloc, ExamResultsState>(
            builder: (context, state) {
              if (state is ExamResultsLoaded) {
                return Row(
                  children: [
                    IconButton(
                      icon: const Icon(Icons.download, color: Colors.green),
                      onPressed: () => _exportExcel(state),
                      tooltip: "Xuất Excel",
                    ),
                    IconButton(
                      icon: const Icon(Icons.filter_list, color: Colors.blue),
                      onPressed: () => _showFilterSheet(context, state),
                    ),
                  ],
                );
              }
              return const SizedBox.shrink();
            },
          ),
        ],
      ),
      body: BlocBuilder<ExamResultsBloc, ExamResultsState>(
        builder: (context, state) {
          if (state is ExamResultsLoading) {
            return const Center(child: CircularProgressIndicator());
          }

          if (state is ExamResultsError) {
            return Center(
              child: Text(
                state.message,
                style: const TextStyle(color: Colors.red),
              ),
            );
          }

          if (state is ExamResultsLoaded) {
            return Column(
              children: [
                // Summary Grid
                if (state.summary != null)
                  Padding(
                    padding: const EdgeInsets.all(16.0),
                    child: Column(
                      children: [
                        GridView.count(
                          crossAxisCount: 2,
                          shrinkWrap: true,
                          physics: const NeverScrollableScrollPhysics(),
                          crossAxisSpacing: 10,
                          mainAxisSpacing: 10,
                          childAspectRatio: 1.8,
                          children: [
                            _summaryCard(
                              "Tổng số / Đã nộp",
                              "${state.summary!.totalStudents} / ${state.summary!.submittedCount}",
                              Colors.blue,
                            ),
                            _summaryCard(
                              "Gian lận",
                              "${state.summary!.totalViolations}",
                              Colors.red,
                            ),
                            _summaryCard(
                              "Tỉ lệ đạt",
                              "${state.summary!.passingRate}%",
                              Colors.green,
                            ),
                            _summaryCard(
                              "Điểm TB",
                              state.summary!.avgScore.toStringAsFixed(1),
                              Colors.orange,
                            ),
                          ],
                        ),
                        const SizedBox(height: 12),
                        SizedBox(
                          width: double.infinity,
                          child: ElevatedButton.icon(
                            onPressed: () => _showApproveAllDialog(
                              context,
                              state.selectedExamId!,
                            ),
                            icon: const Icon(
                              Icons.check_circle_outline,
                              size: 20,
                            ),
                            label: const Text(
                              "Duyệt tất cả điểm",
                              style: TextStyle(
                                fontWeight: FontWeight.bold,
                                fontSize: 15,
                              ),
                            ),
                            style: ElevatedButton.styleFrom(
                              backgroundColor: const Color(
                                0xFF00B16A,
                              ), // Match web green
                              foregroundColor: Colors.white,
                              padding: const EdgeInsets.symmetric(vertical: 14),
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(12),
                              ),
                              elevation: 2,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),

                // Search Box
                Padding(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 16.0,
                    vertical: 8.0,
                  ),
                  child: TextField(
                    controller: _searchController,
                    onChanged: (value) => context.read<ExamResultsBloc>().add(
                      SearchQueryChangedEvent(value),
                    ),
                    decoration: InputDecoration(
                      hintText: "Tìm sinh viên...",
                      prefixIcon: const Icon(
                        Icons.search,
                        color: Colors.blueAccent,
                      ),
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(12),
                        borderSide: BorderSide.none,
                      ),
                      contentPadding: const EdgeInsets.symmetric(vertical: 0),
                      filled: true,
                      fillColor: Colors.white,
                      enabledBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(12),
                        borderSide: BorderSide(color: Colors.grey[200]!),
                      ),
                      focusedBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(12),
                        borderSide: const BorderSide(
                          color: Colors.blueAccent,
                          width: 1.5,
                        ),
                      ),
                    ),
                  ),
                ),

                // List
                Expanded(
                  child: RefreshIndicator(
                    onRefresh: () async {
                      if (state.selectedExamId != null) {
                        context.read<ExamResultsBloc>().add(SelectExamEvent(state.selectedExamId!));
                      }
                    },
                    child: state.filteredResults.isEmpty
                        ? ListView(
                            physics: const AlwaysScrollableScrollPhysics(),
                            children: [
                              SizedBox(
                                height: MediaQuery.of(context).size.height * 0.5,
                                child: const Center(child: Text("Không có dữ liệu")),
                              ),
                            ],
                          )
                        : ListView.builder(
                            physics: const AlwaysScrollableScrollPhysics(),
                            padding: const EdgeInsets.all(16),
                            itemCount: state.filteredResults.length,
                            itemBuilder: (context, index) {
                              final result = state.filteredResults[index];
                              return _buildResultCard(context, result);
                            },
                          ),
                  ),
                ),
              ],
            );
          }

          return const SizedBox.shrink();
        },
      ),
    );
  }

  Widget _summaryCard(String title, String value, Color color) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: color.withOpacity(0.08),
            blurRadius: 15,
            offset: const Offset(0, 4),
          ),
        ],
        border: Border.all(color: color.withOpacity(0.1), width: 1.5),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(
            title,
            style: TextStyle(
              color: Colors.blueGrey[600],
              fontSize: 13,
              fontWeight: FontWeight.w500,
            ),
          ),
          Row(
            mainAxisAlignment: MainAxisAlignment.end,
            children: [
              Text(
                value,
                style: TextStyle(
                  color: color,
                  fontSize: 24,
                  fontWeight: FontWeight.w800,
                  letterSpacing: -0.5,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildResultCard(BuildContext context, ExamResultEntity result) {
    Color statusColor = Colors.orange;
    String statusText = result.status?.toLowerCase() ?? 'pending';
    String displayStatus = 'Chờ duyệt';

    if (statusText == 'confirmed' || statusText == 'graded') {
      statusColor = Colors.green;
      displayStatus = 'Đã duyệt';
    } else if (statusText == 'pending' || statusText == 'submitted') {
      statusColor = Colors.orange;
      displayStatus = 'Chờ duyệt';
    } else {
      displayStatus = statusText.toUpperCase();
    }

    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      elevation: 1,
      child: InkWell(
        onLongPress: () => _showDeleteDialog(context, result),
        onTap: () {
          // Mở Detail Page
          final blocState = context.read<ExamResultsBloc>().state;
          if (blocState is ExamResultsLoaded) {
            final examId = blocState.selectedExamId;
            final bloc = context.read<ExamResultsBloc>();
            context
                .push(
                  '/instructor/exam-results/detail',
                  extra: {'result': result, 'examId': examId ?? ''},
                )
                .then((_) {
                  if (examId != null) {
                    bloc.add(SelectExamEvent(examId));
                  }
                });
          }
        },
        borderRadius: BorderRadius.circular(12),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Expanded(
                    child: Text(
                      result.studentName ?? 'Unknown',
                      style: const TextStyle(
                        fontWeight: FontWeight.bold,
                        fontSize: 16,
                      ),
                    ),
                  ),
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 8,
                      vertical: 4,
                    ),
                    decoration: BoxDecoration(
                      color: statusColor.withOpacity(0.1),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Text(
                      displayStatus.toUpperCase(),
                      style: TextStyle(
                        color: statusColor,
                        fontSize: 10,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  IconButton(
                    constraints: const BoxConstraints(),
                    padding: EdgeInsets.zero,
                    icon: const Icon(Icons.delete_outline, color: Colors.red),
                    onPressed: () => _showDeleteDialog(context, result),
                    tooltip: "Xóa bài thi",
                  ),
                ],
              ),
              const SizedBox(height: 4),
              Text(
                result.studentId ?? 'No ID',
                style: TextStyle(color: Colors.grey[600], fontSize: 12),
              ),
              const Divider(height: 20),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  _scoreItem("MCQ", result.mcqScore?.toString() ?? '-'),
                  _scoreItem("AI Tự luận", result.aiScore?.toString() ?? '-'),
                  _scoreItem(
                    "Tổng",
                    (result.finalScore ?? result.suggestedTotalScore)
                            ?.toString() ??
                        '-',
                    isBold: true,
                  ),
                ],
              ),
              if ((result.cheatingCount ?? 0) > 0)
                Padding(
                  padding: const EdgeInsets.only(top: 12.0),
                  child: Row(
                    children: [
                      const Icon(Icons.warning, color: Colors.red, size: 16),
                      const SizedBox(width: 4),
                      Text(
                        "${result.cheatingCount} vi phạm gian lận",
                        style: const TextStyle(color: Colors.red, fontSize: 12),
                      ),
                    ],
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }

  void _showDeleteDialog(BuildContext context, ExamResultEntity result) {
    final blocState = context.read<ExamResultsBloc>().state;
    if (blocState is! ExamResultsLoaded) return;
    final examId = blocState.selectedExamId;
    if (examId == null || result.studentId == null) return;

    showDialog(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text("Xóa bài thi?"),
        content: Text(
          "Bạn có chắc chắn muốn xóa bài thi của sinh viên \"${result.studentName ?? result.studentId}\" không? Hành động này không thể hoàn tác!",
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialogContext),
            child: const Text("Hủy"),
          ),
          TextButton(
            onPressed: () {
              context.read<ExamResultsBloc>().add(
                DeleteSubmissionEvent(
                  examId: examId,
                  studentId: result.studentId!,
                ),
              );
              Navigator.pop(dialogContext);
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(content: Text("Đang xóa bài thi của sinh viên...")),
              );
            },
            child: const Text(
              "Xóa ngay",
              style: TextStyle(
                color: Colors.red,
                fontWeight: FontWeight.bold,
              ),
            ),
          ),
        ],
      ),
    );
  }


  Widget _scoreItem(String label, String value, {bool isBold = false}) {
    return Column(
      children: [
        Text(label, style: TextStyle(color: Colors.grey[600], fontSize: 12)),
        const SizedBox(height: 4),
        Text(
          value,
          style: TextStyle(
            fontSize: 16,
            fontWeight: isBold ? FontWeight.bold : FontWeight.normal,
            color: isBold ? Colors.blue : Colors.black87,
          ),
        ),
      ],
    );
  }

  void _showApproveAllDialog(BuildContext context, String examId) {
    final bloc = context.read<ExamResultsBloc>();
    showDialog(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text("Duyệt tất cả?"),
        content: const Text(
          "Hành động này sẽ chốt điểm cho toàn bộ sinh viên trong bài thi này. Bạn có chắc chắn không?",
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialogContext),
            child: const Text("Hủy"),
          ),
          TextButton(
            onPressed: () {
              bloc.add(ApproveAllScoresEvent(examId));
              Navigator.pop(dialogContext);
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(content: Text("Đang xử lý duyệt toàn bộ...")),
              );
            },
            child: const Text(
              "Duyệt ngay",
              style: TextStyle(
                color: Colors.green,
                fontWeight: FontWeight.bold,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
