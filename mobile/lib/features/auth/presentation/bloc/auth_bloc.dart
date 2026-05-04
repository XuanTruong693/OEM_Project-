import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:mobile/features/auth/domain/usecases/login_use_case.dart';
import 'package:mobile/features/auth/domain/usecases/register_use_case.dart';
import 'package:mobile/features/auth/domain/usecases/send_otp_use_case.dart';
import 'package:mobile/features/auth/domain/usecases/verify_otp_use_case.dart';
import 'package:mobile/features/auth/domain/usecases/set_server_role_use_case.dart';
import '../../domain/usecases/verify_room_use_case.dart';

// 👉 THÊM IMPORT USE CASE CỦA GOOGLE
import 'package:mobile/features/auth/domain/usecases/google_auth_use_case.dart';
import 'package:mobile/features/auth/presentation/bloc/auth_event.dart';
import 'package:mobile/features/auth/presentation/bloc/auth_state.dart';
import 'package:mobile/core/storage/secure_storage_helper.dart';
import 'package:google_sign_in/google_sign_in.dart';
import 'package:flutter_dotenv/flutter_dotenv.dart';

class AuthBloc extends Bloc<AuthEvent, AuthState> {
  final RegisterUseCase registerUseCase;
  final LoginUseCase loginUseCase;
  final SetServerRoleUseCase setServerRoleUseCase;
  final SendOtpUseCase sendOtpUseCase;
  final VerifyOtpUseCase verifyOtpUseCase;
  final GoogleAuthUseCase googleAuthUseCase;
  final VerifyRoomUseCase verifyRoomUseCase;

  // 👉 DÁN WEB CLIENT ID VÀO ĐÂY (Bắt buộc khai báo ở cấp độ Class)
  final GoogleSignIn _googleSignIn = GoogleSignIn.instance;

  AuthBloc({
    required this.registerUseCase,
    required this.loginUseCase,
    required this.setServerRoleUseCase,
    required this.sendOtpUseCase,
    required this.verifyOtpUseCase,
    required this.googleAuthUseCase,
    required this.verifyRoomUseCase,
  }) : super(AuthInitial()) {
    final clientId = dotenv.env['GOOGLE_SERVER_CLIENT_ID'] ?? '';

    _googleSignIn.initialize(serverClientId: clientId);

    on<SelectRoleEvent>(_onSelectRole);
    on<SendOtpEvent>(_onSendOtp);
    on<VerifyOtpEvent>(_onVerifyOtp);
    on<RegisterSubmitEvent>(_onRegister);
    on<LoginEvent>(_onLogin);
    on<GoogleAuthEvent>(_onGoogleAuth);
    on<VerifyRoomSubmitEvent>(_onVerifyRoomSubmit);
  }

  // --- HÀM XỬ LÝ ĐĂNG KÝ ---
  Future<void> _onRegister(
    RegisterSubmitEvent event,
    Emitter<AuthState> emit,
  ) async {
    emit(AuthLoading());
    try {
      final user = await registerUseCase(
        fullName: event.fullName,
        email: event.email,
        password: event.password,
        role: event.role,
        roomCode: event.roomId,
      );

      if (user.accessToken.isNotEmpty) {
        await SecureStorageHelper.saveTokens(
          accessToken: user.accessToken,
          refreshToken: user.refreshToken,
        );
        await SecureStorageHelper.saveSelectedRole(
          user.role,
        ); // 🔴 BẮT BUỘC ĐỂ KHÔNG BỊ LỖI 403
      }

      emit(AuthSuccess(message: "Registration successful", role: user.role));
    } catch (e) {
      emit(AuthFailure(error: e.toString()));
    }
  }

  // --- HÀM XỬ LÝ ĐĂNG NHẬP (EMAIL/PASSWORD) ---
  Future<void> _onLogin(LoginEvent event, Emitter<AuthState> emit) async {
    emit(AuthLoading());
    try {
      final user = await loginUseCase(
        email: event.email,
        password: event.password,
        role: event.role,
        roomId: event.roomId,
      );

      // Lưu token nếu backend trả về thành công
      if (user.accessToken.isNotEmpty) {
        await SecureStorageHelper.saveTokens(
          accessToken: user.accessToken,
          refreshToken: user.refreshToken,
        );
        await SecureStorageHelper.saveSelectedRole(
          user.role,
        ); // 🔴 BẮT BUỘC ĐỂ KHÔNG BỊ LỖI 403
      }

      emit(AuthSuccess(message: "Đăng nhập thành công", role: user.role));
    } catch (e) {
      final errorStr = e.toString();
      if (errorStr.contains('require_2fa:')) {
        final email = errorStr.split('require_2fa:')[1];
        emit(AuthRequire2FA(email: email.trim()));
      } else {
        emit(AuthFailure(error: e.toString()));
      }
    }
  }

