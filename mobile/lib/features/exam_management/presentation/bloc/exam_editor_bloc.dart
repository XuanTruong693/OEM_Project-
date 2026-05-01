import 'package:flutter_bloc/flutter_bloc.dart';
import '../../domain/entities/exam_detail_entity.dart';
import '../../domain/entities/question_entity.dart';
import '../../domain/entities/option_entity.dart';
import '../../domain/repositories/exam_management_repository.dart';
import '../../../../core/utils/excel_parser_service.dart';
import 'exam_editor_event.dart';
import 'exam_editor_state.dart';

class ExamEditorBloc extends Bloc<ExamEditorEvent, ExamEditorState> {
  final ExamManagementRepository repository;
  final ExcelParserService excelParser; // Nhúng nhà máy tái chế vào đây

  ExamEditorBloc({required this.repository, required this.excelParser})
    : super(ExamEditorInitial()) {
    on<LoadExamDetailEvent>(_onLoadExam);
    on<UpdateExamTitleEvent>(_onUpdateTitle);

    // Đăng ký các sự kiện thao tác câu hỏi
    on<UpdateQuestionContentEvent>(_onUpdateQuestionContent);
    on<SetCorrectOptionEvent>(_onSetCorrectOption);

    // Đăng ký sự kiện Excel
    on<AnalyzeExcelFileEvent>(_onAnalyzeExcel);
    on<TogglePreviewSelectionEvent>(_onTogglePreviewSelection);
    on<AddSelectedPreviewQuestionsEvent>(_onAddSelectedPreview);
    on<CancelPreviewEvent>(_onCancelPreview);

    on<SaveExamEvent>(_onSaveExam);

    on<AddQuestionEvent>(_onAddQuestion);
    on<RemoveQuestionEvent>(_onRemoveQuestion);
    on<UpdateQuestionPointsEvent>(_onUpdateQuestionPoints);
    on<UpdateModelAnswerEvent>(_onUpdateModelAnswer);

    on<AddOptionEvent>(_onAddOption);
    on<RemoveOptionEvent>(_onRemoveOption);
    on<UpdateOptionContentEvent>(_onUpdateOptionContent);
  }

  Future<void> _onLoadExam(
    LoadExamDetailEvent event,
    Emitter<ExamEditorState> emit,
  ) async {
    emit(ExamEditorLoading());
    try {
      final exam = await repository.getExamDetail(event.examId);
      emit(ExamEditorLoaded(exam: exam));
    } catch (e) {
      emit(ExamEditorError(e.toString()));
    }
  }

  void _onUpdateTitle(
    UpdateExamTitleEvent event,
    Emitter<ExamEditorState> emit,
  ) {
    if (state is ExamEditorLoaded) {
      final s = state as ExamEditorLoaded;
      final newExam = ExamDetailEntity(
        id: s.exam.id,
        title: event.title,
        duration: s.exam.duration,
        questions: s.exam.questions,
        examRoomCode: s.exam.examRoomCode,
        status: s.exam.status,
      );
      emit(s.copyWith(exam: newExam, clearSaveError: true));
    }
  }

  void _onUpdateQuestionContent(
    UpdateQuestionContentEvent event,
    Emitter<ExamEditorState> emit,
  ) {
    if (state is! ExamEditorLoaded) return;
    final s = state as ExamEditorLoaded;

    final newQuestions = s.exam.questions.map((q) {
      if (q.id == event.questionId) {
        return QuestionEntity(
          id: q.id,
          type: q.type,
          content: event.content,
          points: q.points,
          modelAnswer: q.modelAnswer,
          options: q.options,
        );
      }
      return q;
    }).toList();

    final newExam = ExamDetailEntity(
      id: s.exam.id,
      title: s.exam.title,
      duration: s.exam.duration,
      questions: newQuestions,
    );
    emit(s.copyWith(exam: newExam));
  }

  void _onSetCorrectOption(
    SetCorrectOptionEvent event,
    Emitter<ExamEditorState> emit,
  ) {
    if (state is! ExamEditorLoaded) return;
    final s = state as ExamEditorLoaded;

    final newQuestions = s.exam.questions.map((q) {
      if (q.id == event.questionId) {
        final newOptions = q.options
            .map(
              (o) => OptionEntity(
                id: o.id,
                content: o.content,
                isCorrect: o.id == event.optionId,
              ),
            )
            .toList();
        return QuestionEntity(
          id: q.id,
          type: q.type,
          content: q.content,
          points: q.points,
          modelAnswer: q.modelAnswer,
          options: newOptions,
        );
      }
      return q;
    }).toList();

    final newExam = ExamDetailEntity(
      id: s.exam.id,
      title: s.exam.title,
      duration: s.exam.duration,
      questions: newQuestions,
    );
    emit(s.copyWith(exam: newExam));
  }

