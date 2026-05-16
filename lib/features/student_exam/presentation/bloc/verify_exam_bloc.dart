import 'package:flutter_bloc/flutter_bloc.dart';
import '../../../../core/storage/secure_storage_helper.dart';
import '../../domain/usecases/get_exam_public_info_use_case.dart';
import '../../domain/usecases/verify_student_code_use_case.dart';
import '../../domain/usecases/verify_face_use_case.dart';
import '../../domain/usecases/compare_faces_use_case.dart';
import '../../domain/usecases/upload_verified_images_use_case.dart';
import 'verify_exam_event.dart';
import 'verify_exam_state.dart';

// Đảm bảo bạn import đúng đường dẫn file socket của bạn
import '../../../../core/network/socket_client.dart';

class VerifyExamBloc extends Bloc<VerifyExamEvent, VerifyExamState> {
  final GetExamPublicInfoUseCase getExamPublicInfo;
  final VerifyStudentCodeUseCase verifyStudentCode;
  final VerifyFaceUseCase verifyFace;
  final CompareFacesUseCase compareFaces;
  final UploadVerifiedImagesUseCase uploadVerifiedImages;

  // Biến giữ hàm hủy lắng nghe socket
  Function? _removeBypassListener;
  Function? _removeKickedListener;

  VerifyExamBloc({
    required this.getExamPublicInfo,
    required this.verifyStudentCode,
    required this.verifyFace,
    required this.compareFaces,
    required this.uploadVerifiedImages,
  }) : super(const VerifyExamState()) {
    // Đăng ký các Event Handler
    on<LoadVerifyExamDataEvent>(_onLoadData);
    on<VerifyStudentCodeEvent>(_onVerifyStudentCode);
    on<ResetCardVerificationEvent>(_onResetCard);

    on<UpdateBlinkPhaseEvent>(_onUpdateBlinkPhase);
    on<UpdateFaceGuideEvent>(_onUpdateFaceGuide);
    on<FaceCapturedEvent>(_onFaceCaptured);

    on<VerifyFaceApiEvent>(_onVerifyFaceApi);
    on<CompareFacesApiEvent>(_onCompareFacesApi);
    on<UploadFinalImagesEvent>(_onUploadFinalImages);
    on<ResetFaceVerificationEvent>(_onResetFace);
    on<ResetAllVerificationEvent>(_onResetAll);

    on<EnableMonitorEvent>(_onEnableMonitor);

    on<SocketBypassGrantedEvent>(_onSocketBypass);
    on<SocketKickedEvent>(_onSocketKicked);
  }

  // ==========================================
  // BƯỚC 0: TẢI DATA & SETUP SOCKET
  // ==========================================
  Future<void> _onLoadData(
    LoadVerifyExamDataEvent event,
    Emitter<VerifyExamState> emit,
  ) async {
    emit(state.copyWith(isLoading: true, errorMessage: null));

    final result = await getExamPublicInfo(event.examId);

    result.fold(
      (failure) =>
          emit(state.copyWith(isLoading: false, errorMessage: failure.message)),
      (examInfo) {
        // Tự động đánh dấu OK cho những bước KHÔNG BỊ YÊU CẦU
        emit(
          state.copyWith(
            isLoading: false,
            examInfo: examInfo,
            cardOk: !examInfo.requireStudentCard,
            faceOk: !examInfo.requireFaceCheck,
            monitorOk: !examInfo.monitorScreen,
          ),
        );
      },
    );

    final bypassRes = await getExamPublicInfo.repository.getSubmissionBypassStatus(event.submissionId);
    bypassRes.fold(
      (failure) => null,
      (isBypassed) {
        if (isBypassed) {
          emit(state.copyWith(
            isBypassed: true,
            cardOk: true,
            faceOk: true,
            faceErr: null,
            cardErr: null,
          ));
        }
      },
    );

    // Setup Socket.io
    try {
      if (!socketClient.isConnected) {
        final token = await SecureStorageHelper.getAccessToken();
        if (token != null) {
          socketClient.connectSocket(token);
        }
      }

      // 1. Gửi lệnh báo danh lên Server (Fire & Forget)
      socketClient.emit('student:register-submission', {
        'submissionId': event.submissionId,
        'examId': event.examId,
        'studentName': 'Student', // Lấy từ LocalStorage/SecureStorage của bạn
      });

      // 2. Lắng nghe Giảng viên Bypass
      _removeBypassListener = socketClient.onEvent('student:bypass-granted:${event.submissionId}', (data) {
        add(SocketBypassGrantedEvent());
      });

      // 3. Lắng nghe bị Kick
      _removeKickedListener = socketClient.onEvent('student:kicked:${event.submissionId}', (data) {
        add(SocketKickedEvent(data['message'] ?? 'Bạn bị mời ra khỏi phòng'));
      });
    } catch (e) {
      print("Socket setup error: $e");
    }
  }