  // --- HÀM CHỌN ROLE ---
  Future<void> _onSelectRole(
    SelectRoleEvent event,
    Emitter<AuthState> emit,
  ) async {
    emit(AuthLoading());
    try {
      await setServerRoleUseCase(event.role);
      await SecureStorageHelper.clearAll();
      await SecureStorageHelper.saveSelectedRole(event.role);
      emit(RoleSelectedState(event.role));
    } catch (e) {
      emit(AuthFailure(error: e.toString()));
    }
  }

  // --- HÀM XỬ LÝ GỬI OTP ---
  Future<void> _onSendOtp(SendOtpEvent event, Emitter<AuthState> emit) async {
    emit(AuthLoading());
    try {
      await sendOtpUseCase(event.email);
      emit(AuthOtpSentSuccess());
    } catch (e) {
      emit(AuthFailure(error: e.toString()));
    }
  }

  // --- HÀM XỬ LÝ XÁC THỰC OTP ---
  Future<void> _onVerifyOtp(
    VerifyOtpEvent event,
    Emitter<AuthState> emit,
  ) async {
    emit(AuthLoading());
    try {
      await verifyOtpUseCase(email: event.email, otp: event.otp);
      emit(AuthOtpVerifiedSuccess());
    } catch (e) {
      emit(AuthFailure(error: e.toString()));
    }
  }

  // --- HÀM XỬ LÝ ĐĂNG NHẬP GOOGLE ---
  Future<void> _onGoogleAuth(
    GoogleAuthEvent event,
    Emitter<AuthState> emit,
  ) async {
    emit(AuthLoading());
    try {
      // 1. CHUẨN MỚI: Dùng authenticate() thay cho signIn()
      final GoogleSignInAccount googleUser = await _googleSignIn.authenticate(
        scopeHint: ['email', 'profile'],
      );

      // 2. Lấy Token (Khúc này giữ nguyên)
      final GoogleSignInAuthentication googleAuth = googleUser.authentication;
      final idToken = googleAuth.idToken;

      if (idToken == null) {
        emit(AuthFailure(error: "Không lấy được token từ Google"));
        return;
      }

      final role = await SecureStorageHelper.getSelectedRole() ?? 'instructor';

      // Tạm thời comment roomId lại nếu bạn chưa lưu mã phòng thi xuống SecureStorage
      // String? roomId = await SecureStorageHelper.getRoomId();

      // 3. Gọi anh Giám đốc UseCase (Chạy file của bạn)
      final user = await googleAuthUseCase(
        idToken: idToken,
        role: role,
        roomId: event.roomId,
      );

      if (user.accessToken.isNotEmpty) {
        await SecureStorageHelper.saveTokens(
          accessToken: user.accessToken,
          refreshToken: user.refreshToken,
        );
        await SecureStorageHelper.saveSelectedRole(
          user.role,
        ); // 🔴 BẮT BUỘC ĐỂ KHÔNG BỊ LỖI 403
      }

      emit(AuthSuccess(message: "Đăng ký Google thành công", role: user.role));
    } catch (e) {
      await _googleSignIn.signOut();

      // IN LỖI RA MÀN HÌNH ĐỂ BIẾT TẠI SAO HỎNG
      final errorStr = e.toString();
      if (errorStr.toLowerCase().contains('canceled') ||
          errorStr.toLowerCase().contains('cancelled') ||
          errorStr.toLowerCase().contains('sign_in_canceled')) {
        emit(AuthFailure(error: "Google đã từ chối: $errorStr"));
      } else {
        emit(AuthFailure(error: "Lỗi kết nối/Google: $errorStr"));
      }
    }
  }

  // --- HÀM XỬ LÝ XÁC THỰC MÃ PHÒNG ---
  Future<void> _onVerifyRoomSubmit(
    VerifyRoomSubmitEvent event,
    Emitter<AuthState> emit,
  ) async {
    emit(AuthLoading()); // Bật vòng xoay xoay

    // Gọi xuống UseCase
    final result = await verifyRoomUseCase(event.roomCode);

    // Xử lý kết quả trả về từ Either (Trái là Lỗi, Phải là Thành Công)
    result.fold(
      (failure) {
        emit(AuthVerifyRoomFailure(errorMessage: failure.message));
      },
      (entity) {
        emit(
          AuthVerifyRoomSuccess(
            entity: entity,
            originalRoomCode: event.roomCode,
          ),
        );
      },
    );
  }
}
