import '../../domain/entities/student_dashboard_data_entity.dart';

abstract class StudentDashboardState {}

// Trạng thái ban đầu khi chưa làm gì cả
class DashboardInitial extends StudentDashboardState {}

// Trạng thái đang tải dữ liệu (Hiển thị Shimmer / CircularProgressIndicator)
class DashboardLoading extends StudentDashboardState {}

// Trạng thái tải thành công (Chứa toàn bộ data để vẽ Dashboard)
class DashboardLoaded extends StudentDashboardState {
  final StudentDashboardDataEntity data;

  DashboardLoaded({required this.data});
}

// Trạng thái lỗi (Chứa câu thông báo lỗi để hiện SnackBar)
class DashboardError extends StudentDashboardState {
  final String message;

  DashboardError({required this.message});
}
