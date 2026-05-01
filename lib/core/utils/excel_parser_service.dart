// Onley use for EDITING EXAM funtionality, not for ASSIGN EXAM
import 'package:excel/excel.dart';
import '../../features/exam_management/data/models/question_model.dart';
import '../../features/exam_management/data/models/option_model.dart';

class ExcelParserService {
  // Regex lấy điểm giống React: (1.5 đ) hoặc (1,5 đ)
  static final RegExp scorePattern = RegExp(
    r'\(([\d.,]+)\s*đ\)',
    caseSensitive: false,
  );

  /// Nhận vào mảng bytes của file (để chạy an toàn trên cả Mobile & Web)
  Future<List<QuestionModel>> parseExcelToQuestions(List<int> bytes) async {
    final List<QuestionModel> out = [];

    try {
      var excel = Excel.decodeBytes(bytes);

      // Lấy sheet đầu tiên
      final sheetName = excel.tables.keys.first;
      final sheet = excel.tables[sheetName]!;

      String? currentSection; // 'MCQ' hoặc 'essay'

      // Lặp qua từng dòng (Bắt đầu từ 0)
      for (int r = 0; r < sheet.maxRows; r++) {
        final row = sheet.rows[r];
        if (row.isEmpty) continue;

        // Lấy giá trị ô A (Cột 0) an toàn
        final cellA = row[0]?.value?.toString().trim() ?? '';
        if (cellA.isEmpty) continue;

        final lowerA = cellA.toLowerCase();

        // 1. Nhận diện Section (Phần)
        if (lowerA.contains('trắc nghiệm') || lowerA.contains('mcq')) {
          currentSection = 'MCQ';
          continue;
        }
        if (lowerA.contains('tự luận') || lowerA.contains('essay')) {
          currentSection = 'essay';
          continue;
        }

        // 2. Xử lý câu hỏi Trắc nghiệm (MCQ)
        if (currentSection == 'MCQ') {
          final match = scorePattern.firstMatch(cellA);
          // Thay dấu phẩy thành dấu chấm để parse số thập phân an toàn
          final points = match != null
              ? double.tryParse(match.group(1)!.replaceAll(',', '.')) ?? 0.0
              : 0.0;
          final content = cellA.replaceAll(scorePattern, '').trim();

          final List<OptionModel> options = [];

          // Lặp qua các cột từ B trở đi (Cột 1, 2, 3...) để lấy đáp án
          for (int c = 1; c < row.length; c++) {
            final cellValue = row[c]?.value?.toString().trim() ?? '';
            if (cellValue.isEmpty) continue;

            final isCorrect = cellValue.endsWith('*');
            final optContent = cellValue.replaceAll(RegExp(r'\*+$'), '').trim();

            options.add(
              OptionModel(
                id: 'temp-${DateTime.now().millisecondsSinceEpoch}-$r-$c',
                content: optContent,
                isCorrect: isCorrect,
              ),
            );
          }

          out.add(
            QuestionModel(
              id: 'temp-${DateTime.now().millisecondsSinceEpoch}-$r',
              type: 'MCQ',
              content: content,
              points: points,
              options: options,
              modelAnswer: '',
            ),
          );
          continue;
        }

        // 3. Xử lý câu hỏi Tự luận (Essay)
        if (currentSection == 'essay') {
          // Gộp toàn bộ text của row thành 1 chuỗi để check Regex giống React
          final joined = row
              .map((c) => c?.value?.toString().trim() ?? '')
              .join(' ');

          // Lấy câu hỏi (Từ "Câu hỏi:" đến "Câu trả lời:" hoặc hết dòng)
          final qMatch = RegExp(
            r'Câu\s*hỏi:\s*(.*?)(?=Câu\s*trả\s*lời:|$)',
            caseSensitive: false,
          ).firstMatch(joined);
          // Lấy câu trả lời mẫu
          final aMatch = RegExp(
            r'Câu\s*trả\s*lời:\s*(.*)$',
            caseSensitive: false,
          ).firstMatch(joined);
          final m = scorePattern.firstMatch(joined);

          final points = m != null
              ? double.tryParse(m.group(1)!.replaceAll(',', '.')) ?? 0.0
              : 0.0;
          final content = (qMatch?.group(1) ?? cellA)
              .replaceAll(scorePattern, '')
              .trim();
          final modelAnswer = aMatch?.group(1)?.trim() ?? '';

          out.add(
            QuestionModel(
              id: 'temp-${DateTime.now().millisecondsSinceEpoch}-$r',
              type: 'essay',
              content: content,
              points: points,
              options: [],
              modelAnswer: modelAnswer,
            ),
          );
          continue;
        }

        // 4. Fallback: Auto-detect nếu file không có ghi rõ Section
        final match = scorePattern.firstMatch(cellA);
        if (match != null) {
          final points =
              double.tryParse(match.group(1)!.replaceAll(',', '.')) ?? 0.0;
          final content = cellA.replaceAll(scorePattern, '').trim();

          final List<OptionModel> options = [];
          for (int c = 1; c < row.length; c++) {
            final cellValue = row[c]?.value?.toString().trim() ?? '';
            if (cellValue.isEmpty) continue;

            final isCorrect = cellValue.endsWith('*');
            final optContent = cellValue.replaceAll(RegExp(r'\*+$'), '').trim();

            options.add(
              OptionModel(
                id: 'temp-fallback-${DateTime.now().millisecondsSinceEpoch}-$r-$c',
                content: optContent,
                isCorrect: isCorrect,
              ),
            );
          }

          if (options.isNotEmpty) {
            out.add(
              QuestionModel(
                id: 'temp-fb-$r',
                type: 'MCQ',
                content: content,
                points: points,
                options: options,
                modelAnswer: '',
              ),
            );
          } else {
            out.add(
              QuestionModel(
                id: 'temp-fb-$r',
                type: 'essay',
                content: content,
                points: points,
                options: [],
                modelAnswer: '',
              ),
            );
          }
        }
      }
    } catch (e) {
      throw Exception(
        "Đọc file Excel thất bại. Vui lòng kiểm tra lại định dạng file. Chi tiết: $e",
      );
    }

    return out;
  }
}
