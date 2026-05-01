import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:file_picker/file_picker.dart';
import '../../../../core/utils/asset_exporter.dart';
import '../bloc/assign_exam_bloc.dart';
import '../bloc/assign_exam_event.dart';
import '../bloc/assign_exam_state.dart';
import '../widgets/upload_box_widget.dart';
import '../widgets/instruction_banner_widget.dart';
import '../widgets/summary_stats_widget.dart';
import '../widgets/question_preview_card.dart';
import '../widgets/sheet_selector_bottom_sheet.dart';

class AssignExamPage extends StatefulWidget {
  const AssignExamPage({super.key});

  @override
  State<AssignExamPage> createState() => _AssignExamPageState();
}

class _AssignExamPageState extends State<AssignExamPage> {
  final TextEditingController _titleController = TextEditingController();

  @override
  void dispose() {
    _titleController.dispose();
    super.dispose();
  }

  // Hàm mở trình chọn file của hệ thống
  Future<void> _pickFile(BuildContext context) async {
    FilePickerResult? result = await FilePicker.pickFiles(
      type: FileType.custom,
      allowedExtensions: ['xlsx', 'xls', 'docx', 'pdf'],
    );

    if (result != null && result.files.single.path != null) {
      final file = File(result.files.single.path!);
      if (!context.mounted) return;
      context.read<AssignExamBloc>().add(PickFileEvent(file));
    }
  }