  // ================= LUỒNG EXCEL =================

  Future<void> _onAnalyzeExcel(
    AnalyzeExcelFileEvent event,
    Emitter<ExamEditorState> emit,
  ) async {
    if (state is! ExamEditorLoaded) return;
    final s = state as ExamEditorLoaded;

    try {
      final parsedQuestions = await excelParser.parseExcelToQuestions(
        event.bytes,
      );

      // Mặc định tick chọn tất cả các câu hỏi đọc được
      final selectedIds = parsedQuestions.map((q) => q.id).toSet();

      emit(
        s.copyWith(
          previewQuestions: parsedQuestions,
          selectedPreviewIds: selectedIds,
          isPreviewOpen: true,
          previewMessage:
              "Tìm thấy ${parsedQuestions.length} câu hỏi mới trong file.",
        ),
      );
    } catch (e) {
      emit(
        s.copyWith(
          previewMessage: e.toString(),
          isPreviewOpen: false,
          clearSuccessMessage: true,
        ),
      );
    }
  }

  void _onTogglePreviewSelection(
    TogglePreviewSelectionEvent event,
    Emitter<ExamEditorState> emit,
  ) {
    if (state is! ExamEditorLoaded) return;
    final s = state as ExamEditorLoaded;

    final newSelected = Set<String>.from(s.selectedPreviewIds);
    if (newSelected.contains(event.tempId)) {
      newSelected.remove(event.tempId);
    } else {
      newSelected.add(event.tempId);
    }
    emit(s.copyWith(selectedPreviewIds: newSelected));
  }

  void _onAddSelectedPreview(
    AddSelectedPreviewQuestionsEvent event,
    Emitter<ExamEditorState> emit,
  ) {
    if (state is! ExamEditorLoaded) return;
    final s = state as ExamEditorLoaded;

    final selectedQs = s.previewQuestions
        .where((q) => s.selectedPreviewIds.contains(q.id))
        .toList();
    if (selectedQs.isEmpty) {
      emit(s.copyWith(previewMessage: "Chưa chọn câu hỏi nào để thêm."));
      return;
    }

    final newQuestions = [...s.exam.questions, ...selectedQs];
    final newExam = ExamDetailEntity(
      id: s.exam.id,
      title: s.exam.title,
      duration: s.exam.duration,
      questions: newQuestions,
    );

    emit(
      s.copyWith(
        exam: newExam,
        isPreviewOpen: false,
        previewQuestions: [],
        selectedPreviewIds: {},
        successMessage: "Đã thêm ${selectedQs.length} câu hỏi vào đề thi.",
        clearPreviewMessage: true,
      ),
    );
  }

  void _onCancelPreview(
    CancelPreviewEvent event,
    Emitter<ExamEditorState> emit,
  ) {
    if (state is! ExamEditorLoaded) return;
    emit(
      (state as ExamEditorLoaded).copyWith(
        isPreviewOpen: false,
        previewQuestions: [],
        selectedPreviewIds: {},
        clearPreviewMessage: true,
      ),
    );
  }

  // ================= LUỒNG LƯU (VALIDATE) =================

