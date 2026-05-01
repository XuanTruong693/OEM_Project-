import 'dart:io';
import 'package:excel/excel.dart';
import 'package:syncfusion_flutter_pdf/pdf.dart';
import 'package:docx_to_text/docx_to_text.dart';

import '../../../../core/utils/exam_parser/text_parser_engine.dart';
import '../../../../core/utils/exam_parser/excel_parser_engine.dart';
import '../../domain/entities/assign_exam_result_entity.dart';
import '../../domain/entities/exam_summary_entity.dart';
import '../../domain/entities/question_preview_entity.dart';

abstract class AssignExamLocalDataSource {
  Future<AssignExamResultEntity> parseFile(File file, {String? sheetName});
}

class AssignExamLocalDataSourceImpl implements AssignExamLocalDataSource {
  @override
  Future<AssignExamResultEntity> parseFile(
    File file, {
    String? sheetName,
  }) async {
    final extension = file.path.split('.').last.toLowerCase();
    final bytes = await file.readAsBytes();

    try {
      if (extension == 'pdf') {
        // 1. XỬ LÝ PDF
        final PdfDocument document = PdfDocument(inputBytes: bytes);
        final String text = PdfTextExtractor(document).extractText();
        document.dispose();

        final result = TextParserEngine.parse(text);
        return _mapToEntity(result);
      } else if (extension == 'docx') {
        // 2. XỬ LÝ WORD
        final text = docxToText(bytes);
        final result = TextParserEngine.parse(text);
        return _mapToEntity(result);
      } else if (extension == 'xlsx' || extension == 'xls') {
        // 3. XỬ LÝ EXCEL
        final excel = Excel.decodeBytes(bytes);

        // 3.1. Kiểm tra tối ưu: Có nhiều Sheet không?
        final sheets = excel.tables.keys.toList();
        if (sheets.isEmpty) throw Exception("File Excel không có sheet nào!");

        // Nếu file có nhiều sheet và người dùng chưa chọn sheet nào -> Báo cho UI bật Modal
        if (sheets.length > 1 && sheetName == null) {
          return AssignExamResultEntity(
            preview: [],
            summary: const ExamSummaryEntity(
              total: 0,
              mcq: 0,
              essay: 0,
              errors: 0,
            ),
            validationErrors: [],
            isMultipleSheets: true,
            availableSheets: sheets,
          );
        }

        // 3.2. Tiến hành đọc Sheet đã chốt
        final targetSheet = sheetName ?? sheets.first;
        final table = excel.tables[targetSheet];

        if (table == null) {
          throw Exception("Không tìm thấy dữ liệu trong sheet $targetSheet");
        }

        // Chuyển List<Data?> của package Excel thành List<List<String>> cho Engine của ta
        final List<List<String>> rawData = [];
        for (var row in table.rows) {
          final rowStringList = row
              .map((cell) => cell?.value?.toString().trim() ?? '')
              .toList();
          rawData.add(rowStringList);
        }

        final result = ExcelParserEngine.parse(rawData);
        return _mapToEntity(result);
      } else {
        throw Exception(
          "Loại file không được hỗ trợ (.pdf, .docx, .xlsx, .xls)",
        );
      }
    } catch (e) {
      throw Exception("Lỗi đọc file: $e");
    }
  }

  // Helper map từ kết quả của Parser Engine sang Entity của Feature này
  AssignExamResultEntity _mapToEntity(dynamic parseResult) {
    return AssignExamResultEntity(
      // 👉 ĐÃ SỬA TẠI ĐÂY: Ánh xạ đàng hoàng từng thuộc tính thay vì ép kiểu dynamic
      preview: parseResult.questions.map<QuestionPreviewEntity>((q) {
        return QuestionPreviewEntity(
          row: q.row,
          type: q.type,
          questionText: q.questionText,
          originalQuestionText: q.originalQuestionText,
          points: q.points,
          options: q.options,
          correctOption: q.correctOption,
          modelAnswer: q.modelAnswer,
          errors: q.errors,
        );
      }).toList(),
      summary: ExamSummaryEntity(
        total: parseResult.total,
        mcq: parseResult.mcqCount,
        essay: parseResult.essayCount,
        errors: parseResult.errorCount,
      ),
      validationErrors: parseResult.validationErrors,
      isMultipleSheets: false,
    );
  }
}
