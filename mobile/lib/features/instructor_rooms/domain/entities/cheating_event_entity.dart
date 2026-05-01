class CheatingEventEntity {
  final String submissionId;
  final String studentName;
  final String eventType;
  final String severity;
  final String detectedAt;
  final int cheatingCount;
  final Map<String, dynamic> eventDetails;

  CheatingEventEntity({
    required this.submissionId,
    required this.studentName,
    required this.eventType,
    required this.severity,
    required this.detectedAt,
    required this.cheatingCount,
    this.eventDetails = const {},
  });

  factory CheatingEventEntity.fromJson(Map<String, dynamic> json) {
    return CheatingEventEntity(
      submissionId: json['submissionId']?.toString() ?? '',
      studentName: json['studentName']?.toString() ?? 'Thí sinh',
      eventType: json['eventType']?.toString() ?? 'unknown',
      severity: json['severity']?.toString() ?? 'low',
      detectedAt: json['detectedAt']?.toString() ?? DateTime.now().toIso8601String(),
      cheatingCount: json['cheatingCount'] as int? ?? 0,
      eventDetails: json['eventDetails'] as Map<String, dynamic>? ?? {},
    );
  }
}
