import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import 'package:mobile/features/instructor_rooms/presentation/bloc/instructor_room_detail_bloc.dart';
import 'package:mobile/features/instructor_rooms/presentation/bloc/instructor_room_detail_event.dart';
import 'package:mobile/features/instructor_rooms/presentation/bloc/instructor_room_detail_state.dart';
import 'package:mobile/features/instructor_rooms/domain/entities/exam_room_entity.dart';
import 'package:mobile/features/instructor_rooms/domain/entities/room_student_entity.dart';

class InstructorRoomDetailPage extends StatefulWidget {
  final String id;
  const InstructorRoomDetailPage({super.key, required this.id});

  @override
  State<InstructorRoomDetailPage> createState() =>
      _InstructorRoomDetailPageState();
}

class _InstructorRoomDetailPageState extends State<InstructorRoomDetailPage>
    with SingleTickerProviderStateMixin {
  late TabController _tabController;
  final TextEditingController _searchController = TextEditingController();

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
    context.read<InstructorRoomDetailBloc>().add(
      LoadRoomDetailEvent(widget.id),
    );
  }

  @override
  void dispose() {
    _tabController.dispose();
    _searchController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return BlocBuilder<InstructorRoomDetailBloc, InstructorRoomDetailState>(
      builder: (context, state) {
        if (state is InstructorRoomDetailLoading) {
          return const Scaffold(
            body: Center(child: CircularProgressIndicator()),
          );
        }

        if (state is InstructorRoomDetailError) {
          return Scaffold(
            body: Center(
              child: Text(
                state.message,
                style: const TextStyle(color: Colors.red),
              ),
            ),
          );
        }

        if (state is InstructorRoomDetailLoaded) {
          return Scaffold(
            backgroundColor: Colors.white,
            appBar: _buildAppBar(state),
            body: Column(
              children: [
                _buildTabBar(),
                Expanded(
                  child: TabBarView(
                    controller: _tabController,
                    children: [
                      _ConfigTab(
                        exam: state.exam,
                        isUpdating: state.isUpdatingConfig,
                      ),
                      _StudentsTab(
                        students: state.filteredStudents,
                        searchController: _searchController,
                      ),
                    ],
                  ),
                ),
              ],
            ),
          );
        }

        return const Scaffold();
      },
    );
  }

  PreferredSizeWidget _buildAppBar(InstructorRoomDetailLoaded state) {
    return AppBar(
      backgroundColor: Colors.white,
      elevation: 0,
      leading: IconButton(
        icon: const Icon(Icons.arrow_back, color: Colors.black87),
        onPressed: () => context.pop(),
      ),
      title: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Text(
                state.exam.title ?? 'Phòng thi',
                style: const TextStyle(
                  color: Colors.black87,
                  fontWeight: FontWeight.w900,
                  fontSize: 16,
                ),
              ),
              const SizedBox(width: 8),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                decoration: BoxDecoration(
                  color: Colors.green[50],
                  borderRadius: BorderRadius.circular(6),
                ),
                child: const Text(
                  "LIVE",
                  style: TextStyle(
                    color: Colors.green,
                    fontSize: 8,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ),
            ],
          ),
          Text(
            "Mã phòng: ${state.exam.examRoomCode}",
            style: TextStyle(
              color: Colors.grey[500],
              fontSize: 11,
              fontWeight: FontWeight.bold,
            ),
          ),
        ],
      ),
      actions: [
        _summaryItem("Thời gian", "${state.exam.durationMinutes}p"),
        _summaryItem("Sĩ số", "${state.allStudents.length}"),
        const SizedBox(width: 10),
      ],
    );
  }

  Widget _summaryItem(String label, String value) {
    return Container(
      margin: const EdgeInsets.symmetric(vertical: 8, horizontal: 4),
      padding: const EdgeInsets.symmetric(horizontal: 10),
      decoration: BoxDecoration(
        color: Colors.grey[50],
        borderRadius: BorderRadius.circular(12),
      ),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Text(
            label,
            style: const TextStyle(
              color: Colors.grey,
              fontSize: 8,
              fontWeight: FontWeight.bold,
            ),
          ),
          Text(
            value,
            style: const TextStyle(
              color: Colors.blue,
              fontSize: 14,
              fontWeight: FontWeight.w900,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildTabBar() {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      height: 45,
      decoration: BoxDecoration(
        color: Colors.grey[100],
        borderRadius: BorderRadius.circular(12),
      ),
      child: TabBar(
        controller: _tabController,
        indicator: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(10),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withOpacity(0.05),
              blurRadius: 4,
              offset: const Offset(0, 2),
            ),
          ],
        ),
        labelColor: Colors.blue[700],
        unselectedLabelColor: Colors.grey[500],
        labelStyle: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
        tabs: const [
          Tab(text: "Cấu hình"),
          Tab(text: "Sinh viên"),
        ],
      ),
    );
  }
}

