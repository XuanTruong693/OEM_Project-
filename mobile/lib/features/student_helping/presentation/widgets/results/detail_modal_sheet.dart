import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../../domain/entities/result_detail_entity.dart';
import '../../bloc/result_detail/result_detail_bloc.dart';
import '../../bloc/result_detail/result_detail_event.dart';
import '../../bloc/result_detail/result_detail_state.dart';

void showDetailModalBottomSheet(BuildContext context, String submissionId) {
  // Bắn event load data ngay khi mở Modal
  context.read<ResultDetailBloc>().add(LoadResultDetailEvent(submissionId));

  showModalBottomSheet(
    context: context,
    isScrollControlled: true,
    backgroundColor: Colors.transparent,
    builder: (modalContext) {
      // Bắt buộc phải dùng BlocProvider.value để truyền BLoC từ trang chính vào Modal
      return BlocProvider.value(
        value: context.read<ResultDetailBloc>(),
        child: Container(
          height: MediaQuery.of(context).size.height * 0.9, // Cao 90% màn hình
          decoration: const BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
          ),
          child: Column(
            children: [
              // 1. Header của Modal có nút X để đóng
              _buildHeader(context),

              // 2. Nội dung chính (Scrollable)
              Expanded(
                child: BlocBuilder<ResultDetailBloc, ResultDetailState>(
                  builder: (context, state) {
                    if (state is ResultDetailLoading ||
                        state is ResultDetailInitial) {
                      return const Center(
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            CircularProgressIndicator(color: Colors.blue),
                            SizedBox(height: 16),
                            Text(
                              'Đang tải dữ liệu...',
                              style: TextStyle(color: Colors.grey),
                            ),
                          ],
                        ),
                      );
                    }

                    if (state is ResultDetailError) {
                      return Center(
                        child: Container(
                          margin: const EdgeInsets.all(24),
                          padding: const EdgeInsets.all(24),
                          decoration: BoxDecoration(
                            color: Colors.red.shade50,
                            borderRadius: BorderRadius.circular(12),
                            border: Border.all(color: Colors.red.shade200),
                          ),
                          child: Column(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              const Text(
                                'Lỗi tải dữ liệu',
                                style: TextStyle(
                                  color: Colors.red,
                                  fontWeight: FontWeight.bold,
                                  fontSize: 16,
                                ),
                              ),
                              const SizedBox(height: 8),
                              Text(
                                state.message,
                                style: TextStyle(color: Colors.red.shade700),
                                textAlign: TextAlign.center,
                              ),
                              const SizedBox(height: 16),
                              ElevatedButton(
                                onPressed: () => context
                                    .read<ResultDetailBloc>()
                                    .add(LoadResultDetailEvent(submissionId)),
                                style: ElevatedButton.styleFrom(
                                  backgroundColor: Colors.white,
                                  foregroundColor: Colors.red,
                                ),
                                child: const Text('Thử lại'),
                              ),
                            ],
                          ),
                        ),
                      );
                    }

                    if (state is ResultDetailLoaded) {
                      final data = state.detail;
                      return ListView.separated(
                        padding: const EdgeInsets.all(20),
                        physics: const BouncingScrollPhysics(),
                        itemCount: data.questions.length,
                        separatorBuilder: (_, _) => const SizedBox(height: 16),
                        itemBuilder: (context, index) {
                          final q = data.questions[index];
                          // Tìm câu trả lời tương ứng với câu hỏi
                          final answer = data.answers
                              .where((a) => a.questionId == q.questionId)
                              .firstOrNull;

                          final isUnanswered = q.type == 'MCQ'
                              ? (answer?.selectedOptionId == null)
                              : (answer?.answerText == null ||
                                    answer!.answerText!.trim().isEmpty);

                          return _buildQuestionBlock(
                            index,
                            q,
                            answer,
                            data.options,
                            isUnanswered,
                          );
                        },
                      );
                    }
                    return const SizedBox.shrink();
                  },
                ),
              ),
            ],
          ),
        ),
      );
    },
  );
}

