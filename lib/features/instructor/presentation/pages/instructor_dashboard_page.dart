import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import 'package:mobile/features/instructor/presentation/bloc/instructor_dashboard_bloc.dart';
import 'package:mobile/features/instructor/presentation/bloc/instructor_dashboard_event.dart';
import 'package:mobile/features/instructor/presentation/bloc/instructor_dashboard_state.dart';
import 'package:mobile/features/instructor/presentation/bloc/instructor_overlay_bloc.dart';
import 'package:mobile/features/instructor/presentation/bloc/instructor_overlay_event.dart';
import 'package:mobile/features/instructor/presentation/widgets/summary_card.dart';
import 'package:mobile/features/instructor/presentation/widgets/instructor_drawer.dart';
import 'package:mobile/features/instructor/presentation/widgets/instructor_chart.dart';
import 'package:mobile/core/utils/image_utils.dart';

class InstructorDashboardPage extends StatefulWidget {
  const InstructorDashboardPage({super.key});

  @override
  State<InstructorDashboardPage> createState() =>
      _InstructorDashboardPageState();
}

class _InstructorDashboardPageState extends State<InstructorDashboardPage> {
  @override
  void initState() {
    super.initState();
    context.read<InstructorDashboardBloc>().add(LoadDashboardDataEvent());
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.grey[50],
      drawer: const InstructorDrawer(currentRoute: '/instructor-dashboard'),
      appBar: AppBar(
        elevation: 0,
        backgroundColor: Colors.white,
        iconTheme: const IconThemeData(color: Colors.black87),
        title: const Text(
          "Dashboard",
          style: TextStyle(color: Colors.black87, fontWeight: FontWeight.bold),
        ),
        actions: [
          BlocBuilder<InstructorDashboardBloc, InstructorDashboardState>(
            builder: (context, state) {
              if (state is DashboardLoaded) {
                return Padding(
                  padding: const EdgeInsets.only(right: 16),
                  child: GestureDetector(
                    onTap: () => context.push('/profile'),
                    behavior: HitTestBehavior.opaque,
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          crossAxisAlignment: CrossAxisAlignment.end,
                          children: [
                            const Text(
                              "Xin chào,",
                              style: TextStyle(
                                color: Colors.grey,
                                fontSize: 12,
                              ),
                            ),
                            Text(
                              state.fullName,
                              style: const TextStyle(
                                color: Colors.black87,
                                fontWeight: FontWeight.bold,
                                fontSize: 14,
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(width: 10),
                        CircleAvatar(
                          backgroundImage: state.avatar.isNotEmpty
                              ? NetworkImage(
                                  ImageUtils.getFullImageUrl(state.avatar),
                                )
                              : const AssetImage(
                                      'assets/images/default-avatar.png',
                                    )
                                    as ImageProvider,
                          radius: 18,
                        ),
                      ],
                    ),
                  ),
                );
              }
              return const SizedBox.shrink();
            },
          ),
        ],
      ),
      body: BlocListener<InstructorDashboardBloc, InstructorDashboardState>(
        listener: (context, state) {
          if (state is DashboardLoaded && state.examIds.isNotEmpty) {
            // Kích hoạt nhận thông báo gian lận cho tất cả các đề thi của giảng viên này
            context.read<InstructorOverlayBloc>().add(
              JoinInstructorExamsEvent(state.examIds),
            );
          }
        },
        child: BlocBuilder<InstructorDashboardBloc, InstructorDashboardState>(
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
                      "Lỗi: ${state.message}",
                      style: const TextStyle(color: Colors.red),
                    ),
                    ElevatedButton(
                      onPressed: () => context
                          .read<InstructorDashboardBloc>()
                          .add(LoadDashboardDataEvent()),
                      child: const Text("Thử lại"),
                    ),
                  ],
                ),
              );
            }

            if (state is DashboardLoaded) {
              return RefreshIndicator(
                onRefresh: () async {
                  context.read<InstructorDashboardBloc>().add(
                    LoadDashboardDataEvent(),
                  );
                },
                child: SingleChildScrollView(
                  physics: const AlwaysScrollableScrollPhysics(),
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      SummaryCard(
                        title: "Tổng số đề đã tạo",
                        value: state.stats.totalExamsCreated.toString(),
                        iconBackgroundColor: Colors.green,
                        iconPath: 'assets/images/report.png',
                        linkText: "Xem",
                        onTap: () {
                          context.push('/instructor-dashboard/exams');
                        },
                      ),
                      const SizedBox(height: 16),
                      SummaryCard(
                        title: "Tổng số bài kiểm tra",
                        value: state.stats.totalTestsSubmitted.toString(),
                        iconBackgroundColor: Colors.red,
                        iconPath: 'assets/images/totalExam.png',
                        linkText: "Xem",
                        onTap: () {
                          context.push('/instructor-dashboard/submissions');
                        },
                      ),
                      const SizedBox(height: 16),
                      SummaryCard(
                        title: "Tổng số thí sinh đã thi",
                        value: state.stats.totalStudentsParticipated.toString(),
                        iconBackgroundColor: Colors.purple,
                        iconPath: 'assets/images/studentGroup.png',
                        linkText: "Xem",
                        onTap: () {
                          context.push('/instructor-dashboard/students');
                        },
                      ),
                      const SizedBox(height: 30),
                      const Text(
                        "Thống kê theo tháng",
                        style: TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.bold,
                          color: Colors.black87,
                        ),
                      ),
                      const SizedBox(height: 16),
                      InstructorChart(
                        title: "Tổng số đề (Total Exams)",
                        data: state.monthlyData,
                        lineColor: Colors.blueAccent,
                        fillColor: Colors.blue,
                        isExams: true,
                      ),
                      const SizedBox(height: 20),
                      InstructorChart(
                        title: "Tổng số thí sinh (Total Students)",
                        data: state.monthlyData,
                        lineColor: Colors.pinkAccent,
                        fillColor: Colors.pink,
                        isExams: false,
                      ),
                      const SizedBox(height: 30),
                    ],
                  ),
                ),
              );
            }
            return const SizedBox.shrink();
          },
        ),
      ),
    );
  }
}
