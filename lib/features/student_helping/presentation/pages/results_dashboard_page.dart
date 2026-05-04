import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../bloc/results_list/results_list_bloc.dart';
import '../bloc/results_list/results_list_event.dart';
import '../bloc/results_list/results_list_state.dart';
import '../widgets/results/result_card_widget.dart';
import '../widgets/results/search_sort_bar.dart';
import '../widgets/results/detail_modal_sheet.dart';

class ResultsDashboardPage extends StatefulWidget {
  const ResultsDashboardPage({super.key});

  @override
  State<ResultsDashboardPage> createState() => _ResultsDashboardPageState();
}

class _ResultsDashboardPageState extends State<ResultsDashboardPage> {
  @override
  void initState() {
    super.initState();
    // Gọi API Load data ngay khi vào trang
    context.read<ResultsListBloc>().add(LoadMyResultsEvent());
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      body: SafeArea(
        child: BlocBuilder<ResultsListBloc, ResultsListState>(
          builder: (context, state) {
            return CustomScrollView(
              physics: const BouncingScrollPhysics(),
              slivers: [
                // 1. Sticky Header
                SliverAppBar(
                  pinned: true,
                  backgroundColor: Colors.white.withOpacity(0.95),
                  elevation: 0.5,
                  leadingWidth: 100,
                  leading: TextButton.icon(
                    onPressed: () {
                      if (context.canPop()) {
                        context.pop();
                      } else {
                        context.go('/student-dashboard');
                      }
                    },
                    icon: const Icon(
                      Icons.arrow_back,
                      color: Color(0xFF334155),
                    ),
                    label: const Text(
                      'Quay lại',
                      style: TextStyle(
                        color: Color(0xFF334155),
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ),
                  title: Image.asset('assets/images/app_logo.png', height: 36, errorBuilder: (context, error, stackTrace) => const Icon(Icons.school, color: Colors.blue)),
                  centerTitle: true,
                  actions: [
                    Container(
                      margin: const EdgeInsets.only(
                        right: 16,
                        top: 10,
                        bottom: 10,
                      ),
                      padding: const EdgeInsets.symmetric(horizontal: 12),
                      decoration: BoxDecoration(
                        color: const Color(0xFFF8FAFC),
                        borderRadius: BorderRadius.circular(8),
                        border: Border.all(color: Colors.grey.shade200),
                      ),
                      child: Row(
                        children: [
                          const Icon(
                            Icons.calendar_today_outlined,
                            size: 16,
                            color: Color(0xFF64748B),
                          ),
                          const SizedBox(width: 8),
                          Text(
                            DateFormat('dd/MM/yyyy').format(DateTime.now()),
                            style: const TextStyle(
                              fontSize: 13,
                              color: Color(0xFF475569),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),

                // 2. Nội dung chính
                SliverToBoxAdapter(
                  child: Padding(
                    padding: const EdgeInsets.all(16.0),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        // Tiêu đề
                        const Text(
                          'Kết quả học tập',
                          style: TextStyle(
                            fontSize: 28,
                            fontWeight: FontWeight.bold,
                            color: Color(0xFF1E293B),
                          ),
                        ),
                        const SizedBox(height: 8),
                        const Text(
                          'Theo dõi điểm số và tiến độ của bạn',
                          style: TextStyle(
                            fontSize: 16,
                            color: Color(0xFF475569),
                          ),
                        ),
                        const SizedBox(height: 24),

                        // Search & Sort Bar
                        if (state is ResultsListLoaded)
                          SearchSortBar(
                            searchQuery: state.searchQuery,
                            sortType: state.sortType,
                            onSearchChanged: (q) => context
                                .read<ResultsListBloc>()
                                .add(SearchResultsEvent(q)),
                            onSortChanged: (type) => context
                                .read<ResultsListBloc>()
                                .add(SortResultsEvent(type)),
                          ),
                        const SizedBox(height: 24),
                      ],
                    ),
                  ),
                ),

                // 3. Danh sách kết quả
                if (state is ResultsListLoading)
                  const SliverFillRemaining(
                    child: Center(
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          CircularProgressIndicator(color: Colors.blue),
                          SizedBox(height: 16),
                          Text(
                            'Đang tải kết quả...',
                            style: TextStyle(color: Colors.grey),
                          ),
                        ],
                      ),
                    ),
                  )
                else if (state is ResultsListError)
                  SliverFillRemaining(
                    child: Center(
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          const Icon(
                            Icons.error_outline,
                            size: 48,
                            color: Colors.red,
                          ),
                          const SizedBox(height: 16),
                          Text(
                            state.message,
                            style: const TextStyle(color: Colors.red),
                          ),
                          const SizedBox(height: 16),
                          ElevatedButton(
                            onPressed: () => context
                                .read<ResultsListBloc>()
                                .add(LoadMyResultsEvent()),
                            child: const Text('Thử lại'),
                          ),
                        ],
                      ),
                    ),
                  )
                else if (state is ResultsListLoaded &&
                    state.filteredResults.isEmpty)
                  SliverFillRemaining(
                    child: Center(
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          const Text('📭', style: TextStyle(fontSize: 64)),
                          const SizedBox(height: 16),
                          Text(
                            state.searchQuery.isNotEmpty
                                ? 'Không tìm thấy kết quả'
                                : 'Chưa có bài thi nào',
                            style: const TextStyle(
                              fontSize: 20,
                              fontWeight: FontWeight.bold,
                              color: Color(0xFF1E293B),
                            ),
                          ),
                          const SizedBox(height: 8),
                          Text(
                            state.searchQuery.isNotEmpty
                                ? 'Thử tìm kiếm với từ khóa khác'
                                : 'Các bài thi đã hoàn thành sẽ hiển thị ở đây',
                            style: const TextStyle(color: Colors.grey),
                          ),
                        ],
                      ),
                    ),
                  )
                else if (state is ResultsListLoaded)
                  SliverPadding(
                    padding: const EdgeInsets.symmetric(horizontal: 16),
                    sliver: SliverList(
                      delegate: SliverChildBuilderDelegate((context, index) {
                        final result = state.filteredResults[index];
                        return ResultCardWidget(
                          result: result,
                          onViewAnswers: () => showDetailModalBottomSheet(
                            context,
                            result.submissionId,
                          ),
                        );
                      }, childCount: state.filteredResults.length),
                    ),
                  ),

                // 4. Footer thống kê
                if (state is ResultsListLoaded &&
                    state.filteredResults.isNotEmpty)
                  SliverToBoxAdapter(
                    child: Padding(
                      padding: const EdgeInsets.symmetric(vertical: 24),
                      child: Text(
                        'Hiển thị ${state.filteredResults.length} / ${state.rawResults.length} bài thi',
                        textAlign: TextAlign.center,
                        style: const TextStyle(
                          color: Colors.grey,
                          fontSize: 13,
                        ),
                      ),
                    ),
                  ),
              ],
            );
          },
        ),
      ),
    );
  }
}