Widget _buildHeader(BuildContext context) {
  return Container(
    padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
    decoration: BoxDecoration(
      border: Border(bottom: BorderSide(color: Colors.grey.shade200)),
    ),
    child: Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        const Text(
          'Chi tiết bài làm',
          style: TextStyle(
            fontSize: 18,
            fontWeight: FontWeight.bold,
            color: Color(0xFF1E293B),
          ),
        ),
        IconButton(
          onPressed: () => Navigator.pop(context),
          icon: const Icon(Icons.close, color: Colors.grey),
          padding: EdgeInsets.zero,
          constraints: const BoxConstraints(),
        ),
      ],
    ),
  );
}

Widget _buildQuestionBlock(
  int index,
  QuestionEntity q,
  AnswerEntity? answer,
  List<OptionEntity> allOptions,
  bool isUnanswered,
) {
  return Container(
    decoration: BoxDecoration(
      color: isUnanswered ? Colors.red.shade50 : Colors.white,
      border: Border.all(
        color: isUnanswered ? Colors.red.shade200 : Colors.grey.shade300,
      ),
      borderRadius: BorderRadius.circular(12),
    ),
    clipBehavior: Clip.antiAlias,
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        // Tiêu đề câu hỏi
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            border: Border(
              bottom: BorderSide(
                color: isUnanswered
                    ? Colors.red.shade200
                    : Colors.grey.shade200,
              ),
            ),
          ),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: 32,
                height: 32,
                decoration: BoxDecoration(
                  color: isUnanswered
                      ? Colors.red.shade100
                      : Colors.grey.shade100,
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(
                    color: isUnanswered
                        ? Colors.red.shade200
                        : Colors.grey.shade300,
                  ),
                ),
                child: Center(
                  child: Text(
                    '${index + 1}',
                    style: TextStyle(
                      fontWeight: FontWeight.bold,
                      color: isUnanswered
                          ? Colors.red.shade700
                          : Colors.black87,
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Row(
                          children: [
                            Container(
                              padding: const EdgeInsets.symmetric(
                                horizontal: 6,
                                vertical: 2,
                              ),
                              decoration: BoxDecoration(
                                color: Colors.grey.shade200,
                                borderRadius: BorderRadius.circular(4),
                              ),
                              child: Text(
                                q.type == 'MCQ' ? 'TRẮC NGHIỆM' : 'TỰ LUẬN',
                                style: const TextStyle(
                                  fontSize: 10,
                                  fontWeight: FontWeight.bold,
                                  color: Colors.black54,
                                ),
                              ),
                            ),
                            if (isUnanswered) ...[
                              const SizedBox(width: 8),
                              Container(
                                padding: const EdgeInsets.symmetric(
                                  horizontal: 6,
                                  vertical: 2,
                                ),
                                decoration: BoxDecoration(
                                  color: Colors.red.shade600,
                                  borderRadius: BorderRadius.circular(4),
                                ),
                                child: const Text(
                                  'CHƯA TRẢ LỜI',
                                  style: TextStyle(
                                    fontSize: 10,
                                    fontWeight: FontWeight.bold,
                                    color: Colors.white,
                                  ),
                                ),
                              ),
                            ],
                          ],
                        ),
                        Text(
                          'Điểm: ${answer?.score ?? 0} / ${q.points}',
                          style: const TextStyle(
                            fontWeight: FontWeight.bold,
                            color: Colors.black54,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 8),
                    Text(
                      q.questionText,
                      style: const TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.bold,
                        color: Colors.black87,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),

        // Các lựa chọn (Nếu là Trắc nghiệm)
        if (q.type == 'MCQ')
          Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              children: allOptions
                  .where((o) => o.questionId == q.questionId)
                  .map((opt) {
                    final isSelected = answer?.selectedOptionId == opt.optionId;
                    final isTrue = opt.isCorrect;

                    Color bgColor = Colors.white;
                    Color borderColor = Colors.grey.shade300;
                    Color textColor = Colors.black87;
                    IconData iconData = Icons.circle_outlined;
                    Color iconColor = Colors.grey.shade400;

                    if (isSelected && isTrue) {
                      bgColor = Colors.green.shade50;
                      borderColor = Colors.green.shade500;
                      textColor = Colors.green.shade800;
                      iconData = Icons.check_circle;
                      iconColor = Colors.green.shade600;
                    } else if (isSelected && !isTrue) {
                      bgColor = Colors.red.shade50;
                      borderColor = Colors.red.shade500;
                      textColor = Colors.red.shade800;
                      iconData = Icons.cancel;
                      iconColor = Colors.red.shade600;
                    } else if (!isSelected && isTrue) {
                      bgColor = Colors.green.shade50.withOpacity(0.5);
                      borderColor = Colors.green.shade300;
                      textColor = Colors.green.shade700;
                      iconData = Icons.check_circle;
                      iconColor = Colors.green.shade600;
                    }

                    return Container(
                      margin: const EdgeInsets.only(bottom: 8),
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: bgColor,
                        border: Border.all(color: borderColor),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Row(
                        children: [
                          Icon(iconData, color: iconColor, size: 20),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Text(
                              opt.optionText,
                              style: TextStyle(
                                color: textColor,
                                fontWeight: isSelected
                                    ? FontWeight.bold
                                    : FontWeight.normal,
                              ),
                            ),
                          ),
                          if (isSelected)
                            const Text(
                              'ĐÁP ÁN CỦA BẠN',
                              style: TextStyle(
                                fontSize: 9,
                                fontWeight: FontWeight.bold,
                                color: Colors.black45,
                              ),
                            ),
                        ],
                      ),
                    );
                  })
                  .toList(),
            ),
          )
        // Phần trả lời (Nếu là Tự luận)
        else
          Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: isUnanswered
                        ? Colors.red.shade50
                        : Colors.grey.shade50,
                    border: Border.all(
                      color: isUnanswered
                          ? Colors.red.shade200
                          : Colors.grey.shade300,
                    ),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        'BÀI LÀM CỦA BẠN',
                        style: TextStyle(
                          fontSize: 10,
                          fontWeight: FontWeight.bold,
                          color: Colors.black54,
                        ),
                      ),
                      const SizedBox(height: 8),
                      Text(
                        answer?.answerText ?? "Không có nội dung bài làm.",
                        style: const TextStyle(fontSize: 14),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 12),
                Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: Colors.blue.shade50,
                    border: Border.all(color: Colors.blue.shade200),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        'ĐÁP ÁN MẪU / GỢI Ý',
                        style: TextStyle(
                          fontSize: 10,
                          fontWeight: FontWeight.bold,
                          color: Colors.blue,
                        ),
                      ),
                      const SizedBox(height: 8),
                      Text(
                        q.modelAnswer,
                        style: TextStyle(
                          fontSize: 14,
                          color: Colors.blue.shade900,
                        ),
                      ),
                    ],
                  ),
                ),
                if (answer?.instructorFeedback != null &&
                    answer!.instructorFeedback!.isNotEmpty) ...[
                  const SizedBox(height: 12),
                  Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: Colors.amber.shade50,
                      border: Border.all(color: Colors.amber.shade200),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Row(
                          children: [
                            Icon(
                              Icons.info_outline,
                              size: 14,
                              color: Colors.orange,
                            ),
                            SizedBox(width: 4),
                            Text(
                              'PHẢN HỒI TỪ GIẢNG VIÊN',
                              style: TextStyle(
                                fontSize: 10,
                                fontWeight: FontWeight.bold,
                                color: Colors.orange,
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 8),
                        Text(
                          answer.instructorFeedback!,
                          style: TextStyle(
                            fontSize: 14,
                            color: Colors.orange.shade900,
                            fontWeight: FontWeight.w500,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ],
            ),
          ),
      ],
    ),
  );
}
