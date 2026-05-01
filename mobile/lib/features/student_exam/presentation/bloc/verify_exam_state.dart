import 'package:equatable/equatable.dart';
import '../../domain/entities/exam_info_entity.dart';
import '../../domain/entities/join_exam_entity.dart';

class VerifyExamState extends Equatable {
  // --- THÔNG TIN CHUNG ---
  final bool isLoading;
  final String? errorMessage;
  final String?
  warningMessage; // Dùng cho monitor (cảnh báo đa màn hình, phím tắt)
  final String? uploadSuccessMsg; // Lời chúc cuối cùng
  final bool isKicked; // Bị giảng viên kích qua Socket

  // --- THÔNG TIN API TỪ SERVER ---
  final ExamInfoEntity? examInfo;
  final JoinExamEntity? joinData;

  // --- TRẠNG THÁI 3 BƯỚC (CỐT LÕI) ---
  final bool isBypassed;
  final bool cardOk;
  final bool faceOk;
  final bool monitorOk;

  // --- BƯỚC 1: THẺ SINH VIÊN ---
  final String studentCode;
  final bool isSearchingCard;
  final bool isVerifyingCard;
  final bool cardUploaded;
  final bool cardVerified;
  final String? cardPreviewUrl; // Link ảnh hoặc base64
  final String? cardLocalPath; // Đường dẫn file lưu trong máy
  final double ocrProgress;
  final String cardVerifyLog;
  final String? cardErr;

  // --- BƯỚC 2: KHUÔN MẶT & CAMERA ---
  final bool isVerifyingFace;
  final bool isComparing;
  final bool faceUploaded;
  final bool faceVerified;
  final bool facesCompared;
  final String? facePreviewPath; // Ảnh chụp được lưu trong cache
  final String faceVerifyLog;
  final String compareLog;
  final String? faceErr;

  // --- ML KIT (AI HƯỚNG DẪN KHUÔN MẶT) ---
  final String blinkPhase; // 'idle' | 'detecting' | 'done'
  final int blinkCount;
  final bool isDebugBlink;
  final int leftEyePct;
  final int rightEyePct;
  final bool blinkFaceOk;
  final bool faceGuideOk;
  final String faceGuideMsg;

  // --- BƯỚC 3: MONITOR ---
  final int screenCount;
  final bool multiScreenDetected;

  const VerifyExamState({
    this.isLoading = false,
    this.errorMessage,
    this.warningMessage,
    this.uploadSuccessMsg,
    this.isKicked = false,
    this.examInfo,
    this.joinData,
    this.isBypassed = false,
    this.cardOk = false,
    this.faceOk = false,
    this.monitorOk = false,
    this.studentCode = '',
    this.isSearchingCard = false,
    this.isVerifyingCard = false,
    this.cardUploaded = false,
    this.cardVerified = false,
    this.cardPreviewUrl,
    this.cardLocalPath,
    this.ocrProgress = 0.0,
    this.cardVerifyLog = '',
    this.cardErr,
    this.isVerifyingFace = false,
    this.isComparing = false,
    this.faceUploaded = false,
    this.faceVerified = false,
    this.facesCompared = false,
    this.facePreviewPath,
    this.faceVerifyLog = '',
    this.compareLog = '',
    this.faceErr,
    this.blinkPhase = 'idle',
    this.blinkCount = 0,
    this.isDebugBlink = false,
    this.leftEyePct = 0,
    this.rightEyePct = 0,
    this.blinkFaceOk = false,
    this.faceGuideOk = false,
    this.faceGuideMsg = 'Hãy căn khuôn mặt vào khung và nhìn thẳng',
    this.screenCount = 1,
    this.multiScreenDetected = false,
  });

