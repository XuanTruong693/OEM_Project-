import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import 'package:file_picker/file_picker.dart';

import '../bloc/exam_editor_bloc.dart';
import '../bloc/exam_editor_event.dart';
import '../bloc/exam_editor_state.dart';
import '../widgets/mcq_editor_card.dart';
import '../widgets/essay_editor_card.dart';
import '../widgets/confirm_delete_dialog.dart';

class ExamEditPage extends StatefulWidget {
  final String examId;
  const ExamEditPage({super.key, required this.examId});

  @override
  State<ExamEditPage> createState() => _ExamEditPageState();
}

class _ExamEditPageState extends State<ExamEditPage> {
  @override
  void initState() {
    super.initState();
    // Vừa vào trang là tải dữ liệu đề thi ngay
    context.read<ExamEditorBloc>().add(LoadExamDetailEvent(widget.examId));
  }

  // Hàm gọi thư viện chọn file native của điện thoại
  Future<void> _pickExcelFile() async {
    final result = await FilePicker.pickFiles(
      type: FileType.custom,
      allowedExtensions: ['xlsx', 'xls'],
      withData: true, // Rất quan trọng để lấy bytes truyền cho Parser
    );

    if (result != null && result.files.single.bytes != null) {
      if (mounted) {
        context.read<ExamEditorBloc>().add(
          AnalyzeExcelFileEvent(result.files.single.bytes!),
        );
      }
    }
  }

