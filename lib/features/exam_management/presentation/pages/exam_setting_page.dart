import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import '../../domain/entities/exam_setting_entity.dart';
import '../bloc/exam_setting_bloc.dart';
import '../bloc/exam_setting_event.dart';
import '../bloc/exam_setting_state.dart';
import '../widgets/setting/section_heading.dart';
import '../widgets/setting/labeled_toggle.dart';
import '../widgets/setting/datetime_picker_field.dart';

class ExamSettingPage extends StatefulWidget {
  final int examId;

  const ExamSettingPage({super.key, required this.examId});

  @override
  State<ExamSettingPage> createState() => _ExamSettingPageState();
}

class _ExamSettingPageState extends State<ExamSettingPage> {
  // 1. Local State cho Form (giống useState trong React)
  int duration = 60;
  int durationMinutes = 60;
  DateTime timeOpen = DateTime.now().add(const Duration(minutes: 5));
  DateTime timeClose = DateTime.now().add(const Duration(hours: 2));
  int maxAttempts = 0;
  String gradingMode = 'general';

  bool requireFaceCheck = false;
  bool requireStudentCard = false;
  bool monitorScreen = false;
  bool intentShuffle = false;

  String currentTab = 'overview'; // 'overview' hoặc 'anti'

  // 2. Hàm Validation
  String? _validate() {
    final now = DateTime.now();
    if (timeOpen.isBefore(now)) {
      return "Thời gian bắt đầu phải từ hiện tại trở đi.";
    }
    if (timeClose.isBefore(timeOpen)) {
      return "Thời gian kết thúc phải lớn hơn thời gian bắt đầu.";
    }
    if (duration <= 0) return "Thời lượng thi phải là số dương.";
    return null;
  }