  Future<void> _onSaveExam(
    SaveExamEvent event,
    Emitter<ExamEditorState> emit,
  ) async {
    if (state is! ExamEditorLoaded) return;
    final s = state as ExamEditorLoaded;
    final exam = s.exam;

    if (exam.title.trim().isEmpty) {
      emit(s.copyWith(saveError: "Tiêu đề đề thi không được để trống!"));
      return;
    }

    // Logic Validate (Rất giống React)
    Map<String, List<String>> valMap = {};
    double totalPoints = 0;

    for (var q in exam.questions) {
      totalPoints += q.points;
      List<String> errors = [];

      if (q.content.trim().isEmpty) {
        errors.add("Nội dung câu hỏi không được để trống.");
      }
      if (q.points <= 0) errors.add("Điểm phải lớn hơn 0.");

      if (q.type == 'MCQ') {
        final nonEmptyOpts = q.options
            .where((o) => o.content.trim().isNotEmpty)
            .toList();
        if (nonEmptyOpts.length < 2) {
          errors.add("Trắc nghiệm phải có ít nhất 2 đáp án.");
        }
        final correctCount = q.options.where((o) => o.isCorrect).length;
        if (correctCount != 1) errors.add("Phải chọn đúng 1 đáp án đúng.");
      } else {
        if ((q.modelAnswer ?? '').trim().isEmpty) {
          errors.add("Tự luận phải có đáp án mẫu.");
        }
      }
      if (errors.isNotEmpty) valMap[q.id] = errors;
    }

    if (valMap.isNotEmpty) {
      emit(
        s.copyWith(
          validationErrors: valMap,
          saveError: "Vui lòng sửa các lỗi bên dưới trước khi lưu.",
        ),
      );
      return;
    }

    // Làm tròn 1 chữ số thập phân (Fix lỗi sai số 9.99999)
    totalPoints = double.parse(totalPoints.toStringAsFixed(1));
    if (totalPoints != 10.0) {
      emit(
        s.copyWith(
          saveError:
              "Tổng điểm hiện tại là $totalPoints. Tổng điểm phải bằng 10 để lưu bài thi!",
        ),
      );
      return;
    }

    emit(
      s.copyWith(isSaving: true, clearSaveError: true, validationErrors: {}),
    );
    try {
      // Tự tay map dữ liệu thành JSON để gửi lên API (Không dùng .toJson() của Entity)
      final payload = {
        'id': int.tryParse(exam.id) ?? exam.id,
        'title': exam.title,
        'exam_room_code': exam.examRoomCode,
        'status': exam.status,
        'duration': exam.duration,
        'questions': exam.questions
            .map(
              (q) => {
                'id': int.tryParse(q.id) ?? q.id,
                'type': q.type,
                'content': q.content,
                'points': q.points,
                'modelAnswer': q.modelAnswer ?? '',
                'options': q.options
                    .map(
                      (o) => {
                        'id': int.tryParse(o.id) ?? o.id,
                        'content': o.content,
                        'is_correct': o.isCorrect,
                      },
                    )
                    .toList(),
              },
            )
            .toList(),
      };

      await repository.updateExam(exam.id, payload);
      emit(
        s.copyWith(
          isSaving: false,
          successMessage: "Cập nhật đề thi thành công!",
        ),
      );
    } catch (e) {
      emit(s.copyWith(isSaving: false, saveError: e.toString()));
    }
  }
  // ==========================================
  // THAO TÁC VỚI CÂU HỎI (THÊM / XÓA / ĐIỂM SỐ)
  // ==========================================

  void _onAddQuestion(AddQuestionEvent event, Emitter<ExamEditorState> emit) {
    if (state is! ExamEditorLoaded) return;
    final s = state as ExamEditorLoaded;

    final newId = 'new_${DateTime.now().millisecondsSinceEpoch}';

    // Tạo câu hỏi mới dựa vào type (MCQ hoặc essay)
    final newQuestion = QuestionEntity(
      id: newId,
      type: event.type,
      content: event.type == 'MCQ'
          ? "Câu hỏi trắc nghiệm mới"
          : "Câu hỏi tự luận mới",
      points: 0.1,
      modelAnswer: "",
      options: event.type == 'MCQ'
          ? [
              OptionEntity(
                id: '${newId}_opt1',
                content: "Đáp án A",
                isCorrect: true,
              ),
              OptionEntity(
                id: '${newId}_opt2',
                content: "Đáp án B",
                isCorrect: false,
              ),
            ]
          : [], // Tự luận thì không có options
    );

    final newQuestions = [...s.exam.questions, newQuestion];
    final newExam = ExamDetailEntity(
      id: s.exam.id,
      title: s.exam.title,
      duration: s.exam.duration,
      questions: newQuestions,
    );

    emit(s.copyWith(exam: newExam, clearSaveError: true));
  }

  void _onRemoveQuestion(
    RemoveQuestionEvent event,
    Emitter<ExamEditorState> emit,
  ) {
    if (state is! ExamEditorLoaded) return;
    final s = state as ExamEditorLoaded;

    // Lọc bỏ câu hỏi có ID trùng với ID muốn xóa
    final newQuestions = s.exam.questions
        .where((q) => q.id != event.questionId)
        .toList();
    final newExam = ExamDetailEntity(
      id: s.exam.id,
      title: s.exam.title,
      duration: s.exam.duration,
      questions: newQuestions,
    );

    // Xóa luôn lỗi của câu hỏi đó trong valMap (nếu có)
    final newErrors = Map<String, List<String>>.from(s.validationErrors);
    newErrors.remove(event.questionId);

    emit(s.copyWith(exam: newExam, validationErrors: newErrors));
  }

