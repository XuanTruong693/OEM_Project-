import 'dart:convert';

class ExamCheatingLogEntity {
  final String? id;
  final String? eventType;
  final String? eventDetails;
  final String? recordedAt;
  final String? videoUrl;
  final String? snapshotId;
  final String? message;
  final String? severity;

  const ExamCheatingLogEntity({
    this.id,
    this.eventType,
    this.eventDetails,
    this.recordedAt,
    this.videoUrl,
    this.snapshotId,
    this.message,
    this.severity,
  });

  factory ExamCheatingLogEntity.fromJson(Map<String, dynamic> json) {
    final rawDetails = json['event_details'];
    String? detailsString;
    String? snapshotId;
    String? message;

    void parseMap(Map map) {
      snapshotId = map['snapshot_id']?.toString();
      final msg = map['message'];
      if (msg is List) {
        message = msg.join(' ');
      } else {
        message = msg?.toString();
      }
    }

    if (rawDetails is Map) {
      parseMap(rawDetails);
      detailsString = rawDetails.toString();
    } else if (rawDetails is String) {
      detailsString = rawDetails;
      try {
        final decoded = jsonDecode(rawDetails);
        if (decoded is Map) {
          parseMap(decoded);
        }
      } catch (e) {
        // Not a valid JSON
      }
    }

    return ExamCheatingLogEntity(
      id: json['id']?.toString(),
      eventType: json['event_type']?.toString(),
      eventDetails: detailsString,
      recordedAt: json['detected_at']?.toString() ?? json['recorded_at']?.toString(),
      videoUrl: json['video_url']?.toString(),
      snapshotId: snapshotId,
      message: message,
      severity: json['severity']?.toString(),
    );
  }
}