  // 3. Hàm Submit
  void _submit() {
    final error = _validate();
    if (error != null) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(error), backgroundColor: Colors.red),
      );
      return;
    }

    final entity = ExamSettingEntity(
      duration: duration,
      durationMinutes: durationMinutes,
      timeOpen: timeOpen,
      timeClose: timeClose,
      maxAttempts: maxAttempts,
      requireFaceCheck: requireFaceCheck,
      requireStudentCard: requireStudentCard,
      monitorScreen: monitorScreen,
      intentShuffle: intentShuffle,
      gradingMode: gradingMode,
    );

    context.read<ExamSettingBloc>().add(
      SubmitSettingEvent(examId: widget.examId, entity: entity),
    );
  }

  @override
  Widget build(BuildContext context) {
    return BlocListener<ExamSettingBloc, ExamSettingState>(
      listener: (context, state) {
        if (state is ExamSettingSuccess) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text("Mở phòng thi thành công!"),
              backgroundColor: Colors.green,
            ),
          );
          context.go('/open-success/${widget.examId}?room=${state.roomCode}');
        }
        if (state is ExamSettingFailure) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(state.errorMessage),
              backgroundColor: Colors.red,
            ),
          );
        }
      },
      child: Scaffold(
        backgroundColor: const Color(0xFFF8FAFC),
        appBar: AppBar(
          title: const Text(
            "Cấu hình phòng thi",
            style: TextStyle(
              color: Colors.black,
              fontSize: 18,
              fontWeight: FontWeight.bold,
            ),
          ),
          backgroundColor: Colors.white,
          elevation: 0.5,
          actions: [
            TextButton.icon(
              onPressed: _submit,
              icon: const Icon(Icons.play_arrow, size: 20),
              label: const Text("Mở phòng"),
            ),
          ],
        ),
        body: SingleChildScrollView(
          padding: const EdgeInsets.all(16),
          child: Column(
            children: [
              _buildTabs(),
              const SizedBox(height: 20),
              if (currentTab == 'overview') _buildOverviewSection(),
              if (currentTab == 'anti') _buildAntiCheatSection(),
              const SizedBox(height: 32),
              _buildPreviewButton(),
              const SizedBox(height: 12),
              _buildSubmitButton(),
              const SizedBox(height: 20),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildTabs() {
    return Row(
      children: [
        _tabItem("Tổng quan", 'overview'),
        const SizedBox(width: 20),
        _tabItem("Chống gian lận", 'anti'),
      ],
    );
  }

  Widget _tabItem(String label, String tabId) {
    bool isActive = currentTab == tabId;
    return GestureDetector(
      onTap: () => setState(() => currentTab = tabId),
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 8),
        decoration: BoxDecoration(
          border: Border(
            bottom: BorderSide(
              color: isActive ? Colors.blue : Colors.transparent,
              width: 2,
            ),
          ),
        ),
        child: Text(
          label,
          style: TextStyle(
            color: isActive ? Colors.blue : Colors.grey,
            fontWeight: FontWeight.w600,
          ),
        ),
      ),
    );
  }

  Widget _buildOverviewSection() {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Colors.grey[200]!),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const SectionHeading(
            icon: Icons.timer_outlined,
            title: "Thời gian & Chấm điểm",
            description:
                "Thiết lập thời lượng, khung giờ mở phòng và cách thức chấm điểm của hệ thống.",
          ),

          // 1. Ô Thời lượng
          TextFormField(
            initialValue: duration.toString(),
            decoration: InputDecoration(
              labelText: "Thời lượng (phút)",
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(8),
              ),
              contentPadding: const EdgeInsets.symmetric(
                horizontal: 14,
                vertical: 12,
              ),
            ),
            keyboardType: TextInputType.number,
            onChanged: (v) => setState(() {
              duration = int.tryParse(v) ?? 60;
              durationMinutes = duration;
            }),
          ),

          const SizedBox(height: 16),

          // 2. Ô Số lần làm lại (Xuống dòng riêng)
          TextFormField(
            initialValue: maxAttempts.toString(),
            decoration: InputDecoration(
              labelText: "Số lần làm lại",
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(8),
              ),
              contentPadding: const EdgeInsets.symmetric(
                horizontal: 14,
                vertical: 12,
              ),
              helperText: "Nhập 0 để cho phép làm lại vô hạn",
              helperStyle: const TextStyle(fontSize: 12, color: Colors.grey),
            ),
            keyboardType: TextInputType.number,
            onChanged: (v) => setState(() {
              maxAttempts = int.tryParse(v) ?? 0;
            }),
          ),

          const SizedBox(height: 20),

          // 3. Thời gian Bắt đầu (Bây giờ đã tách thành Ngày & Giờ)
          DateTimePickerField(
            label: "Thời gian bắt đầu",
            currentValue: timeOpen,
            minimumDate: DateTime.now(),
            onChanged: (newDateTime) {
              setState(() {
                timeOpen = newDateTime;
                if (timeClose.isBefore(timeOpen)) {
                  timeClose = timeOpen.add(const Duration(hours: 2));
                }
              });
            },
          ),

          const SizedBox(height: 16),

          // 4. Thời gian Kết thúc
          DateTimePickerField(
            label: "Thời gian kết thúc",
            currentValue: timeClose,
            minimumDate: timeOpen,
            onChanged: (newDateTime) {
              setState(() => timeClose = newDateTime);
            },
          ),

          const SizedBox(height: 32),
          const Divider(height: 1),
          const SizedBox(height: 20),

          // 5. Dropdown chọn Mô hình AI
          const Text(
            "Mô hình chấm bài tự động AI",
            style: TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.w500,
              color: Color(0xFF334155),
            ),
          ),
          const SizedBox(height: 8),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 14),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(8),
              border: Border.all(color: Colors.grey[300]!),
            ),
            child: DropdownButtonHideUnderline(
              child: DropdownButton<String>(
                value: gradingMode,
                isExpanded: true,
                items: const [
                  DropdownMenuItem(
                    value: 'general',
                    child: Text("Linh hoạt (General Mode)"),
                  ),
                  DropdownMenuItem(
                    value: 'technical',
                    child: Text("Khắt khe (Technical Mode)"),
                  ),
                ],
                onChanged: (value) {
                  if (value != null) setState(() => gradingMode = value);
                },
              ),
            ),
          ),

          const SizedBox(height: 16),

          // 6. UI Mô tả chi tiết mô hình AI (Phát sáng ô được chọn)
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Hộp Mô tả General Mode
              Expanded(
                child: AnimatedContainer(
                  duration: const Duration(milliseconds: 200),
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: gradingMode == 'general'
                        ? Colors.blue.shade50
                        : Colors.grey.shade50,
                    border: Border.all(
                      color: gradingMode == 'general'
                          ? Colors.blue.shade300
                          : Colors.grey.shade200,
                      width: gradingMode == 'general' ? 1.5 : 1.0,
                    ),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        "Linh hoạt",
                        style: TextStyle(
                          fontWeight: FontWeight.bold,
                          fontSize: 13,
                          color: gradingMode == 'general'
                              ? Colors.blue.shade700
                              : Colors.grey.shade600,
                        ),
                      ),
                      const SizedBox(height: 6),
                      Text(
                        "AI tự động nhận diện điểm nếu bài làm khớp ngữ nghĩa hoặc ý tưởng. Phù hợp môn luật, triết học.",
                        style: TextStyle(
                          fontSize: 12,
                          height: 1.4,
                          color: gradingMode == 'general'
                              ? Colors.blue.shade900
                              : Colors.grey.shade500,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(width: 12),
              // Hộp Mô tả Technical Mode
              Expanded(
                child: AnimatedContainer(
                  duration: const Duration(milliseconds: 200),
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: gradingMode == 'technical'
                        ? Colors.indigo.shade50
                        : Colors.grey.shade50,
                    border: Border.all(
                      color: gradingMode == 'technical'
                          ? Colors.indigo.shade300
                          : Colors.grey.shade200,
                      width: gradingMode == 'technical' ? 1.5 : 1.0,
                    ),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        "Khắt khe",
                        style: TextStyle(
                          fontWeight: FontWeight.bold,
                          fontSize: 13,
                          color: gradingMode == 'technical'
                              ? Colors.indigo.shade700
                              : Colors.grey.shade600,
                        ),
                      ),
                      const SizedBox(height: 6),
                      Text(
                        "Kiểm tra chính xác cấu trúc code, tên biến theo quy chuẩn. Phù hợp cho môn lập trình.",
                        style: TextStyle(
                          fontSize: 12,
                          height: 1.4,
                          color: gradingMode == 'technical'
                              ? Colors.indigo.shade900
                              : Colors.grey.shade500,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildAntiCheatSection() {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Colors.grey[200]!),
      ),
      child: Column(
        children: [
          const SectionHeading(
            icon: Icons.shield_outlined,
            title: "Chống gian lận",
            description: "Bảo mật phòng thi thông qua xác thực.",
          ),
          LabeledToggle(
            icon: Icons.face,
            label: "Xác minh khuôn mặt",
            description: "Đối chiếu ảnh chụp hồ sơ.",
            checked: requireFaceCheck,
            onChange: (v) => setState(() => requireFaceCheck = v),
          ),
          LabeledToggle(
            icon: Icons.credit_card,
            label: "Thẻ sinh viên",
            description: "Yêu cầu chụp ảnh thẻ.",
            checked: requireStudentCard,
            onChange: (v) => setState(() => requireStudentCard = v),
          ),
          LabeledToggle(
            icon: Icons.monitor,
            label: "Theo dõi màn hình",
            description: "Cảnh báo chuyển tab.",
            checked: monitorScreen,
            onChange: (v) => setState(() => monitorScreen = v),
          ),
          LabeledToggle(
            icon: Icons.shuffle,
            label: "Xáo trộn đề",
            description: "Thứ tự câu hỏi ngẫu nhiên.",
            checked: intentShuffle,
            onChange: (v) => setState(() => intentShuffle = v),
          ),
        ],
      ),
    );
  }

  Widget _buildSubmitButton() {
    return BlocBuilder<ExamSettingBloc, ExamSettingState>(
      builder: (context, state) {
        bool isLoading = state is ExamSettingLoading;
        return SizedBox(
          width: double.infinity,
          height: 50,
          child: ElevatedButton(
            onPressed: isLoading ? null : _submit,
            style: ElevatedButton.styleFrom(
              backgroundColor: Colors.blue[600],
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(12),
              ),
            ),
            child: isLoading
                ? const CircularProgressIndicator(color: Colors.white)
                : const Text(
                    "Mở phòng thi ngay",
                    style: TextStyle(
                      color: Colors.white,
                      fontSize: 16,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
          ),
        );
      },
    );
  }

  Widget _buildPreviewButton() {
    return SizedBox(
      width: double.infinity,
      height: 50,
      child: OutlinedButton.icon(
        onPressed: () {
          // Kiểm tra xem có thể quay lại trang trước (Preview) được không
          if (context.canPop()) {
            context.pop();
          } else {
            // Đề phòng trường hợp lỗi stack, dùng push thẳng URL gốc
            context.push(
              '/instructor-dashboard/exams/${widget.examId}/preview',
            );
          }
        },
        icon: Icon(
          Icons.remove_red_eye_outlined,
          color: Colors.blue[700],
          size: 20,
        ),
        label: Text(
          "Xem lại đề thi",
          style: TextStyle(
            color: Colors.blue[700],
            fontSize: 16,
            fontWeight: FontWeight.bold,
          ),
        ),
        style: OutlinedButton.styleFrom(
          side: BorderSide(color: Colors.blue[600]!, width: 1.5), // Viền xanh
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(12),
          ),
          backgroundColor:
              Colors.white, // Nền trắng để nổi lên trên nền xám của app
        ),
      ),
    );
  }
}