  // ==========================================
  // BƯỚC 1: XÁC MINH THẺ SINH VIÊN
  // ==========================================
  Future<void> _onVerifyStudentCode(
    VerifyStudentCodeEvent event,
    Emitter<VerifyExamState> emit,
  ) async {
    emit(
      state.copyWith(
        isSearchingCard: true,
        cardErr: null, // Xóa lỗi cũ
        cardVerifyLog: '⏳ Đang tìm kiếm thẻ sinh viên...',
        studentCode: event.studentCode,
      ),
    );

    // Cần truyền submissionId vào UseCase. Ở đây giả sử bạn lưu trong UI hoặc lấy qua event.
    // Tạm thời fix cứng hoặc bạn truyền qua Event nhé (ở đây mình ví dụ truyền "submission_id_here")
    final result = await verifyStudentCode(
      event.submissionId,
      event.studentCode,
    );

    result.fold(
      (failure) => emit(
        state.copyWith(
          isSearchingCard: false,
          cardErr: failure.message,
          cardVerifyLog: '❌ ${failure.message}',
        ),
      ),
      (data) {
        emit(
          state.copyWith(
            isSearchingCard: false,
            cardUploaded: true,
            cardVerified: true,
            cardOk: true,
            ocrProgress: 100.0,
            cardPreviewUrl: data['card_preview'], // Base64 image từ API
            cardVerifyLog:
                '✅ Khớp mã sinh viên thành công!\n👤 Tên: ${data['details']?['student_name']}\n💳 MSSV: ${data['details']?['mssv']}',
          ),
        );
      },
    );
  }

  void _onResetCard(
    ResetCardVerificationEvent event,
    Emitter<VerifyExamState> emit,
  ) {
    emit(
      state.copyWith(
        cardUploaded: false,
        cardVerified: false,
        cardOk: false,
        cardPreviewUrl: null,
        cardVerifyLog: '',
        cardErr: null,
        studentCode: '',
      ),
    );
  }

  // ==========================================
  // BƯỚC 2.1: CAMERA & ML KIT (CẬP NHẬT GIAO DIỆN)
  // ==========================================
  void _onUpdateBlinkPhase(
    UpdateBlinkPhaseEvent event,
    Emitter<VerifyExamState> emit,
  ) {
    emit(
      state.copyWith(
        blinkPhase: event.phase,
        blinkCount: event.count,
        leftEyePct: event.leftPct,
        rightEyePct: event.rightPct,
        blinkFaceOk: event.faceOk,
      ),
    );
  }

  void _onUpdateFaceGuide(
    UpdateFaceGuideEvent event,
    Emitter<VerifyExamState> emit,
  ) {
    emit(state.copyWith(faceGuideOk: event.isOk, faceGuideMsg: event.msg));
  }

  void _onFaceCaptured(FaceCapturedEvent event, Emitter<VerifyExamState> emit) {
    emit(state.copyWith(facePreviewPath: event.imagePath));
  }

  // ==========================================
  // BƯỚC 2.2: GỌI API LIVENESS & COMPARE
  // ==========================================
  Future<void> _onVerifyFaceApi(
    VerifyFaceApiEvent event,
    Emitter<VerifyExamState> emit,
  ) async {
    emit(
      state.copyWith(
        isVerifyingFace: true,
        faceVerifyLog: '⏳ Đang kiểm tra liveness...',
      ),
    );

    final result = await verifyFace(event.submissionId, state.facePreviewPath!);

    result.fold(
      (failure) => emit(
        state.copyWith(
          isVerifyingFace: false,
          faceUploaded: false,
          faceVerified: false,
          faceOk: false,
          faceErr: '❌ LỖI KHUÔN MẶT: ${failure.message}',
          faceVerifyLog: '❌ ${failure.message}',
        ),
      ),
      (data) {
        final conf = data['liveness']?['confidence']?.toString() ?? 'N/A';
        emit(
          state.copyWith(
            isVerifyingFace: false,
            faceUploaded: true, // Đã upload tạm
            faceVerified: true,
            faceErr: null,
            faceVerifyLog: '✅ KHUÔN MẶT HỢP LỆ!\nĐộ tin cậy: $conf%',
            // Nếu không cần so sánh thẻ SV thì đánh dấu faceOk luôn
            faceOk: state.examInfo?.requireStudentCard == false ? true : false,
          ),
        );
      },
    );
  }

