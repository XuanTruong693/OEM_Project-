import 'package:flutter_bloc/flutter_bloc.dart';
import '../../domain/usecases/get_dashboard_stats_use_case.dart';
import '../../domain/usecases/get_monthly_chart_use_case.dart';
import '../../domain/usecases/get_my_exams_use_case.dart';
import '../../../../features/profile/domain/usecases/get_profile_use_case.dart';
import 'instructor_dashboard_event.dart';
import 'instructor_dashboard_state.dart';
import 'package:mobile/core/network/socket_client.dart';
import 'package:mobile/core/storage/secure_storage_helper.dart';

class InstructorDashboardBloc
    extends Bloc<InstructorDashboardEvent, InstructorDashboardState> {
  final GetDashboardStatsUseCase getDashboardStatsUseCase;
  final GetMonthlyChartUseCase getMonthlyChartUseCase;
  final GetProfileUseCase getProfileUseCase;
  final GetMyExamsUseCase getMyExamsUseCase;

  InstructorDashboardBloc({
    required this.getDashboardStatsUseCase,
    required this.getMonthlyChartUseCase,
    required this.getProfileUseCase,
    required this.getMyExamsUseCase,
  }) : super(DashboardInitial()) {
    on<LoadDashboardDataEvent>(_onLoadDashboardData);
  }

  Future<void> _onLoadDashboardData(
    LoadDashboardDataEvent event,
    Emitter<InstructorDashboardState> emit,
  ) async {
    emit(DashboardLoading());

    try {
      // 0. KẾT NỐI SOCKET NGAY LÚC NÀY ĐỂ NHẬN THÔNG BÁO GIAN LẬN
      final token = await SecureStorageHelper.getAccessToken();
      if (token != null) {
        socketClient.connectSocket(token);
      }

      // 1. GỌI API SONG SONG (Stats, Chart, Profile, và Exams)
      final results = await Future.wait([
        getDashboardStatsUseCase.call(),
        getMonthlyChartUseCase.call(),
        getProfileUseCase.call(),
        getMyExamsUseCase.call(),
      ]);

      final stats = results[0] as dynamic;
      final chartData = results[1] as dynamic;
      final profile = results[2] as dynamic;
      final exams = results[3] as List<dynamic>;

      // 2. TRÍCH XUẤT THÔNG TIN USER TỪ PROFILE BE
      final String fullName = (profile.fullName != null && profile.fullName.trim().isNotEmpty) 
          ? profile.fullName 
          : "Giảng viên";
      final String avatar = profile.avatar ?? "";
      
      // Lấy danh sách ID để join socket global
      final examIds = exams.map((e) => e.id.toString()).toList();

      // 3. ĐÓNG GÓI VÀ NÉM CHO UI
      emit(
        DashboardLoaded(
          stats: stats,
          monthlyData: chartData,
          fullName: fullName,
          avatar: avatar,
          examIds: examIds,
        ),
      );
    } catch (e) {
      emit(DashboardError(e.toString()));
    }
  }
}