  VerifyExamState copyWith({
    bool? isLoading,
    String? errorMessage,
    String? warningMessage,
    String? uploadSuccessMsg,
    bool? isKicked,
    ExamInfoEntity? examInfo,
    JoinExamEntity? joinData,
    bool? isBypassed,
    bool? cardOk,
    bool? faceOk,
    bool? monitorOk,
    String? studentCode,
    bool? isSearchingCard,
    bool? isVerifyingCard,
    bool? cardUploaded,
    bool? cardVerified,
    String? cardPreviewUrl,
    String? cardLocalPath,
    double? ocrProgress,
    String? cardVerifyLog,
    String? cardErr,
    bool? isVerifyingFace,
    bool? isComparing,
    bool? faceUploaded,
    bool? faceVerified,
    bool? facesCompared,
    String? facePreviewPath,
    String? faceVerifyLog,
    String? compareLog,
    String? faceErr,
    String? blinkPhase,
    int? blinkCount,
    bool? isDebugBlink,
    int? leftEyePct,
    int? rightEyePct,
    bool? blinkFaceOk,
    bool? faceGuideOk,
    String? faceGuideMsg,
    int? screenCount,
    bool? multiScreenDetected,
  }) {
    return VerifyExamState(
      isLoading: isLoading ?? this.isLoading,
      // Lưu ý thủ thuật set null cho message nếu người dùng ko truyền vào
      errorMessage: errorMessage ?? this.errorMessage,
      warningMessage: warningMessage ?? this.warningMessage,
      uploadSuccessMsg: uploadSuccessMsg ?? this.uploadSuccessMsg,
      isKicked: isKicked ?? this.isKicked,
      examInfo: examInfo ?? this.examInfo,
      joinData: joinData ?? this.joinData,
      isBypassed: isBypassed ?? this.isBypassed,
      cardOk: cardOk ?? this.cardOk,
      faceOk: faceOk ?? this.faceOk,
      monitorOk: monitorOk ?? this.monitorOk,
      studentCode: studentCode ?? this.studentCode,
      isSearchingCard: isSearchingCard ?? this.isSearchingCard,
      isVerifyingCard: isVerifyingCard ?? this.isVerifyingCard,
      cardUploaded: cardUploaded ?? this.cardUploaded,
      cardVerified: cardVerified ?? this.cardVerified,
      cardPreviewUrl: cardPreviewUrl ?? this.cardPreviewUrl,
      cardLocalPath: cardLocalPath ?? this.cardLocalPath,
      ocrProgress: ocrProgress ?? this.ocrProgress,
      cardVerifyLog: cardVerifyLog ?? this.cardVerifyLog,
      cardErr: cardErr ?? this.cardErr,
      isVerifyingFace: isVerifyingFace ?? this.isVerifyingFace,
      isComparing: isComparing ?? this.isComparing,
      faceUploaded: faceUploaded ?? this.faceUploaded,
      faceVerified: faceVerified ?? this.faceVerified,
      facesCompared: facesCompared ?? this.facesCompared,
      facePreviewPath: facePreviewPath ?? this.facePreviewPath,
      faceVerifyLog: faceVerifyLog ?? this.faceVerifyLog,
      compareLog: compareLog ?? this.compareLog,
      faceErr: faceErr ?? this.faceErr,
      blinkPhase: blinkPhase ?? this.blinkPhase,
      blinkCount: blinkCount ?? this.blinkCount,
      isDebugBlink: isDebugBlink ?? this.isDebugBlink,
      leftEyePct: leftEyePct ?? this.leftEyePct,
      rightEyePct: rightEyePct ?? this.rightEyePct,
      blinkFaceOk: blinkFaceOk ?? this.blinkFaceOk,
      faceGuideOk: faceGuideOk ?? this.faceGuideOk,
      faceGuideMsg: faceGuideMsg ?? this.faceGuideMsg,
      screenCount: screenCount ?? this.screenCount,
      multiScreenDetected: multiScreenDetected ?? this.multiScreenDetected,
    );
  }

  @override
  List<Object?> get props => [
    isLoading,
    errorMessage,
    warningMessage,
    uploadSuccessMsg,
    isKicked,
    examInfo,
    joinData,
    isBypassed,
    cardOk,
    faceOk,
    monitorOk,
    studentCode,
    isSearchingCard,
    isVerifyingCard,
    cardUploaded,
    cardVerified,
    cardPreviewUrl,
    cardLocalPath,
    ocrProgress,
    cardVerifyLog,
    cardErr,
    isVerifyingFace,
    isComparing,
    faceUploaded,
    faceVerified,
    facesCompared,
    facePreviewPath,
    faceVerifyLog,
    compareLog,
    faceErr,
    blinkPhase,
    blinkCount,
    isDebugBlink,
    leftEyePct,
    rightEyePct,
    blinkFaceOk,
    faceGuideOk,
    faceGuideMsg,
    screenCount,
    multiScreenDetected,
  ];
}