  Future<void> _onCompareFacesApi(
    CompareFacesApiEvent event,
    Emitter<VerifyExamState> emit,
  ) async {
    emit(
      state.copyWith(
        isComparing: true,
        compareLog: '⏳ Đang so sánh khuôn mặt...',
      ),
    );

    final result = await compareFaces(event.submissionId);

    result.fold(
      (failure) => emit(
        state.copyWith(
          isComparing: false,
          facesCompared: false,
          faceOk: false,
          faceVerified: false, // Bắt chụp lại mặt
          facePreviewPath: null, // Xóa ảnh cũ
          faceErr: failure.message,
          compareLog: '❌ Không khớp: ${failure.message}. Vui lòng chụp lại.',
        ),
      ),
      (data) {
        emit(
          state.copyWith(
            isComparing: false,
            facesCompared: true,
            faceOk: true, // PASS SO SÁNH -> MỞ KHÓA BƯỚC 3
            compareLog: '✅ Độ tương đồng: ${data['confidence']}% > 50%',
          ),
        );
      },
    );
  }

  Future<void> _onUploadFinalImages(
    UploadFinalImagesEvent event,
    Emitter<VerifyExamState> emit,
  ) async {
    emit(state.copyWith(isLoading: true));

    // Thẻ SV giờ đã là API tự trả về (không upload file từ mobile nữa)
    // Nên cardPath ở đây có thể truyền null nếu logic backend của bạn đã lưu thẻ lúc VerifyStudentCode.
    final result = await uploadVerifiedImages(
      event.submissionId,
      state.facePreviewPath,
      null, // Tùy logic Backend của bạn
    );

    result.fold(
      (failure) => emit(
        state.copyWith(
          isLoading: false,
          faceErr: 'Lỗi lưu ảnh: ${failure.message}',
        ),
      ),
      (_) => emit(
        state.copyWith(
          isLoading: false,
          uploadSuccessMsg: 'Đã lưu trữ dữ liệu xác minh thành công!',
        ),
      ),
    );
  }

  void _onResetFace(
    ResetFaceVerificationEvent event,
    Emitter<VerifyExamState> emit,
  ) {
    emit(
      VerifyExamState(
        isLoading: state.isLoading,
        errorMessage: state.errorMessage,
        warningMessage: state.warningMessage,
        uploadSuccessMsg: state.uploadSuccessMsg,
        isKicked: state.isKicked,
        examInfo: state.examInfo,
        joinData: state.joinData,
        isBypassed: state.isBypassed,
        cardOk: state.cardOk,
        monitorOk: state.monitorOk,
        studentCode: state.studentCode,
        isSearchingCard: state.isSearchingCard,
        isVerifyingCard: state.isVerifyingCard,
        cardUploaded: state.cardUploaded,
        cardVerified: state.cardVerified,
        cardPreviewUrl: state.cardPreviewUrl,
        cardLocalPath: state.cardLocalPath,
        ocrProgress: state.ocrProgress,
        cardVerifyLog: state.cardVerifyLog,
        cardErr: state.cardErr,
        screenCount: state.screenCount,
        multiScreenDetected: state.multiScreenDetected,
        // Resetting face & blink fields to defaults:
        faceUploaded: false,
        faceVerified: false,
        facesCompared: false,
        faceOk: false,
        facePreviewPath: null,
        faceVerifyLog: '',
        compareLog: '',
        faceErr: null,
        blinkPhase: 'idle',
        blinkCount: 0,
        isDebugBlink: false,
        leftEyePct: 0,
        rightEyePct: 0,
        blinkFaceOk: false,
        faceGuideOk: false,
        faceGuideMsg: 'Hãy căn khuôn mặt vào khung và nhìn thẳng',
      ),
    );
  }

  void _onResetAll(
    ResetAllVerificationEvent event,
    Emitter<VerifyExamState> emit,
  ) {
    emit(const VerifyExamState());
  }

  // ==========================================
  // BƯỚC 3: MONITOR & SOCKET
  // ==========================================
  void _onEnableMonitor(
    EnableMonitorEvent event,
    Emitter<VerifyExamState> emit,
  ) {
    emit(state.copyWith(monitorOk: true, warningMessage: null));
  }

  void _onSocketBypass(
    SocketBypassGrantedEvent event,
    Emitter<VerifyExamState> emit,
  ) {
    emit(
      state.copyWith(
        isBypassed: true,
        faceOk: true,
        cardOk: true,
        faceErr: null,
        cardErr: null,
      ),
    );
  }

  void _onSocketKicked(SocketKickedEvent event, Emitter<VerifyExamState> emit) {
    emit(state.copyWith(isKicked: true, errorMessage: event.reason));
  }

  @override
  Future<void> close() {
    // Dọn dẹp socket khi rời khỏi trang
    _removeBypassListener?.call();
    _removeKickedListener?.call();
    return super.close();
  }
}
