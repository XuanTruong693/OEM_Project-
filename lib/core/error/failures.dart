abstract class Failure {
  final String message;

  const Failure(this.message);
}

// Bắt lỗi khi gọi API thất bại
class ServerFailure extends Failure {
  const ServerFailure(super.message);
}

// Lỗi từ Cache đã được gói gọn lại
class CacheFailure extends Failure {
  CacheFailure(super.message);
}