  void _showDeleteConfirmDialog(String questionId) {
    showDialog(
      context: context,
      builder: (ctx) => ConfirmDeleteDialog(
        onConfirm: () {
          context.read<ExamEditorBloc>().add(RemoveQuestionEvent(questionId));
        },
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.grey.shade50,
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0.5,
        leading: IconButton(
          icon: const Icon(Icons.close, color: Colors.black87),
          onPressed: () => context.pop(),
        ),
        title: BlocBuilder<ExamEditorBloc, ExamEditorState>(
          builder: (context, state) {
            if (state is ExamEditorLoaded) {
              final totalQs = state.exam.questions.length;
              return Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    "Chỉnh sửa đề thi",
                    style: TextStyle(
                      color: Colors.black87,
                      fontSize: 16,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  Text(
                    "ID: #${state.exam.id} • $totalQs câu hỏi",
                    style: TextStyle(color: Colors.grey.shade500, fontSize: 12),
                  ),
                ],
              );
            }
            return const Text(
              "Chỉnh sửa đề thi",
              style: TextStyle(color: Colors.black87, fontSize: 16),
            );
          },
        ),
      ),
      // Dùng BlocConsumer để vừa Build UI, vừa lắng nghe Toast (Success/Error)
      body: BlocConsumer<ExamEditorBloc, ExamEditorState>(
        listener: (context, state) {
          if (state is ExamEditorLoaded) {
            // Hiện thông báo thành công
            if (state.successMessage != null) {
              ScaffoldMessenger.of(context).showSnackBar(
                SnackBar(
                  content: Text(state.successMessage!),
                  backgroundColor: Colors.green,
                ),
              );
              // Clear message sau khi hiện để không bị lặp
              // context.read<ExamEditorBloc>().add(ClearSuccessMessageEvent()); (Nếu bạn viết event clear)
            }
          }
        },
        builder: (context, state) {
          if (state is ExamEditorLoading) {
            return const Center(child: CircularProgressIndicator());
          }
          if (state is ExamEditorError) {
            return Center(
              child: Text(
                state.message,
                style: const TextStyle(color: Colors.red),
              ),
            );
          }

          if (state is ExamEditorLoaded) {
            final exam = state.exam;
            final mcqQuestions = exam.questions
                .where((q) => q.type == 'MCQ')
                .toList();
            final essayQuestions = exam.questions
                .where((q) => q.type == 'essay')
                .toList();

            return CustomScrollView(
              slivers: [
                SliverPadding(
                  padding: const EdgeInsets.all(16.0),
                  sliver: SliverList(
                    delegate: SliverChildListDelegate([
                      // --- HEADER: TIÊU ĐỀ & UPLOAD FILE ---
                      Container(
                        padding: const EdgeInsets.all(16),
                        decoration: BoxDecoration(
                          color: Colors.blue.shade50,
                          borderRadius: BorderRadius.circular(16),
                          border: Border.all(color: Colors.blue.shade100),
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Text(
                              "📝 Tiêu đề đề thi",
                              style: TextStyle(fontWeight: FontWeight.bold),
                            ),
                            const SizedBox(height: 8),
                            TextFormField(
                              initialValue: exam.title,
                              onChanged: (val) => context
                                  .read<ExamEditorBloc>()
                                  .add(UpdateExamTitleEvent(val)),
                              decoration: InputDecoration(
                                filled: true,
                                fillColor: Colors.white,
                                border: OutlineInputBorder(
                                  borderRadius: BorderRadius.circular(8),
                                  borderSide: BorderSide.none,
                                ),
                                hintText: "Nhập tiêu đề...",
                              ),
                            ),
                            const SizedBox(height: 16),
                            SizedBox(
                              width: double.infinity,
                              child: ElevatedButton.icon(
                                style: ElevatedButton.styleFrom(
                                  backgroundColor: Colors.white,
                                  foregroundColor: Colors.blue.shade700,
                                  elevation: 0,
                                  shape: RoundedRectangleBorder(
                                    borderRadius: BorderRadius.circular(8),
                                    side: BorderSide(color: Colors.blue.shade200),
                                  ),
                                  padding: const EdgeInsets.symmetric(vertical: 12),
                                ),
                                onPressed: _pickExcelFile,
                                icon: const Icon(Icons.upload_file),
                                label: const Text("Import từ Excel"),
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 16),

                      // --- THÔNG BÁO LỖI LƯU (NẾU CÓ) ---
                      if (state.saveError != null)
                        Container(
                          width: double.infinity,
                          margin: const EdgeInsets.only(bottom: 16),
                          padding: const EdgeInsets.all(12),
                          decoration: BoxDecoration(
                            color: Colors.red.shade50,
                            borderRadius: BorderRadius.circular(8),
                            border: Border.all(color: Colors.red.shade200),
                          ),
                          child: Text(
                            state.saveError!,
                            style: TextStyle(color: Colors.red.shade700),
                          ),
                        ),

                      // --- PREVIEW EXCEL ---
                      if (state.isPreviewOpen && state.previewQuestions.isNotEmpty)
                        Container(
                          margin: const EdgeInsets.only(bottom: 16),
                          padding: const EdgeInsets.all(16),
                          decoration: BoxDecoration(
                            color: Colors.yellow.shade50,
                            borderRadius: BorderRadius.circular(12),
                            border: Border.all(color: Colors.yellow.shade400),
                          ),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              const Text(
                                "Preview: Các câu hỏi tìm được",
                                style: TextStyle(fontWeight: FontWeight.bold),
                              ),
                              if (state.previewMessage != null)
                                Padding(
                                  padding: const EdgeInsets.symmetric(
                                    vertical: 8.0,
                                  ),
                                  child: Text(
                                    state.previewMessage!,
                                    style: TextStyle(
                                      color: Colors.orange.shade800,
                                      fontSize: 13,
                                    ),
                                  ),
                                ),
                              const SizedBox(height: 8),
                              // List thu gọn
                              SizedBox(
                                height: 250,
                                child: ListView.builder(
                                  itemCount: state.previewQuestions.length,
                                  itemBuilder: (ctx, i) {
                                    final q = state.previewQuestions[i];
                                    final isSelected = state.selectedPreviewIds
                                        .contains(q.id);
                                    return CheckboxListTile(
                                      title: Text(
                                        q.content,
                                        maxLines: 2,
                                        overflow: TextOverflow.ellipsis,
                                        style: const TextStyle(fontSize: 13),
                                      ),
                                      subtitle: Text(
                                        "Điểm: ${q.points} | ${q.type == 'MCQ' ? 'Trắc nghiệm' : 'Tự luận'}",
                                        style: const TextStyle(fontSize: 12),
                                      ),
                                      value: isSelected,
                                      onChanged: (_) => context
                                          .read<ExamEditorBloc>()
                                          .add(TogglePreviewSelectionEvent(q.id)),
                                    );
                                  },
                                ),
                              ),
                              Row(
                                mainAxisAlignment: MainAxisAlignment.end,
                                children: [
                                  TextButton(
                                    onPressed: () => context
                                        .read<ExamEditorBloc>()
                                        .add(CancelPreviewEvent()),
                                    child: const Text("Hủy"),
                                  ),
                                  ElevatedButton(
                                    onPressed: () => context
                                        .read<ExamEditorBloc>()
                                        .add(AddSelectedPreviewQuestionsEvent()),
                                    style: ElevatedButton.styleFrom(
                                      backgroundColor: Colors.green,
                                    ),
                                    child: const Text("Thêm vào đề"),
                                  ),
                                ],
                              ),
                            ],
                          ),
                        ),

                      // --- TIÊU ĐỀ MCQ ---
                      if (mcqQuestions.isNotEmpty)
                        Padding(
                          padding: const EdgeInsets.only(bottom: 16),
                          child: Text(
                            "📝 Phần trắc nghiệm (${mcqQuestions.length} câu)",
                            style: const TextStyle(
                              fontSize: 18,
                              fontWeight: FontWeight.bold,
                              color: Colors.blue,
                            ),
                          ),
                        ),
                    ]),
                  ),
                ),

                // --- DANH SÁCH MCQ (LAZY LOADED) ---
                if (mcqQuestions.isNotEmpty)
                  SliverPadding(
                    padding: const EdgeInsets.symmetric(horizontal: 16),
                    sliver: SliverList(
                      delegate: SliverChildBuilderDelegate(
                        (context, index) {
                          final q = mcqQuestions[index];
                          return McqEditorCard(
                            key: ValueKey(q.id), // Rất quan trọng để Flutter không nhầm lẫn khi recycle widget
                            index: index + 1,
                            question: q,
                            errors: state.validationErrors[q.id] ?? [],
                            onDelete: () => _showDeleteConfirmDialog(q.id),
                          );
                        },
                        childCount: mcqQuestions.length,
                      ),
                    ),
                  ),

                SliverToBoxAdapter(
                  child: Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 16),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        TextButton.icon(
                          onPressed: () => context.read<ExamEditorBloc>().add(
                                AddQuestionEvent('MCQ'),
                              ),
                          icon: const Icon(Icons.add),
                          label: const Text("Thêm câu trắc nghiệm"),
                        ),
                        const SizedBox(height: 24),

                        // --- DANH SÁCH ESSAY HEADER ---
                        if (essayQuestions.isNotEmpty)
                          Padding(
                            padding: const EdgeInsets.only(bottom: 16),
                            child: Text(
                              "✏️ Phần tự luận (${essayQuestions.length} câu)",
                              style: const TextStyle(
                                fontSize: 18,
                                fontWeight: FontWeight.bold,
                                color: Colors.purple,
                              ),
                            ),
                          ),
                      ],
                    ),
                  ),
                ),

                // --- DANH SÁCH ESSAY (LAZY LOADED) ---
                if (essayQuestions.isNotEmpty)
                  SliverPadding(
                    padding: const EdgeInsets.symmetric(horizontal: 16),
                    sliver: SliverList(
                      delegate: SliverChildBuilderDelegate(
                        (context, index) {
                          final q = essayQuestions[index];
                          return EssayEditorCard(
                            key: ValueKey(q.id),
                            index: mcqQuestions.length + index + 1,
                            question: q,
                            errors: state.validationErrors[q.id] ?? [],
                            onDelete: () => _showDeleteConfirmDialog(q.id),
                          );
                        },
                        childCount: essayQuestions.length,
                      ),
                    ),
                  ),

                SliverPadding(
                  padding: const EdgeInsets.fromLTRB(16, 0, 16, 40),
                  sliver: SliverList(
                    delegate: SliverChildListDelegate([
                      TextButton.icon(
                        onPressed: () => context.read<ExamEditorBloc>().add(
                              AddQuestionEvent('essay'),
                            ),
                        icon: const Icon(Icons.add, color: Colors.purple),
                        label: const Text(
                          "Thêm câu tự luận",
                          style: TextStyle(color: Colors.purple),
                        ),
                      ),
                      const SizedBox(height: 40),

                      // --- ACTION BUTTONS ---
                      Row(
                        children: [
                          Expanded(
                            child: OutlinedButton(
                              onPressed: () => context.pop(),
                              style: OutlinedButton.styleFrom(
                                padding: const EdgeInsets.symmetric(vertical: 16),
                              ),
                              child: const Text(
                                "Hủy",
                                style: TextStyle(fontSize: 16),
                              ),
                            ),
                          ),
                          const SizedBox(width: 16),
                          Expanded(
                            child: ElevatedButton(
                              onPressed: state.isSaving
                                  ? null
                                  : () => context.read<ExamEditorBloc>().add(
                                        SaveExamEvent(),
                                      ),
                              style: ElevatedButton.styleFrom(
                                padding: const EdgeInsets.symmetric(vertical: 16),
                              ),
                              child: state.isSaving
                                  ? const SizedBox(
                                      width: 20,
                                      height: 20,
                                      child: CircularProgressIndicator(
                                        color: Colors.white,
                                        strokeWidth: 2,
                                      ),
                                    )
                                  : const Text(
                                      "Lưu thay đổi",
                                      style: TextStyle(fontSize: 16),
                                    ),
                            ),
                          ),
                        ],
                      ),
                    ]),
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
}
