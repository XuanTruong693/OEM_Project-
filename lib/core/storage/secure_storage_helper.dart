import 'package:flutter_secure_storage/flutter_secure_storage.dart';

class SecureStorageHelper {
  static const _storage = FlutterSecureStorage();

  static const _keyAccessToken = 'access_token';
  static const _keyRefreshToken = 'refresh_token';

  // Lưu Tokens
  static Future<void> saveTokens({
    required String accessToken,
    required String refreshToken,
  }) async {
    await _storage.write(key: _keyAccessToken, value: accessToken);
    await _storage.write(key: _keyRefreshToken, value: refreshToken);
  }

  // Lấy Access Token
  static Future<String?> getAccessToken() async {
    return await _storage.read(key: _keyAccessToken);
  }

  // Lấy Refresh Token
  static Future<String?> getRefreshToken() async {
    return await _storage.read(key: _keyRefreshToken);
  }

  // Xóa toàn bộ (Dùng khi Logout)
  static Future<void> clearAll() async {
    await _storage.deleteAll();
  }

  // --- METHODS ADDED FOR ROOM & EXAM WORKFLOW ---
  static Future<void> saveSelectedRole(String role) async {
    await _storage.write(key: 'selected_role', value: role);
  }

  static Future<String?> getSelectedRole() async {
    return await _storage.read(key: 'selected_role');
  }

  static Future<void> saveRoomId(String roomId) async {
    await _storage.write(key: 'room_id', value: roomId);
  }

  static Future<String?> getRoomId() async {
    return await _storage.read(key: 'room_id');
  }

  static Future<void> saveRoomToken(String token) async {
    await _storage.write(key: 'room_token', value: token);
  }

  static Future<String?> getRoomToken() async {
    return await _storage.read(key: 'room_token');
  }

  static Future<void> savePendingExamId(String examId) async {
    await _storage.write(key: 'pending_exam_id', value: examId);
  }

  static Future<String?> getPendingExamId() async {
    return await _storage.read(key: 'pending_exam_id');
  }

  static Future<void> saveSubmissionId(String submissionId) async {
    await _storage.write(key: 'submission_id', value: submissionId);
  }

  static Future<String?> getSubmissionId() async {
    return await _storage.read(key: 'submission_id');
  }

  static Future<void> saveExamFlags({
    required bool requireFaceCheck,
    required bool requireStudentCard,
    required bool monitorScreen,
  }) async {
    await _storage.write(key: 'exam_flag_face', value: requireFaceCheck.toString());
    await _storage.write(key: 'exam_flag_card', value: requireStudentCard.toString());
    await _storage.write(key: 'exam_flag_monitor', value: monitorScreen.toString());
  }

  static Future<void> saveExamFlagsFromJson(Map<String, dynamic> json) async {
    await _storage.write(key: 'exam_flag_face', value: (json['requireFaceCheck'] ?? false).toString());
    await _storage.write(key: 'exam_flag_card', value: (json['requireStudentCard'] ?? false).toString());
    await _storage.write(key: 'exam_flag_monitor', value: (json['monitorScreen'] ?? false).toString());
  }

  static Future<void> saveExamTime({
    required String? timeOpen,
    required String? timeClose,
  }) async {
    await _storage.write(key: 'exam_time_open', value: timeOpen ?? '');
    await _storage.write(key: 'exam_time_close', value: timeClose ?? '');
  }
}
