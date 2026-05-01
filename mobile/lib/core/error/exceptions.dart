// Lỗi văng ra từ API (Backend)
class ServerException implements Exception {
  final String message;
  ServerException([this.message = 'Có lỗi xảy ra từ máy chủ']);
}

// Lỗi văng ra khi đọc/ghi Két sắt (Local Storage) bị hỏng
class CacheException implements Exception {
  final String message;
  CacheException([this.message = 'Lỗi lưu trữ cục bộ']);
}