class _ConfigTab extends StatefulWidget {
  final ExamRoomEntity exam;
  final bool isUpdating;
  const _ConfigTab({required this.exam, required this.isUpdating});

  @override
  State<_ConfigTab> createState() => _ConfigTabState();
}

class _ConfigTabState extends State<_ConfigTab> {
  late int _duration;
  late DateTime? _timeOpen;
  late DateTime? _timeClose;
  late bool _faceCheck;
  late bool _studentCard;
  late bool _monitor;
  late bool _allowAnswers;
  bool _isUpdating = false;

  // Persist controller to avoid cursor reset on rebuild
  final TextEditingController _durationController = TextEditingController();

  @override
  void initState() {
    super.initState();
    _initFields();
  }

  @override
  void dispose() {
    _durationController.dispose();
    super.dispose();
  }

  void _initFields() {
    _duration = widget.exam.durationMinutes;
    _durationController.text = _duration.toString();

    // Server trả về chuỗi thô (Local), parse trực tiếp không dùng toLocal
    _timeOpen = widget.exam.timeOpen != null
        ? DateTime.tryParse(widget.exam.timeOpen!)
        : null;
    _timeClose = widget.exam.timeClose != null
        ? DateTime.tryParse(widget.exam.timeClose!)
        : null;

    _faceCheck = widget.exam.requireFaceCheck;
    _studentCard = widget.exam.requireStudentCard;
    _monitor = widget.exam.monitorScreen;
    _allowAnswers = widget.exam.allowViewAnswers;
  }

  @override
  void didUpdateWidget(_ConfigTab oldWidget) {
    super.didUpdateWidget(oldWidget);
    // Only re-init if the exam data changed on server (not because of local typing)
    if (oldWidget.exam != widget.exam) {
      _initFields();
    }
  }

  Future<void> _pickDateTime(bool isOpen) async {
    final date = await showDatePicker(
      context: context,
      initialDate: (isOpen ? _timeOpen : _timeClose) ?? DateTime.now(),
      firstDate: DateTime.now().subtract(const Duration(days: 365)),
      lastDate: DateTime.now().add(const Duration(days: 365)),
    );
    if (date != null && mounted) {
      final time = await showTimePicker(
        context: context,
        initialTime: TimeOfDay.fromDateTime(
          (isOpen ? _timeOpen : _timeClose) ?? DateTime.now(),
        ),
      );
      if (time != null) {
        setState(() {
          if (isOpen) {
            _timeOpen = DateTime(
              date.year,
              date.month,
              date.day,
              time.hour,
              time.minute,
            );
          } else {
            _timeClose = DateTime(
              date.year,
              date.month,
              date.day,
              time.hour,
              time.minute,
            );
          }
        });
      }
    }
  }

