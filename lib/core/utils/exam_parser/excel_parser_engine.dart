import 'parser_models.dart';

class ExcelParserEngine {
  static ExamParseResult parse(List<List<String>> jsonData) {
    if (jsonData.length < 2) {
      throw Exception("File Excel phải có ít nhất 1 dòng dữ liệu");
    }

    final List<ParsedQuestion> questions = [];
    String? currentSection;
    bool hasMCQMarker = false;
    bool hasEssayMarker = false;

    // 👉 Regex chuẩn để lấy điểm (hỗ trợ cả 2đ, 2.5đ, 2 points, 1,5 pts)
    final pointRegex = RegExp(
      r'[([]?\s*(\d+(?:[.,]\d+)?)\s*(?:points?|đ|pts)\s*[)\]]?',
      caseSensitive: false,
    );

    for (int i = 0; i < jsonData.length; i++) {
      final row = jsonData[i];
      if (row.isEmpty) continue;

      final rowText = row.join(" ").trim();
      final lowerRowText = rowText.toLowerCase();

      // Kiểm tra Marker
      if (lowerRowText.contains("trắc nghiệm") &&
          lowerRowText.contains("mcq")) {
        currentSection = "MCQ";
        hasMCQMarker = true;
        continue;
      } else if (lowerRowText.contains("tự luận") &&
          lowerRowText.contains("essay")) {
        currentSection = "Essay";
        hasEssayMarker = true;
        continue;
      }

      if (currentSection == null || rowText.isEmpty) continue;

      if (currentSection == "MCQ") {
        final questionText = row.isNotEmpty ? row[0].trim() : "";
        if (questionText.isEmpty) continue;

        final cleanedQuestionText = questionText
            .replaceAll(
              RegExp(r'^(?:Câu|Question)?\s*\d+[:.]?\s*', caseSensitive: false),
              "",
            )
            .trim();

        // 👉 ĐÃ FIX: LẤY ĐIỂM SỐ CHO MCQ TẠI ĐÂY
        final pointMatch = pointRegex.firstMatch(questionText);
        double? points;
        if (pointMatch != null) {
          points = double.tryParse(pointMatch.group(1)!.replaceAll(',', '.'));
        }

        List<String> options = [];
        for (int j = 1; j <= 4; j++) {
          if (row.length > j && row[j].trim().isNotEmpty) {
            options.add(row[j].trim());
          }
        }

        int? correctOption;
        List<String> cleanOptions = [];
        for (int idx = 0; idx < options.length; idx++) {
          String opt = options[idx];
          if (opt.endsWith("*")) {
            correctOption = idx;
            opt = opt.replaceAll(RegExp(r'\*+$'), '').trim();
          }
          cleanOptions.add(opt);
        }

        List<String> errors = [];
        if (options.length < 2) {
          errors.add("Câu hỏi trắc nghiệm phải có ít nhất 2 đáp án");
        }
        if (correctOption == null && options.isNotEmpty) {
          errors.add(
            "Không tìm thấy đáp án đúng (cần đánh dấu * ở cuối đáp án)",
          );
        }
        if (points == null) errors.add("Thiếu điểm câu hỏi (ví dụ: (0.5đ))");

        questions.add(
          ParsedQuestion(
            row: i + 1,
            type: "MCQ",
            questionText: cleanedQuestionText,
            originalQuestionText: questionText,
            options: cleanOptions,
            correctOption: correctOption,
            points: points, // 👉 Lưu điểm số vào Entity
            errors: errors,
          ),
        );
      } else if (currentSection == "Essay") {
        final cleanedFullText = rowText
            .replaceAll(
              RegExp(r'^(?:Câu|Question)?\s*\d+[:.]?\s*', caseSensitive: false),
              "",
            )
            .trim();

        final questionMatch =
            RegExp(
              r'(?:Câu hỏi|Câu\s*\d+)\s*[:.]?\s*(.+?)(?=Câu trả lời|Đáp án|$)',
              caseSensitive: false,
              dotAll: true,
            ).firstMatch(cleanedFullText) ??
            RegExp(
              r'(.+?)(?=Câu trả lời|Đáp án|$)',
              caseSensitive: false,
              dotAll: true,
            ).firstMatch(cleanedFullText);

        final answerMatch = RegExp(
          r'(?:Câu trả lời|Đáp án)\s*[:.]?\s*(.+)',
          caseSensitive: false,
          dotAll: true,
        ).firstMatch(cleanedFullText);

        // 👉 CẬP NHẬT: Dùng chung Regex điểm chuẩn cho cả Tự luận
        final pointMatch = pointRegex.firstMatch(cleanedFullText);
        double? points;
        if (pointMatch != null) {
          points = double.tryParse(pointMatch.group(1)!.replaceAll(',', '.'));
        }

        if (questionMatch != null || answerMatch != null) {
          List<String> errors = [];
          if (questionMatch == null) {
            errors.add('Không tìm thấy "Câu hỏi:" trong văn bản');
          }
          if (answerMatch == null) {
            errors.add('Không tìm thấy "Câu trả lời:" trong văn bản');
          }
          if (points == null) errors.add("Thiếu điểm câu hỏi (ví dụ: (2đ))");

          questions.add(
            ParsedQuestion(
              row: i + 1,
              type: "Essay",
              questionText: questionMatch?.group(1)?.trim() ?? "",
              originalQuestionText: rowText,
              modelAnswer: answerMatch?.group(1)?.trim() ?? "",
              points: points, // 👉 Lưu điểm số
              errors: errors,
            ),
          );
        }
      }
    }

    // KIỂM TRA TRÙNG LẶP
    List<String> duplicateErrors = [];
    Map<String, int> seenQuestions = {};

    for (var q in questions) {
      if (q.questionText.isEmpty) continue;
      final normalizedText = q.questionText
          .toLowerCase()
          .replaceAll(RegExp(r'\s+'), ' ')
          .trim();

      if (seenQuestions.containsKey(normalizedText)) {
        final firstRow = seenQuestions[normalizedText];
        duplicateErrors.add(
          'Câu hỏi trùng lặp tại dòng ${q.row} và dòng $firstRow: "${q.questionText.length > 60 ? "${q.questionText.substring(0, 60)}..." : q.questionText}"',
        );
      } else {
        seenQuestions[normalizedText] = q.row;
      }
    }

    if (duplicateErrors.isNotEmpty) {
      throw Exception(
        "❌ Phát hiện câu hỏi trùng lặp!\n\n${duplicateErrors.join('\n')}\n\nVui lòng xóa các câu hỏi trùng lặp và thử lại.",
      );
    }

    if (!hasMCQMarker && !hasEssayMarker) {
      throw Exception(
        "❌ File thiếu marker phân loại!\nFile Excel của bạn PHẢI có ít nhất 1 marker: 'Trắc nghiệm (MCQ)' hoặc 'Tự luận (Essay)'.",
      );
    }

    // Gộp và đánh số lại
    final mcqQuestions = questions.where((q) => q.type == "MCQ").toList();
    final essayQuestions = questions.where((q) => q.type == "Essay").toList();
    final sortedQuestions = [...mcqQuestions, ...essayQuestions];

    for (int j = 0; j < sortedQuestions.length; j++) {
      sortedQuestions[j].row = j + 1;
    }

    return ExamParseResult(
      questions: sortedQuestions,
      total: sortedQuestions.length,
      mcqCount: mcqQuestions.length,
      essayCount: essayQuestions.length,
      errorCount: sortedQuestions.where((q) => q.errors.isNotEmpty).length,
      validationErrors: [],
    );
  }
}
