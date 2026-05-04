import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/storage/secure_storage_helper.dart';
import '../bloc/student_dashboard_bloc.dart';
import '../bloc/student_dashboard_event.dart';
import '../bloc/student_dashboard_state.dart';
import '../widgets/recent_results_table.dart';
import '../widgets/student_action_card.dart';
import '../widgets/student_dashboard_header.dart';
import '../widgets/student_stat_card.dart';

class StudentDashboardPage extends StatefulWidget {
  const StudentDashboardPage({super.key});

  @override
  State<StudentDashboardPage> createState() => _StudentDashboardPageState();
}

class _StudentDashboardPageState extends State<StudentDashboardPage> {
  @override
  void initState() {
    super.initState();
    // Bắn event load dữ liệu ngay khi khởi tạo trang
    context.read<StudentDashboardBloc>().add(LoadDashboardDataEvent());
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC), // Nền xám nhạt (slate-50)
      body: BlocBuilder<StudentDashboardBloc, StudentDashboardState>(
        builder: (context, state) {
          if (state is DashboardLoading) {
            return const Center(child: CircularProgressIndicator());
          }

          if (state is DashboardError) {
            return Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Text(
                    'Lỗi: ${state.message}',
                    style: const TextStyle(color: Colors.red),
                  ),
                  const SizedBox(height: 16),
                  ElevatedButton(
                    onPressed: () => context.read<StudentDashboardBloc>().add(
                      LoadDashboardDataEvent(),
                    ),
                    child: const Text('Thử lại'),
                  ),
                ],
              ),
            );
          }

          if (state is DashboardLoaded) {
            final data = state.data;
            final stats = data.stats;

            return Column(
              children: [
                // 1. Header (Cố định ở trên)
                StudentDashboardHeader(
                  userName: data.profile.fullName,
                  avatarUrl: data.profile.avatar,
                  onLogout: () async {
                    // 1. Xóa sạch Token dưới máy
                    await SecureStorageHelper.clearAll();

                    // 2. Chuyển hướng an toàn
                    if (context.mounted) {
                      context.go('/role');
                    }
                  },
                  onProfileTap: () => context.push('/profile'),
                ),

                // 2. Nội dung có thể cuộn
                Expanded(
                  child: RefreshIndicator(
                    onRefresh: () async {
                      context.read<StudentDashboardBloc>().add(
                        LoadDashboardDataEvent(),
                      );
                    },
                    child: SingleChildScrollView(
                      padding: const EdgeInsets.all(16.0),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          // Chào mừng
                          const Text(
                            'Chào mừng bạn trở lại 👋',
                            style: TextStyle(
                              fontSize: 24,
                              fontWeight: FontWeight.bold,
                              color: Color(0xFF1E293B),
                            ),
                          ),
                          const Text(
                            'Theo dõi điểm số và tiến độ của bạn',
                            style: TextStyle(color: Color(0xFF64748B)),
                          ),
                          const SizedBox(height: 24),

                          // 3. Hàng thẻ Thống kê (Sử dụng GridView hoặc Wrap)
                          LayoutBuilder(
                            builder: (context, constraints) {
                              int crossAxisCount = constraints.maxWidth > 600
                                  ? 2
                                  : 1;
                              return GridView.count(
                                crossAxisCount: crossAxisCount,
                                shrinkWrap: true,
                                physics: const NeverScrollableScrollPhysics(),
                                mainAxisSpacing: 16,
                                crossAxisSpacing: 16,
                                childAspectRatio: 1.5,
                                children: [
                                  StudentStatCard(
                                    iconEmoji: "🎓",
                                    iconBgColors: [
                                      Colors.blue.shade100,
                                      Colors.blue.shade200,
                                    ],
                                    title: "Tổng bài thi",
                                    value: stats.totalExams.toString(),
                                    subtitle: "Bài đã hoàn thành",
                                    chartData: stats.chartDataTotal,
                                    barGradientColors: [
                                      Colors.blue.shade500,
                                      Colors.blue.shade400,
                                    ],
                                  ),
                                  StudentStatCard(
                                    iconEmoji: "📈",
                                    iconBgColors: [
                                      Colors.green.shade100,
                                      Colors.green.shade200,
                                    ],
                                    title: "Điểm TB",
                                    value: stats.averageScore.toStringAsFixed(
                                      1,
                                    ),
                                    subtitle: "Trung bình cộng",
                                    chartData: stats.chartDataAvg,
                                    barGradientColors: [
                                      Colors.green.shade500,
                                      Colors.green.shade400,
                                    ],
                                  ),
                                  StudentStatCard(
                                    iconEmoji: "🏆",
                                    iconBgColors: [
                                      Colors.purple.shade100,
                                      Colors.purple.shade200,
                                    ],
                                    title: "Cao nhất",
                                    value:
                                        "${stats.bestScore.toStringAsFixed(1)}/10",
                                    subtitle: "Điểm tốt nhất",
                                    chartData: stats.chartDataBest,
                                    barGradientColors: [
                                      Colors.purple.shade500,
                                      Colors.purple.shade400,
                                    ],
                                  ),
                                  StudentStatCard(
                                    iconEmoji: "📊",
                                    iconBgColors: [
                                      Colors.amber.shade100,
                                      Colors.amber.shade200,
                                    ],
                                    title: "Tỷ lệ đạt",
                                    value: "${stats.passRate}%",
                                    subtitle: "Bài đạt ≥ 5.0đ",
                                    chartData: stats.chartDataRecent,
                                    barGradientColors: [
                                      Colors.amber.shade500,
                                      Colors.amber.shade400,
                                    ],
                                  ),
                                ],
                              );
                            },
                          ),

                          const SizedBox(height: 24),

                          // 4. Lưới các nút hành động (Quick Actions)
                          Column(
                            children: [
                              StudentActionCard(
                                title: "Vào thi",
                                desc: "Nhập mã phòng được giảng viên cung cấp.",
                                actionText: "Xác minh ngay",
                                iconEmoji: "🔐",
                                onClick: () => context.push('/verify-room'),
                              ),
                              const SizedBox(height: 12),
                              StudentActionCard(
                                title: "Kết quả & lịch sử",
                                desc: "Xem điểm các bài đã thi.",
                                actionText: "Xem bảng điểm",
                                iconEmoji: "📊",
                                onClick: () =>
                                    context.push('/student-dashboard/results'),
                              ),
                              const SizedBox(height: 12),
                              StudentActionCard(
                                title: "Hồ sơ",
                                desc: "Cập nhật thông tin cá nhân, avatar.",
                                actionText: "Cập nhật",
                                iconEmoji: "👤",
                                onClick: () => context.push('/profile'),
                              ),
                              const SizedBox(height: 12),
                              StudentActionCard(
                                title: "Hướng dẫn & Trợ giúp",
                                desc:
                                    "Quy tắc chống gian lận & liên hệ hỗ trợ.",
                                actionText: "Xem hướng dẫn",
                                iconEmoji: "🛡️",
                                onClick: () => context.push(
                                  '/student-dashboard/guidelines',
                                ),
                              ),
                              const SizedBox(height: 12),
                              StudentActionCard(
                                title: "Trợ giúp",
                                desc: "Liên hệ hỗ trợ khi gặp lỗi.",
                                actionText: "Gửi yêu cầu",
                                iconEmoji: "❓",
                                onClick: () =>
                                    context.push('/student-dashboard/support'),
                              ),
                            ],
                          ),

                          const SizedBox(height: 24),

                          // 5. Bảng kết quả gần đây
                          RecentResultsTable(
                            results: data.recentResults,
                            onViewAll: () =>
                                context.push('/student-dashboard/results'),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              ],
            );
          }

          return const SizedBox.shrink();
        },
      ),
    );
  }
}