  // Hàm gọi sự kiện Commit
  void _commitExam(BuildContext context) {
    if (_titleController.text.trim().isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Vui lòng nhập tên đề thi!'),
          backgroundColor: Colors.orange,
        ),
      );
      return;
    }

    // Gửi sự kiện lưu với duration ngầm định là 60 phút để Backend không báo lỗi
    context.read<AssignExamBloc>().add(
      CommitExamEvent(title: _titleController.text.trim(), duration: 60),
    );
  }

  // Hàm tải đề mẫu
  Future<void> _downloadTemplate(String fileName) async {
    try {
      await AssetExporter.exportAndShare(fileName);
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('⚠️ Lỗi tải file: $e'),
          backgroundColor: Colors.red.shade600,
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.grey.shade50,
      appBar: AppBar(
        title: const Text(
          "Tạo đề thi mới",
          style: TextStyle(fontWeight: FontWeight.bold),
        ),
        backgroundColor: Colors.white,
        elevation: 0,
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh, color: Colors.grey),
            tooltip: "Làm mới",
            onPressed: () {
              _titleController.clear();
              context.read<AssignExamBloc>().add(ResetEvent());
            },
          ),
        ],
      ),
      body: BlocConsumer<AssignExamBloc, AssignExamState>(
        listener: (context, state) {
          if (state is AssignExamError) {
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(
                content: Text('⚠️ ${state.message}'),
                backgroundColor: Colors.red.shade600,
                duration: const Duration(seconds: 4),
              ),
            );
          } else if (state is AssignExamSuccess) {
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(
                content: Text(
                  '✅ Import thành công! ID Đề thi: ${state.examId}',
                ),
                backgroundColor: Colors.green.shade600,
              ),
            );
            _titleController.clear();
            context.read<AssignExamBloc>().add(ResetEvent());
          } else if (state is AssignExamSheetSelectionRequired) {
            showModalBottomSheet(
              context: context,
              isScrollControlled: true,
              backgroundColor: Colors.transparent,
              builder: (ctx) => SheetSelectorBottomSheet(
                availableSheets: state.availableSheets,
                onSheetSelected: (sheetName) {
                  context.read<AssignExamBloc>().add(
                    SheetSelectedEvent(sheetName),
                  );
                },
              ),
            );
          }
        },
        builder: (context, state) {
          File? currentFile;
          if (state is AssignExamSheetSelectionRequired) {
            currentFile = state.file;
          }
          if (state is AssignExamPreviewReady) currentFile = state.file;

          return SingleChildScrollView(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  "Upload file Excel, Word hoặc PDF để import câu hỏi vào hệ thống",
                  style: TextStyle(color: Colors.grey),
                ),
                const SizedBox(height: 16),

                UploadBoxWidget(
                  selectedFile: currentFile,
                  onTap: () => _pickFile(context),
                ),

                // 👉 ĐOẠN MỚI THÊM VÀO: Nút Tải đề mẫu
                const SizedBox(height: 8),
                Row(
                  mainAxisAlignment: MainAxisAlignment.end,
                  children: [
                    PopupMenuButton<String>(
                      tooltip: "Chọn loại file mẫu",
                      offset: const Offset(
                        0,
                        40,
                      ), // Đẩy menu rớt xuống dưới nút
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(8),
                      ),
                      onSelected: (String fileName) =>
                          _downloadTemplate(fileName),
                      itemBuilder: (BuildContext context) =>
                          <PopupMenuEntry<String>>[
                            const PopupMenuItem<String>(
                              value: 'Mau_De_Import.xlsx',
                              child: Row(
                                children: [
                                  Icon(
                                    Icons.table_chart,
                                    color: Colors.green,
                                    size: 20,
                                  ),
                                  SizedBox(width: 12),
                                  Text(
                                    'Mẫu Excel (.xlsx)',
                                    style: TextStyle(
                                      fontWeight: FontWeight.w600,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                            const PopupMenuItem<String>(
                              value: 'WordDemo.docx',
                              child: Row(
                                children: [
                                  Icon(
                                    Icons.description,
                                    color: Colors.blue,
                                    size: 20,
                                  ),
                                  SizedBox(width: 12),
                                  Text(
                                    'Mẫu Word (.docx)',
                                    style: TextStyle(
                                      fontWeight: FontWeight.w600,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ],
                      // Giao diện cái nút bấm hiển thị bên ngoài
                      child: Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 16,
                          vertical: 8,
                        ),
                        decoration: BoxDecoration(
                          color: Colors.green.shade50,
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Icon(
                              Icons.download_rounded,
                              color: Colors.green.shade700,
                              size: 20,
                            ),
                            const SizedBox(width: 8),
                            Text(
                              "Tải đề mẫu",
                              style: TextStyle(
                                color: Colors.green.shade700,
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                            const SizedBox(width: 4),
                            Icon(
                              Icons.arrow_drop_down,
                              color: Colors.green.shade700,
                            ),
                          ],
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 16),

                // WIDGET 2: BẢNG HƯỚNG DẪN
                if (state is AssignExamInitial || state is AssignExamError)
                  const InstructionBannerWidget(),

                if (state is AssignExamInitial || state is AssignExamError)
                  const InstructionBannerWidget(),

                if (state is AssignExamLoading)
                  Padding(
                    padding: const EdgeInsets.symmetric(vertical: 40),
                    child: Center(
                      child: Column(
                        children: [
                          const CircularProgressIndicator(),
                          const SizedBox(height: 16),
                          Text(
                            state.message,
                            style: const TextStyle(
                              color: Colors.blue,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),

                if (state is AssignExamPreviewReady) ...[
                  SummaryStatsWidget(summary: state.data.summary),
                  const SizedBox(height: 16),

                  Container(
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: Colors.grey.shade200),
                    ),
                    child: ListView.builder(
                      shrinkWrap: true,
                      physics: const NeverScrollableScrollPhysics(),
                      padding: const EdgeInsets.all(12),
                      itemCount: state.data.preview.length,
                      itemBuilder: (context, index) {
                        return QuestionPreviewCard(
                          question: state.data.preview[index],
                        );
                      },
                    ),
                  ),
                  const SizedBox(height: 24),

                  if (state.data.summary.errors == 0) ...[
                    const Text(
                      "Thông tin đề thi",
                      style: TextStyle(
                        fontWeight: FontWeight.bold,
                        fontSize: 16,
                      ),
                    ),
                    const SizedBox(height: 8),

                    // 👉 Ô nhập tên đề thi hiện đã chiếm toàn bộ chiều ngang
                    TextField(
                      controller: _titleController,
                      decoration: const InputDecoration(
                        labelText: "Tên đề thi (*)",
                        border: OutlineInputBorder(),
                      ),
                    ),
                    const SizedBox(height: 16),

                    SizedBox(
                      width: double.infinity,
                      height: 50,
                      child: ElevatedButton.icon(
                        style: ElevatedButton.styleFrom(
                          backgroundColor: Colors.green.shade600,
                        ),
                        onPressed: () => _commitExam(context),
                        icon: const Icon(Icons.check, color: Colors.white),
                        label: const Text(
                          "Xác nhận & Lưu đề thi",
                          style: TextStyle(
                            fontSize: 16,
                            color: Colors.white,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ),
                    ),
                  ] else ...[
                    Container(
                      width: double.infinity,
                      padding: const EdgeInsets.all(16),
                      decoration: BoxDecoration(
                        color: Colors.red.shade50,
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: const Text(
                        "⚠️ Có câu hỏi bị lỗi. Vui lòng sửa lại định dạng file và upload lại để có thể lưu đề thi.",
                        style: TextStyle(
                          color: Colors.red,
                          fontWeight: FontWeight.bold,
                        ),
                        textAlign: TextAlign.center,
                      ),
                    ),
                  ],
                ],
              ],
            ),
          );
        },
      ),
    );
  }
}
