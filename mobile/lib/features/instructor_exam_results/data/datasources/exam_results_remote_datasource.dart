import '../../../../core/network/dio_client.dart';
import '../../domain/entities/exam_result_entity.dart';
import '../../domain/entities/exam_summary_entity.dart';
import '../../domain/entities/exam_cheating_log_entity.dart';
import '../../domain/entities/exam_answer_entity.dart';

class ExamResultsRemoteDataSource {
  final DioClient _dioClient;

  ExamResultsRemoteDataSource(this._dioClient);

  Future<List<Map<String, dynamic>>> getMyExams() async {
    final response = await _dioClient.dio.get('/instructor/exams/my');
    if (response.data is List) {
      return List<Map<String, dynamic>>.from(response.data);
    }
    return [];
  }

  Future<ExamSummaryEntity?> getExamSummary(String examId) async {
    final response = await _dioClient.dio.get('/instructor/exams/$examId/summary');
    if (response.data != null) {
      return ExamSummaryEntity.fromJson(response.data);
    }
    return null;
  }

  Future<List<ExamResultEntity>> getExamResults(String examId) async {
    final response = await _dioClient.dio.get('/instructor/exams/$examId/results');
    if (response.data is List) {
      return (response.data as List).map((e) => ExamResultEntity.fromJson(e)).toList();
    }
    return [];
  }

  Future<List<ExamCheatingLogEntity>> getCheatingLogs(String submissionId) async {
    final response = await _dioClient.dio.get('/instructor/submissions/$submissionId/cheating-details');
    
    if (response.data != null && response.data is Map) {
      final logsData = response.data['logs'] as List? ?? [];
      return logsData.map((json) => ExamCheatingLogEntity.fromJson(json)).toList();
    }
    return [];
  }

  Future<List<ExamAnswerEntity>> getSubmissionAnswers(String submissionId) async {
    final response = await _dioClient.dio.get('/submissions/$submissionId/questions');
    
    if (response.data != null && response.data is Map) {
      final questionsData = response.data['questions'] as List? ?? [];
      final answersData = response.data['answers'] as List? ?? [];
      final optionsData = response.data['options'] as List? ?? [];

      // Use String keys for safer matching
      final answerMap = {
        for (var a in answersData) 
          (a['question_id']?.toString() ?? ''): a
      };

      // Group options by question_id
      final optionsMap = <String, List<dynamic>>{};
      for (var o in optionsData) {
        final qid = o['question_id']?.toString();
        if (qid != null) {
          optionsMap.putIfAbsent(qid, () => []).add(o);
        }
      }

      return questionsData.map((q) {
        final Map<String, dynamic> merged = Map<String, dynamic>.from(q);
        final qid = q['question_id']?.toString() ?? q['id']?.toString();
        
        if (qid != null) {
          if (answerMap.containsKey(qid)) {
            merged['answer'] = answerMap[qid];
          }
          if (optionsMap.containsKey(qid)) {
            merged['options'] = optionsMap[qid];
          }
        }
        return ExamAnswerEntity.fromJson(merged);
      }).toList();
    }
    return [];
  }

  Future<void> updateStudentScore({
    required String submissionId,
    required String answerId,
    required num score,
    String? feedback,
  }) async {
    await _dioClient.dio.put(
      '/instructor/submissions/$submissionId/answers/$answerId/score',
      data: {
        'score': score,
        'feedback': feedback ?? '',
      },
    );
  }

  Future<void> approveAllScores(String examId) async {
    await _dioClient.dio.post('/instructor/exams/$examId/approve-all-scores');
  }

  Future<void> confirmGrading({
    required String examId,
    required String studentId,
    required num mcqScore,
    required num aiScore,
    required List<Map<String, dynamic>> perQuestionScores,
    String? submissionId,
  }) async {
    await _dioClient.dio.put(
      '/instructor/exams/$examId/students/$studentId/score',
      data: {
        'mcq_score': mcqScore,
        'ai_score': aiScore,
        'per_question_scores': perQuestionScores,
        'submission_id': submissionId,
      },
    );
  }

  Future<String?> getViolationVideoUrl(String submissionId, {String? snapshotId}) async {
    try {
      final response = await _dioClient.dio.post(
        '/submissions/$submissionId/videos/merge',
        data: snapshotId != null ? {'violation_id': snapshotId} : {},
      );
      if (response.data != null && response.data['video_url'] != null) {
        // Return relative path. The UI will prepend the base URL.
        return response.data['video_url'].toString();
      }
    } catch (e) {
      // Ignored
    }
    return null;
  }

  Future<void> deleteStudentExamRecord(String examId, String studentId) async {
    await _dioClient.dio.delete('/instructor/exams/$examId/students/$studentId');
  }
}