  void _applyConfig() async {
    if (_isUpdating) return;
    setState(() {
      _isUpdating = true;
    });

    String? toMySQL(DateTime? dt) {
      if (dt == null) return null;
      return "${dt.year}-${dt.month.toString().padLeft(2, '0')}-${dt.day.toString().padLeft(2, '0')} ${dt.hour.toString().padLeft(2, '0')}:${dt.minute.toString().padLeft(2, '0')}:00";
    }

    try {
      final ds = context.read<InstructorRoomDetailBloc>().dataSource;
      final examId = widget.exam.id;

      await ds.updateRoomConfig(examId, {
        'duration_minutes': _duration,
        'time_open': toMySQL(_timeOpen),
        'time_close': toMySQL(_timeClose),
        'require_face_check': _faceCheck,
        'require_student_card': _studentCard,
        'monitor_screen': _monitor,
        'allow_view_answers': _allowAnswers,
      });

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text("Áp dụng cấu hình thành công!"),
            backgroundColor: Colors.green,
          ),
        );
        context.read<InstructorRoomDetailBloc>().add(LoadRoomDetailEvent(examId));
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text("Không thể áp dụng cấu hình: $e"),
            backgroundColor: Colors.red,
          ),
        );
      }
    } finally {
      if (mounted) {
        setState(() {
          _isUpdating = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _buildSaveButton(),
          const SizedBox(height: 20),
          _label("Thời gian làm bài (phút)"),
          _buildNumberInput(),
          const SizedBox(height: 20),
          Row(
            children: [
              Expanded(
                child: _buildDateTimePicker(
                  "Mở phòng",
                  _timeOpen,
                  () => _pickDateTime(true),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: _buildDateTimePicker(
                  "Kết thúc",
                  _timeClose,
                  () => _pickDateTime(false),
                ),
              ),
            ],
          ),
          const SizedBox(height: 30),
          _label("CHẾ ĐỘ GIÁM SÁT"),
          const SizedBox(height: 12),
          _configToggle(
            Icons.face_retouching_natural,
            "Nhận diện khuôn mặt",
            "Yêu cầu SV chụp ảnh xác minh",
            _faceCheck,
            (v) => setState(() => _faceCheck = v),
          ),
          _configToggle(
            Icons.badge_outlined,
            "Yêu cầu Thẻ SV",
            "Verify thẻ thông qua AI",
            _studentCard,
            (v) => setState(() => _studentCard = v),
          ),
          _configToggle(
            Icons.monitor_outlined,
            "Giám sát màn hình",
            "Tự động phát hiện Alt-Tab",
            _monitor,
            (v) => setState(() => _monitor = v),
          ),
          _configToggle(
            Icons.check_circle_outline,
            "Cho phép xem đáp án",
            "SV có thể xem lại kết quả sau khi thi",
            _allowAnswers,
            (v) => setState(() => _allowAnswers = v),
          ),
        ],
      ),
    );
  }

  Widget _buildSaveButton() {
    final bool loading = widget.isUpdating || _isUpdating;
    return SizedBox(
      width: double.infinity,
      child: ElevatedButton.icon(
        onPressed: loading ? null : _applyConfig,
        icon: loading
            ? const SizedBox(
                width: 16,
                height: 16,
                child: CircularProgressIndicator(
                  strokeWidth: 2,
                  color: Colors.white,
                ),
              )
            : const Icon(Icons.save_outlined),
        label: Text(
          loading ? "Đang áp dụng..." : "Áp dụng cấu hình ngay",
        ),
        style: ElevatedButton.styleFrom(
          backgroundColor: Colors.blue[700],
          foregroundColor: Colors.white,
          padding: const EdgeInsets.symmetric(vertical: 14),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(16),
          ),
          elevation: 4,
          shadowColor: Colors.blue.withOpacity(0.3),
        ),
      ),
    );
  }

  Widget _label(String text) {
    return Text(
      text.toUpperCase(),
      style: TextStyle(
        color: Colors.grey[400],
        fontSize: 10,
        fontWeight: FontWeight.bold,
        letterSpacing: 1.2,
      ),
    );
  }

  Widget _buildNumberInput() {
    return Container(
      margin: const EdgeInsets.only(top: 8),
      padding: const EdgeInsets.symmetric(horizontal: 16),
      decoration: BoxDecoration(
        color: Colors.grey[50],
        borderRadius: BorderRadius.circular(16),
      ),
      child: Row(
        children: [
          const Icon(Icons.timer_outlined, color: Colors.grey, size: 20),
          const SizedBox(width: 12),
          Expanded(
            child: TextField(
              keyboardType: TextInputType.number,
              onChanged: (v) => _duration = int.tryParse(v) ?? _duration,
              controller: _durationController,
              style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
              decoration: const InputDecoration(border: InputBorder.none),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildDateTimePicker(
    String label,
    DateTime? value,
    VoidCallback onTap,
  ) {
    final format = DateFormat('dd/MM/yyyy HH:mm');
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _label(label),
        const SizedBox(height: 8),
        InkWell(
          onTap: onTap,
          child: Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: Colors.grey[50],
              borderRadius: BorderRadius.circular(16),
            ),
            child: Text(
              value != null ? format.format(value) : "Chọn ngày/giờ",
              style: const TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.bold,
                color: Colors.black87,
              ),
            ),
          ),
        ),
      ],
    );
  }

  Widget _configToggle(
    IconData icon,
    String title,
    String desc,
    bool value,
    Function(bool) onChanged,
  ) {
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      decoration: BoxDecoration(
        color: value ? Colors.blue[50]!.withOpacity(0.3) : Colors.white,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(
          color: value ? Colors.blue[100]! : Colors.grey[100]!,
        ),
      ),
      child: ListTile(
        leading: Container(
          padding: const EdgeInsets.all(8),
          decoration: BoxDecoration(
            color: value ? Colors.blue[600] : Colors.grey[100],
            borderRadius: BorderRadius.circular(12),
          ),
          child: Icon(
            icon,
            color: value ? Colors.white : Colors.grey,
            size: 20,
          ),
        ),
        title: Text(
          title,
          style: TextStyle(
            fontWeight: FontWeight.bold,
            fontSize: 14,
            color: value ? Colors.blue[800] : Colors.black87,
          ),
        ),
        subtitle: Text(
          desc,
          style: TextStyle(fontSize: 11, color: Colors.grey[500]),
        ),
        trailing: Switch(
          value: value,
          onChanged: onChanged,
          activeThumbColor: Colors.blue[700],
        ),
      ),
    );
  }
}

