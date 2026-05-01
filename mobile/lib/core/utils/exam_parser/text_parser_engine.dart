import 'parser_models.dart';
import 'regex_patterns.dart';

class TextParserEngine {
  static ExamParseResult parse(String text) {
    final lines = text
        .split(RegExp(r'\r?\n'))
        .map((e) => e.trim())
        .where((e) => e.isNotEmpty)
        .toList();
    final List<ParsedQuestion> questions = [];
    String? currentSection;
    bool hasMCQMarker = false;
    bool hasEssayMarker = false;
    int i = 0;
    String contextText = "";

    while (i < lines.length) {
      final line = lines[i];
      final lowerLine = line.toLowerCase();

      // Phát hiện Section
      if (lowerLine.contains("trắc nghiệm") || lowerLine.contains("mcq")) {
        currentSection = "MCQ";
        hasMCQMarker = true;
        contextText = "";
        i++;
        continue;
      } else if (lowerLine.contains("tự luận") || lowerLine.contains("essay")) {
        currentSection = "Essay";
        hasEssayMarker = true;
        contextText = "";
        i++;
        continue;
      }

      if (currentSection == null) {
        i++;
        continue;
      }

      if (currentSection == "MCQ") {
        final pointMatch = RegexPatterns.scorePattern.firstMatch(line);
        double? points;
        if (pointMatch != null) {
          points = double.tryParse(pointMatch.group(1)!.replaceAll(',', '.'));
        }

        int questionLineIndex = i;
        if (pointMatch != null && line.length < 25 && !line.contains("?")) {
          questionLineIndex = i + 1;
        }

        if (questionLineIndex < lines.length) {
          final qLine = lines[questionLineIndex];
          final isQuestion =
              RegexPatterns.questionPrefixPattern.hasMatch(qLine) ||
              (!RegexPatterns.optionPrefixPattern.hasMatch(qLine) &&
                  qLine.length > 10);

          if (isQuestion) {
            String questionText = qLine;
            final innerPointMatch = RegexPatterns.scorePattern.firstMatch(
              questionText,
            );
            if (innerPointMatch != null) {
              points = double.tryParse(
                innerPointMatch.group(1)!.replaceAll(',', '.'),
              );
            }

            questionText = questionText
                .replaceAll(RegexPatterns.questionPrefixPattern, "")
                .trim();

            List<String> options = [];
            int? correctOption;
            int nextI = questionLineIndex + 1;

            while (nextI < lines.length && options.length < 10) {
              String optLine = lines[nextI];
              if (RegexPatterns.optionPrefixPattern.hasMatch(optLine)) {
                if (optLine.trim().startsWith("*") ||
                    optLine.trim().endsWith("*")) {
                  correctOption = options.length;
                  optLine = optLine.replaceAll('*', '').trim();
                }
                final cleanOpt = optLine
                    .replaceAll(RegexPatterns.optionPrefixPattern, "")
                    .trim();
                options.add(cleanOpt);
                nextI++;
              } else {
                break;
              }
            }

            if (options.length >= 2) {
              List<String> qErrors = [];
              if (correctOption == null) {
                qErrors.add("Thiếu đáp án đúng (đánh dấu *)");
              }
              if (points == null) {
                qErrors.add("Thiếu điểm câu hỏi (ví dụ: (0.1đ))");
              }

              questions.add(
                ParsedQuestion(
                  row: questions.length + 1,
                  type: "MCQ",
                  questionText: questionText,
                  originalQuestionText: qLine,
                  options: options,
                  correctOption: correctOption,
                  points: points,
                  errors: qErrors,
                ),
              );
              i = nextI;
              continue;
            }
          }
        }
      } else if (currentSection == "Essay") {
        // Tự luận ngắn: Câu hỏi → {Đáp án} (Điểm)
        final shortMatch = RegExp(
          r'(.+?)\s*→\s*\{(.*?)\}\s*\((\d+(?:[.,]\d+)?)\s*(?:points?|đ)\)',
          caseSensitive: false,
        ).firstMatch(line);
        if (shortMatch != null) {
          final ans = shortMatch
              .group(2)!
              .replaceAll(RegExp(r'^\*'), '')
              .trim();
          final pts = double.tryParse(
            shortMatch.group(3)!.replaceAll(',', '.'),
          );
          List<String> qErrors = [];
          if (pts == null) qErrors.add("Thiếu điểm câu hỏi");

          String qText = line
              .replaceAll(RegExp(r'\s*→.+'), '')
              .replaceAll(RegexPatterns.questionPrefixPattern, '')
              .trim();

          questions.add(
            ParsedQuestion(
              row: questions.length + 1,
              type: "Essay",
              questionText:
                  (contextText.isNotEmpty ? "$contextText\n" : "") + qText,
              originalQuestionText: line,
              modelAnswer: ans,
              points: pts,
              errors: qErrors,
            ),
          );
          contextText = "";
          i++;
          continue;
        }

        // Tự luận dài
        final longMatch = RegexPatterns.scorePattern.firstMatch(line);
        if (longMatch != null &&
            !RegexPatterns.optionPrefixPattern.hasMatch(line)) {
          final pts = double.tryParse(longMatch.group(1)!.replaceAll(',', '.'));
          String modelAnswer = "";
          int nextI = i + 1;

          while (nextI < lines.length) {
            final nextLine = lines[nextI];
            if (nextLine.toLowerCase().startsWith("đáp án")) {
              nextI++;
              while (nextI < lines.length) {
                final ansLine = lines[nextI];
                if (RegexPatterns.scorePattern.hasMatch(ansLine) ||
                    RegexPatterns.questionPrefixPattern.hasMatch(ansLine) ||
                    ansLine.toLowerCase().contains("trắc nghiệm") ||
                    ansLine.toLowerCase().contains("tự luận")) {
                  break;
                }
                modelAnswer += (modelAnswer.isNotEmpty ? "\n" : "") + ansLine;
                nextI++;
              }
              break;
            }
            if (RegexPatterns.scorePattern.hasMatch(nextLine) ||
                RegexPatterns.questionPrefixPattern.hasMatch(nextLine)) {
              break;
            }
            nextI++;
          }

          String qText = line
              .replaceAll(RegexPatterns.questionPrefixPattern, '')
              .trim();

          questions.add(
            ParsedQuestion(
              row: questions.length + 1,
              type: "Essay",
              questionText:
                  (contextText.isNotEmpty ? "$contextText\n" : "") + qText,
              originalQuestionText: line,
              modelAnswer: modelAnswer.trim(),
              points: pts,
              errors: modelAnswer.trim().isEmpty
                  ? ["Thiếu câu trả lời mẫu (Đáp án)"]
                  : [],
            ),
          );
          contextText = "";
          i = nextI;
          continue;
        }

        if (!lowerLine.contains("tự luận") &&
            !lowerLine.contains("trắc nghiệm")) {
          contextText += (contextText.isNotEmpty ? "\n" : "") + line;
        }
      }
      i++;
    }

    if (questions.isEmpty) {
      throw Exception(
        "⚠️ Không tìm thấy câu hỏi hợp lệ trong file. Vui lòng kiểm tra lại định dạng.",
      );
    }

    // Gộp và thống kê
    final mcqQuestions = questions.where((q) => q.type == "MCQ").toList();
    final essayQuestions = questions.where((q) => q.type == "Essay").toList();
    final sortedQuestions = [...mcqQuestions, ...essayQuestions];

    // Cập nhật lại số row sau khi sort (đánh số tự động)
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
