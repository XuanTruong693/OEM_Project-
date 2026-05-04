import 'package:flutter_bloc/flutter_bloc.dart';
import '../../domain/usecases/get_student_dashboard_data_usecase.dart';
import 'student_dashboard_event.dart';
import 'student_dashboard_state.dart';

class StudentDashboardBloc
    extends Bloc<StudentDashboardEvent, StudentDashboardState> {
  final GetStudentDashboardDataUseCase getDashboardDataUseCase;

  StudentDashboardBloc({required this.getDashboardDataUseCase})
    : super(DashboardInitial()) {
    // Đăng ký xử lý khi có event LoadDashboardDataEvent được bắn ra
    on<LoadDashboardDataEvent>(_onLoadDashboardData);
  }

  Future<void> _onLoadDashboardData(
    LoadDashboardDataEvent event,
    Emitter<StudentDashboardState> emit,
  ) async {
    // 1. Phát tín hiệu cho UI biết đang Loading
    emit(DashboardLoading());

    // 2. Gọi UseCase để lấy và tính toán dữ liệu
    final result = await getDashboardDataUseCase();

    // 3. Xử lý kết quả (Dùng hàm fold của gói dartz để rẽ nhánh Lỗi / Thành công)
    result.fold(
      (failure) {
        // Trả về State lỗi kèm message (Lưu ý: Nếu class Failure của bạn lưu câu lỗi ở biến khác, hãy đổi .message cho đúng nhé)
        emit(DashboardError(message: failure.message));
      },
      (dashboardData) {
        // Trả về State thành công kèm toàn bộ data (Profile, Kết quả, Thống kê)
        emit(DashboardLoaded(data: dashboardData));
      },
    );
  }
}
