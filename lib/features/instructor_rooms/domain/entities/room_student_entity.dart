class RoomStudentEntity {
  final String submissionId;
  final String? studentId;
  final String? name;
  final String? email;
  final String? status;
  final int attemptNo;
  final int cheatingCount;
  final String? startedAt;
  final bool isBypassed;

  const RoomStudentEntity({
    required this.submissionId,
    this.studentId,
    this.name,
    this.email,
    this.status,
    this.attemptNo = 1,
    this.cheatingCount = 0,
    this.startedAt,
    this.isBypassed = false,
  });

  factory RoomStudentEntity.fromJson(Map<String, dynamic> json) {
    return RoomStudentEntity(
      submissionId: json['submission_id']?.toString() ?? '',
      studentId: json['student_id']?.toString(),
      name: json['name']?.toString() ?? json['student_name']?.toString() ?? '',
      email: json['email']?.toString(),
      status: json['status']?.toString() ?? 'pending',
      attemptNo: json['attempt_no'] as int? ?? 1,
      cheatingCount: json['cheating_count'] as int? ?? 0,
      startedAt: json['started_at']?.toString(),
      isBypassed: json['is_bypassed'] == 1 || json['is_bypassed'] == true,
    );
  }

  RoomStudentEntity copyWith({
    String? status,
    int? cheatingCount,
    bool? isBypassed,
  }) {
    return RoomStudentEntity(
      submissionId: submissionId,
      studentId: studentId,
      name: name,
      email: email,
      status: status ?? this.status,
      attemptNo: attemptNo,
      cheatingCount: cheatingCount ?? this.cheatingCount,
      startedAt: startedAt,
      isBypassed: isBypassed ?? this.isBypassed,
    );
  }
}
