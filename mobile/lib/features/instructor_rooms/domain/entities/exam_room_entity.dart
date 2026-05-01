class ExamRoomEntity {
  final String id;
  final String? title;
  final String? examRoomCode;
  final int durationMinutes;
  final String? timeOpen;
  final String? timeClose;
  final bool requireFaceCheck;
  final bool requireStudentCard;
  final bool monitorScreen;
  final String? gradingMode;
  final bool allowViewAnswers;
  final int activeStudents;

  const ExamRoomEntity({
    required this.id,
    this.title,
    this.examRoomCode,
    this.durationMinutes = 0,
    this.timeOpen,
    this.timeClose,
    this.requireFaceCheck = false,
    this.requireStudentCard = false,
    this.monitorScreen = false,
    this.gradingMode = 'auto',
    this.allowViewAnswers = false,
    this.activeStudents = 0,
  });

  factory ExamRoomEntity.fromJson(Map<String, dynamic> json) {
    return ExamRoomEntity(
      id: json['id']?.toString() ?? '',
      title: json['title']?.toString(),
      examRoomCode: json['exam_room_code']?.toString(),
      durationMinutes: json['duration_minutes'] as int? ?? 0,
      timeOpen: json['time_open']?.toString(),
      timeClose: json['time_close']?.toString(),
      requireFaceCheck: json['require_face_check'] == 1 || json['require_face_check'] == true,
      requireStudentCard: json['require_student_card'] == 1 || json['require_student_card'] == true,
      monitorScreen: json['monitor_screen'] == 1 || json['monitor_screen'] == true,
      gradingMode: json['grading_mode']?.toString() ?? 'auto',
      allowViewAnswers: json['allow_view_answers'] == 1 || json['allow_view_answers'] == true,
      activeStudents: json['active_students'] as int? ?? 0,
    );
  }

  ExamRoomEntity copyWith({
    int? durationMinutes,
    String? timeOpen,
    String? timeClose,
    bool? requireFaceCheck,
    bool? requireStudentCard,
    bool? monitorScreen,
    String? gradingMode,
    bool? allowViewAnswers,
  }) {
    return ExamRoomEntity(
      id: id,
      title: title,
      examRoomCode: examRoomCode,
      durationMinutes: durationMinutes ?? this.durationMinutes,
      timeOpen: timeOpen ?? this.timeOpen,
      timeClose: timeClose ?? this.timeClose,
      requireFaceCheck: requireFaceCheck ?? this.requireFaceCheck,
      requireStudentCard: requireStudentCard ?? this.requireStudentCard,
      monitorScreen: monitorScreen ?? this.monitorScreen,
      gradingMode: gradingMode ?? this.gradingMode,
      allowViewAnswers: allowViewAnswers ?? this.allowViewAnswers,
      activeStudents: activeStudents,
    );
  }
}
