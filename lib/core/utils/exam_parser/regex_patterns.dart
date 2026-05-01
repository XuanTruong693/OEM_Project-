class RegexPatterns {
  // Tìm điểm số ở cuối câu, VD: (2đ), (0.5 points), [1.5 pts]
  static final RegExp scorePattern = RegExp(
    r'[([]?\s*(\d+(?:[.,]\d+)?)\s*(?:points?|đ|pts)?\s*[)\]]?\s*[:.]?\s*$',
    caseSensitive: false,
  );

  // Tìm tiền tố câu hỏi, VD: Câu 1:, Question 1., Q2:
  static final RegExp questionPrefixPattern = RegExp(
    r'^(?:Câu|Question|Q)?\s*\d+\s*[:.]?\s*',
    caseSensitive: false,
  );

  // Tìm tiền tố đáp án, VD: A., B), *C:, D.
  static final RegExp optionPrefixPattern = RegExp(
    r'^[*]?\s*([A-Z]|[1-4]|[a-z])\s*[.):-]\s*',
    caseSensitive: false,
  );

  // Trích xuất điểm nằm giữa chuỗi (dành cho tự luận ngắn)
  static final RegExp shortEssayScorePattern = RegExp(
    r'\((\d+(?:[.,]\d+)?)\s*(?:points?|đ)\)',
    caseSensitive: false,
  );
}