  void _onUpdateQuestionPoints(
    UpdateQuestionPointsEvent event,
    Emitter<ExamEditorState> emit,
  ) {
    if (state is! ExamEditorLoaded) return;
    final s = state as ExamEditorLoaded;

    final newQuestions = s.exam.questions.map((q) {
      if (q.id == event.questionId) {
        return QuestionEntity(
          id: q.id,
          type: q.type,
          content: q.content,
          points: event.points,
          modelAnswer: q.modelAnswer,
          options: q.options,
        );
      }
      return q;
    }).toList();

    emit(
      s.copyWith(
        exam: ExamDetailEntity(
          id: s.exam.id,
          title: s.exam.title,
          duration: s.exam.duration,
          questions: newQuestions,
        ),
      ),
    );
  }

  void _onUpdateModelAnswer(
    UpdateModelAnswerEvent event,
    Emitter<ExamEditorState> emit,
  ) {
    if (state is! ExamEditorLoaded) return;
    final s = state as ExamEditorLoaded;

    final newQuestions = s.exam.questions.map((q) {
      if (q.id == event.questionId) {
        return QuestionEntity(
          id: q.id,
          type: q.type,
          content: q.content,
          points: q.points,
          modelAnswer: event.modelAnswer,
          options: q.options,
        );
      }
      return q;
    }).toList();

    emit(
      s.copyWith(
        exam: ExamDetailEntity(
          id: s.exam.id,
          title: s.exam.title,
          duration: s.exam.duration,
          questions: newQuestions,
        ),
      ),
    );
  }

  // ==========================================
  // THAO TÁC VỚI ĐÁP ÁN TRẮC NGHIỆM (THÊM / XÓA / SỬA TEXT)
  // ==========================================

  void _onAddOption(AddOptionEvent event, Emitter<ExamEditorState> emit) {
    if (state is! ExamEditorLoaded) return;
    final s = state as ExamEditorLoaded;

    final newQuestions = s.exam.questions.map((q) {
      if (q.id == event.questionId) {
        final newOpt = OptionEntity(
          id: 'opt_${DateTime.now().millisecondsSinceEpoch}',
          content: "Đáp án mới",
          isCorrect: false,
        );
        return QuestionEntity(
          id: q.id,
          type: q.type,
          content: q.content,
          points: q.points,
          modelAnswer: q.modelAnswer,
          options: [...q.options, newOpt],
        );
      }
      return q;
    }).toList();

    emit(
      s.copyWith(
        exam: ExamDetailEntity(
          id: s.exam.id,
          title: s.exam.title,
          duration: s.exam.duration,
          questions: newQuestions,
        ),
      ),
    );
  }

  void _onRemoveOption(RemoveOptionEvent event, Emitter<ExamEditorState> emit) {
    if (state is! ExamEditorLoaded) return;
    final s = state as ExamEditorLoaded;

    final newQuestions = s.exam.questions.map((q) {
      if (q.id == event.questionId) {
        // Lọc bỏ đáp án muốn xóa
        final newOptions = q.options
            .where((o) => o.id != event.optionId)
            .toList();

        // Nếu lỡ xóa mất đáp án Đúng, thì tự động gán đáp án đầu tiên làm đáp án đúng (để chống lỗi UI)
        if (newOptions.isNotEmpty && !newOptions.any((o) => o.isCorrect)) {
          newOptions[0] = OptionEntity(
            id: newOptions[0].id,
            content: newOptions[0].content,
            isCorrect: true,
          );
        }

        return QuestionEntity(
          id: q.id,
          type: q.type,
          content: q.content,
          points: q.points,
          modelAnswer: q.modelAnswer,
          options: newOptions,
        );
      }
      return q;
    }).toList();

    emit(
      s.copyWith(
        exam: ExamDetailEntity(
          id: s.exam.id,
          title: s.exam.title,
          duration: s.exam.duration,
          questions: newQuestions,
        ),
      ),
    );
  }

  void _onUpdateOptionContent(
    UpdateOptionContentEvent event,
    Emitter<ExamEditorState> emit,
  ) {
    if (state is! ExamEditorLoaded) return;
    final s = state as ExamEditorLoaded;

    final newQuestions = s.exam.questions.map((q) {
      if (q.id == event.questionId) {
        final newOptions = q.options.map((o) {
          if (o.id == event.optionId) {
            return OptionEntity(
              id: o.id,
              content: event.content,
              isCorrect: o.isCorrect,
            );
          }
          return o;
        }).toList();
        return QuestionEntity(
          id: q.id,
          type: q.type,
          content: q.content,
          points: q.points,
          modelAnswer: q.modelAnswer,
          options: newOptions,
        );
      }
      return q;
    }).toList();

    emit(
      s.copyWith(
        exam: ExamDetailEntity(
          id: s.exam.id,
          title: s.exam.title,
          duration: s.exam.duration,
          questions: newQuestions,
        ),
      ),
    );
  }
}
