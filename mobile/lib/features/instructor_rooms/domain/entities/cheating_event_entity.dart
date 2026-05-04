class CheatingEventEntity {
  final String submissionId;
  final String studentName;
  final String eventType;
  final String severity;
  final String detectedAt;
  final int cheatingCount;
  final Map<String, dynamic> eventDetails;
  final bool deviceChange;
  final String firstDeviceName;
  final String secondDeviceName;
  final String reason;
  final String status;

  CheatingEventEntity({
    required this.submissionId,
    required this.studentName,
    required this.eventType,
    required this.severity,
    required this.detectedAt,
    required this.cheatingCount,
    this.eventDetails = const {},
    this.deviceChange = false,
    this.firstDeviceName = '',
    this.secondDeviceName = '',
    this.reason = '',
    this.status = '',
  });

  factory CheatingEventEntity.fromJson(Map<String, dynamic> json) {
    return CheatingEventEntity(
      submissionId: (json['submissionId'] ?? json['submission_id'])?.toString() ?? '',
      studentName: json['studentName']?.toString() ?? 'Thí sinh',
      eventType: json['eventType']?.toString() ?? 'unknown',
      severity: json['severity']?.toString() ?? 'low',
      detectedAt: json['detectedAt']?.toString() ?? DateTime.now().toIso8601String(),
      cheatingCount: json['cheatingCount'] as int? ?? 0,
      eventDetails: json['eventDetails'] as Map<String, dynamic>? ?? {},
      deviceChange: json['deviceChange'] == true,
      firstDeviceName: json['firstDeviceName']?.toString() ?? '',
      secondDeviceName: json['secondDeviceName']?.toString() ?? '',
      reason: json['reason']?.toString() ?? '',
      status: json['status']?.toString() ?? '',
    );
  }
}