class _StudentsTab extends StatelessWidget {
  final List<RoomStudentEntity> students;
  final TextEditingController searchController;
  const _StudentsTab({required this.students, required this.searchController});

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        _buildSearchBox(context),
        Expanded(
          child: students.isEmpty
              ? _buildEmptyState()
              : ListView.separated(
                  padding: const EdgeInsets.all(16),
                  itemCount: students.length,
                  separatorBuilder: (c, i) =>
                      const Divider(height: 24, color: Color(0xFFF5F5F5)),
                  itemBuilder: (context, index) =>
                      _buildStudentItem(context, students[index]),
                ),
        ),
      ],
    );
  }

  Widget _buildSearchBox(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(16),
      child: TextField(
        controller: searchController,
        onChanged: (v) => context.read<InstructorRoomDetailBloc>().add(
          SearchStudentsEvent(v),
        ),
        decoration: InputDecoration(
          hintText: "Tìm tên, email, MSSV...",
          prefixIcon: const Icon(Icons.search, color: Colors.grey, size: 20),
          filled: true,
          fillColor: Colors.grey[50],
          border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(16),
            borderSide: BorderSide.none,
          ),
          contentPadding: const EdgeInsets.symmetric(vertical: 0),
        ),
      ),
    );
  }

  Widget _buildStudentItem(BuildContext context, RoomStudentEntity student) {
    return Row(
      children: [
        CircleAvatar(
          backgroundColor: Colors.blue[50],
          child: Text(
            student.name?.substring(0, 1).toUpperCase() ?? '?',
            style: TextStyle(
              color: Colors.blue[700],
              fontWeight: FontWeight.bold,
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
                  Text(
                    student.name ?? 'Unknown',
                    style: const TextStyle(
                      fontWeight: FontWeight.bold,
                      fontSize: 14,
                    ),
                  ),
                  if (student.attemptNo > 1) ...[
                    const SizedBox(width: 6),
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 4,
                        vertical: 1,
                      ),
                      decoration: BoxDecoration(
                        color: Colors.purple[50],
                        borderRadius: BorderRadius.circular(4),
                      ),
                      child: Text(
                        "Lần ${student.attemptNo}",
                        style: TextStyle(
                          color: Colors.purple[700],
                          fontSize: 8,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ),
                  ],
                ],
              ),
              const SizedBox(height: 2),
              Text(
                student.email ?? student.studentId ?? 'No info',
                style: TextStyle(color: Colors.grey[500], fontSize: 11),
              ),
              const SizedBox(height: 6),
              Row(
                children: [
                  _statusBadge(student.status),
                  const SizedBox(width: 8),
                  _violationBadge(student.cheatingCount),
                ],
              ),
            ],
          ),
        ),
        _buildActions(context, student),
      ],
    );
  }

  Widget _statusBadge(String? status) {
    Color color = Colors.grey;
    String text = "CHỜ...";
    switch (status?.toLowerCase()) {
      case 'in_progress':
        color = Colors.green;
        text = "ĐANG THI";
        break;
      case 'submitted':
        color = Colors.blue;
        text = "ĐÃ NỘP";
        break;
      case 'kicked':
        color = Colors.red;
        text = "BỊ KICK";
        break;
      case 'pending':
      case 'registered':
        color = Colors.amber;
        text = "CHỜ VERIFY";
        break;
    }
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
      decoration: BoxDecoration(
        color: color.withOpacity(0.1),
        borderRadius: BorderRadius.circular(6),
        border: Border.all(color: color.withOpacity(0.2)),
      ),
      child: Text(
        text,
        style: TextStyle(
          color: color,
          fontSize: 8,
          fontWeight: FontWeight.bold,
        ),
      ),
    );
  }

  Widget _violationBadge(int count) {
    final color = count > 0 ? Colors.red : Colors.green;
    return Row(
      children: [
        Container(
          width: 6,
          height: 6,
          decoration: BoxDecoration(color: color, shape: BoxShape.circle),
        ),
        const SizedBox(width: 4),
        Text(
          "$count lần",
          style: TextStyle(
            color: color,
            fontSize: 11,
            fontWeight: FontWeight.bold,
          ),
        ),
      ],
    );
  }

  Widget _buildActions(BuildContext context, RoomStudentEntity student) {
    bool canAct = [
      'in_progress',
      'registered',
      'pending',
    ].contains(student.status?.toLowerCase());
    return Row(
      children: [
        _actionBtn(
          context,
          Icons.check_circle_outline,
          Colors.blue,
          canAct && !student.isBypassed,
          () => _confirmAction(context, student, 'bypass'),
        ),
        const SizedBox(width: 8),
        _actionBtn(
          context,
          Icons.person_off_outlined,
          Colors.red,
          canAct,
          () => _confirmAction(context, student, 'kick'),
        ),
      ],
    );
  }

  Widget _actionBtn(
    BuildContext context,
    IconData icon,
    Color color,
    bool enabled,
    VoidCallback onTap,
  ) {
    return InkWell(
      onTap: enabled ? onTap : null,
      borderRadius: BorderRadius.circular(10),
      child: Container(
        padding: const EdgeInsets.all(8),
        decoration: BoxDecoration(
          color: enabled ? color.withOpacity(0.1) : Colors.grey[50],
          borderRadius: BorderRadius.circular(10),
        ),
        child: Icon(icon, color: enabled ? color : Colors.grey[300], size: 20),
      ),
    );
  }

  void _confirmAction(
    BuildContext context,
    RoomStudentEntity student,
    String action,
  ) {
    final title = action == 'kick' ? "Trục xuất sinh viên" : "Bỏ qua xác minh";
    final msg = action == 'kick'
        ? "Bạn có chắc muốn kết thúc bài thi của sinh viên này? Thao tác này không thể hoàn tác."
        : "Cho phép sinh viên này tiếp tục thi mà không cần xác minh hình ảnh/thẻ?";

    showDialog(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: Text(title),
        content: Text(msg),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialogContext),
            child: const Text("Hủy"),
          ),
          TextButton(
            onPressed: () {
              context.read<InstructorRoomDetailBloc>().add(
                StudentActionEvent(student.submissionId, action),
              );
              Navigator.pop(dialogContext);
            },
            child: Text(
              "Xác nhận",
              style: TextStyle(
                color: action == 'kick' ? Colors.red : Colors.blue,
                fontWeight: FontWeight.bold,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildEmptyState() {
    return const Center(
      child: Text(
        "Không có thí sinh nào.",
        style: TextStyle(color: Colors.grey),
      ),
    );
  }
}
