import 'package:dartz/dartz.dart';
import '../../../../../core/error/failures.dart';
import '../entities/student_dashboard_data_entity.dart';
import '../entities/student_profile_entity.dart';
import '../entities/student_result_entity.dart';
import '../entities/student_stats_entity.dart';
import '../repositories/student_dashboard_repository.dart';

class GetStudentDashboardDataUseCase {
  final StudentDashboardRepository repository;

  GetStudentDashboardDataUseCase(this.repository);

  Future<Either<Failure, StudentDashboardDataEntity>> call() async {
    // 1. GỌI API SONG SONG (Lấy Profile & Kết quả) để tiết kiệm thời gian
    final resultsFuture = repository.getMyResults();
    final profileFuture = repository.getProfile();

    final resultsResponse = await resultsFuture;
    final profileResponse = await profileFuture;

    // Nếu lỗi API, trả về Failure ngay lập tức
    if (resultsResponse.isLeft()) {
      return Left(resultsResponse.fold((l) => l, (r) => throw Exception()));
    }
    if (profileResponse.isLeft()) {
      return Left(profileResponse.fold((l) => l, (r) => throw Exception()));
    }

    // Lấy dữ liệu thô
    final allResults = resultsResponse.getOrElse(() => []);
    final profile = profileResponse.getOrElse(
      () => StudentProfileEntity(fullName: 'Người dùng', avatar: ''),
    );

    // 2. XỬ LÝ BUSINESS LOGIC: LỌC TRÙNG & TÌM ĐIỂM TỐT NHẤT
    Map<String, StudentResultEntity> examMap = {};

    for (var r in allResults) {
      final examId = r.examId ?? '';
      if (examId.isEmpty) continue;

      final currentScore = r.suggestedTotalScore ?? r.totalScore ?? 0.0;
      final existing = examMap[examId];
      final existingScore =
          existing?.suggestedTotalScore ?? existing?.totalScore ?? 0.0;

      if (existing == null) {
        examMap[examId] = r;
      } else {
        // Ưu tiên 1: Bài đã được giảng viên duyệt (instructor_confirmed = 1)
        final currentConfirmed =
            r.instructorConfirmed == 1 || r.status == 'confirmed';
        final existingConfirmed =
            existing.instructorConfirmed == 1 || existing.status == 'confirmed';

        if (currentConfirmed && !existingConfirmed) {
          examMap[examId] = r;
        } else if (!currentConfirmed && existingConfirmed) {
          // Giữ nguyên existing, không làm gì cả
        } else {
          // Ưu tiên 2: Nếu cùng trạng thái duyệt, lấy điểm cao hơn
          if (currentScore > existingScore) {
            examMap[examId] = r;
          }
        }
      }
    }

    // 3. SẮP XẾP TỪ MỚI NHẤT -> CŨ NHẤT
    final filteredResults = examMap.values.toList();
    filteredResults.sort((a, b) {
      final dateA =
          DateTime.tryParse(a.submittedAt ?? '')?.toLocal() ??
          DateTime.fromMillisecondsSinceEpoch(0);
      final dateB =
          DateTime.tryParse(b.submittedAt ?? '')?.toLocal() ??
          DateTime.fromMillisecondsSinceEpoch(0);
      return dateB.compareTo(dateA);
    });

    // 4. TÍNH TOÁN CÁC CHỈ SỐ THỐNG KÊ (STATS)
    final n = filteredResults.length;
    double best = 0.0;
    double sum = 0.0;
    int passCount = 0;

    for (var r in filteredResults) {
      final score = r.suggestedTotalScore ?? r.totalScore ?? 0.0;
      if (score > best) best = score;
      sum += score;
      if (score >= 5.0) passCount++;
    }

    final avg = n > 0 ? sum / n : 0.0;
    final passRate = n > 0 ? ((passCount / n) * 100).round() : 0;

    // 5. CHUẨN BỊ MẢNG BIỂU ĐỒ 7 NGÀY (CHART DATA)
    final now = DateTime.now();
    List<int> chartDataTotal = [];
    List<double> chartDataAvg = [];
    List<double> chartDataBest = [];
    List<double> chartDataRecent = [];

    // Lặp từ 6 ngày trước về 0 (hôm nay)
    for (int daysAgo = 6; daysAgo >= 0; daysAgo--) {
      // Ép thời gian về đúng 00:00:00 của ngày hôm đó
      final targetDate = DateTime(
        now.year,
        now.month,
        now.day,
      ).subtract(Duration(days: daysAgo));
      final nextDate = targetDate.add(const Duration(days: 1));

      // Lọc ra các bài thi nộp trong ngày này
      final dayResults = filteredResults.where((r) {
        if (r.submittedAt == null) return false;
        final submitDate = DateTime.tryParse(r.submittedAt!)?.toLocal();
        if (submitDate == null) return false;

        return (submitDate.isAtSameMomentAs(targetDate) ||
                submitDate.isAfter(targetDate)) &&
            submitDate.isBefore(nextDate);
      }).toList();

      chartDataTotal.add(dayResults.length);

      if (dayResults.isEmpty) {
        chartDataAvg.add(0.0);
        chartDataBest.add(0.0);
        chartDataRecent.add(0.0);
      } else {
        double daySum = 0.0;
        double dayBest = 0.0;
        for (var r in dayResults) {
          final s = r.suggestedTotalScore ?? r.totalScore ?? 0.0;
          daySum += s;
          if (s > dayBest) dayBest = s;
        }

        chartDataAvg.add(daySum / dayResults.length);
        chartDataBest.add(dayBest);

        // Vì filteredResults đã sort giảm dần theo Date, nên dayResults[0] chắc chắn là bài nộp gần nhất trong ngày đó
        chartDataRecent.add(
          dayResults[0].suggestedTotalScore ?? dayResults[0].totalScore ?? 0.0,
        );
      }
    }

    // 6. ĐÓNG GÓI VÀ TRẢ VỀ CHO BLOC
    final stats = StudentStatsEntity(
      totalExams: n,
      bestScore: best,
      averageScore: avg,
      passRate: passRate,
      chartDataTotal: chartDataTotal,
      chartDataAvg: chartDataAvg,
      chartDataBest: chartDataBest,
      chartDataRecent: chartDataRecent,
    );

    final dashboardData = StudentDashboardDataEntity(
      profile: profile,
      recentResults:
          filteredResults, // Có thể UI sẽ tự .take(6) hoặc .take(7) sau
      stats: stats,
    );

    return Right(dashboardData);
  }
}
