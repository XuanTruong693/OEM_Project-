import '../entities/result_item_entity.dart';

class FilterResultsParams {
  final List<ResultItemEntity> rawResults;
  final String searchQuery;
  final String sortType; // 'date_desc', 'score_desc', 'score_asc'

  FilterResultsParams({
    required this.rawResults,
    required this.searchQuery,
    required this.sortType,
  });
}

class FilterResultsUseCase {
  // UseCase này không cần Repository vì nó chỉ xử lý data có sẵn trên RAM
  List<ResultItemEntity> call(FilterResultsParams params) {
    // 1. Lọc theo từ khóa tìm kiếm (Tên bài thi hoặc Mã bài thi)
    final q = params.searchQuery.toLowerCase();
    var filteredList = params.rawResults.where((r) {
      final title = (r.examTitle).toLowerCase();
      final id = (r.examId).toLowerCase();
      return title.contains(q) || id.contains(q);
    }).toList();

    // 2. Lọc trùng lặp bài thi (Dùng Map)
    final Map<String, ResultItemEntity> examMap = {};

    for (var r in filteredList) {
      final examId = r.examId;
      final existing = examMap[examId];
      final currentScore = r.suggestedTotalScore ?? r.totalScore ?? 0.0;
      final existingScore =
          existing?.suggestedTotalScore ?? existing?.totalScore ?? 0.0;

      if (existing == null) {
        examMap[examId] = r;
      } else {
        // Ưu tiên 1: instructor_confirmed = 1 hoặc status = 'confirmed'
        final currentConfirmed =
            r.instructorConfirmed == 1 || r.status == 'confirmed';
        final existingConfirmed =
            existing.instructorConfirmed == 1 || existing.status == 'confirmed';

        if (currentConfirmed && !existingConfirmed) {
          examMap[examId] = r;
        } else if (!currentConfirmed && existingConfirmed) {
          // Giữ nguyên bài cũ, không làm gì cả
        } else {
          // Nếu cùng trạng thái duyệt hoặc cùng chưa duyệt -> Lấy điểm cao hơn
          if (currentScore > existingScore) {
            examMap[examId] = r;
          }
        }
      }
    }

    // Biến Map trở lại thành List
    var finalList = examMap.values.toList();

    // 3. Sắp xếp danh sách (Sort)
    if (params.sortType == 'score_desc') {
      finalList.sort((a, b) {
        final scoreA = a.suggestedTotalScore ?? a.totalScore ?? 0.0;
        final scoreB = b.suggestedTotalScore ?? b.totalScore ?? 0.0;
        return scoreB.compareTo(scoreA); // Cao đến thấp
      });
    } else if (params.sortType == 'score_asc') {
      finalList.sort((a, b) {
        final scoreA = a.suggestedTotalScore ?? a.totalScore ?? 0.0;
        final scoreB = b.suggestedTotalScore ?? b.totalScore ?? 0.0;
        return scoreA.compareTo(scoreB); // Thấp đến cao
      });
    } else {
      // Mặc định: date_desc (Mới nhất)
      finalList.sort((a, b) {
        final dateA =
            DateTime.tryParse(a.submittedAt) ??
            DateTime.fromMillisecondsSinceEpoch(0);
        final dateB =
            DateTime.tryParse(b.submittedAt) ??
            DateTime.fromMillisecondsSinceEpoch(0);
        return dateB.compareTo(dateA);
      });
    }

    return finalList;
  }
}
