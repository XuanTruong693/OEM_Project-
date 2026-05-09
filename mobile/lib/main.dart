import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import 'package:flutter_dotenv/flutter_dotenv.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';

import 'package:mobile/core/network/dio_client.dart';
import 'package:mobile/core/utils/excel_parser_service.dart';
import 'package:mobile/core/storage/secure_storage_helper.dart';
import 'package:mobile/core/utils/notification_helper.dart';

// --- IMPORT MÀN HÌNH AUTH ---
import 'package:mobile/features/auth/data/datasources/auth_remote_data_source.dart';
import 'package:mobile/features/auth/data/repositories/auth_repository_impl.dart';
import 'package:mobile/features/auth/domain/usecases/login_use_case.dart';
import 'package:mobile/features/auth/domain/usecases/register_use_case.dart';
import 'package:mobile/features/auth/domain/usecases/set_server_role_use_case.dart';
import 'package:mobile/features/auth/domain/usecases/send_otp_use_case.dart';
import 'package:mobile/features/auth/domain/usecases/verify_otp_use_case.dart';
import 'package:mobile/features/auth/domain/usecases/google_auth_use_case.dart';
import 'package:mobile/features/auth/domain/usecases/verify_room_use_case.dart';
import 'package:mobile/features/auth/presentation/pages/role_page.dart';
import 'package:mobile/features/auth/presentation/pages/login_page.dart';
import 'package:mobile/features/auth/presentation/pages/verify_room_page.dart';
import 'package:mobile/features/auth/presentation/pages/register_page.dart';
import 'package:mobile/features/auth/presentation/pages/forgot_password_page.dart';
import 'package:mobile/features/auth/presentation/pages/splash_page.dart';
import 'package:mobile/features/auth/presentation/bloc/auth_bloc.dart';

// --- IMPORT STUDENT EXAM ---
import 'package:mobile/features/student_exam/data/datasources/prepare_exam_remote_data_source.dart';
import 'package:mobile/features/student_exam/data/repositories/prepare_exam_repository_impl.dart';
import 'package:mobile/features/student_exam/domain/usecases/join_exam_use_case.dart';
import 'package:mobile/features/student_exam/domain/usecases/get_exam_public_info_use_case.dart';
import 'package:mobile/features/student_exam/domain/usecases/verify_student_code_use_case.dart';
import 'package:mobile/features/student_exam/domain/usecases/verify_face_use_case.dart';
import 'package:mobile/features/student_exam/domain/usecases/compare_faces_use_case.dart';
import 'package:mobile/features/student_exam/domain/usecases/upload_verified_images_use_case.dart';
import 'package:mobile/features/student_exam/presentation/bloc/prepare_exam_bloc.dart';
import 'package:mobile/features/student_exam/presentation/bloc/verify_exam_bloc.dart';
import 'package:mobile/features/student_exam/presentation/pages/prepare_exam_page.dart';

// --- IMPORT INSTRUCTOR DASHBOARD ---
import 'features/instructor/data/datasources/instructor_remote_data_source.dart';
import 'features/instructor/data/repositories/instructor_repository_impl.dart';
import 'features/instructor/domain/usecases/get_dashboard_stats_use_case.dart';
import 'features/instructor/domain/usecases/get_monthly_chart_use_case.dart';
import 'features/instructor/domain/usecases/get_my_exams_use_case.dart';
import 'features/instructor/domain/usecases/get_submissions_use_case.dart';
import 'features/instructor/domain/usecases/get_students_use_case.dart';
import 'features/instructor/presentation/pages/instructor_dashboard_page.dart';
import 'features/instructor/presentation/pages/instructor_dashboard_exams_list_page.dart';
import 'features/instructor/presentation/pages/instructor_dashboard_submissions_list_page.dart';
import 'features/instructor/presentation/bloc/instructor_dashboard_bloc.dart';
import 'features/instructor/presentation/bloc/instructor_dashboard_event.dart';
import 'features/instructor/presentation/bloc/instructor_exams_bloc.dart';
import 'features/instructor/presentation/bloc/instructor_submissions_bloc.dart';
import 'features/instructor/presentation/bloc/instructor_students_bloc.dart';
import 'features/instructor/presentation/pages/instructor_dashboard_students_list_page.dart';

// --- IMPORT EXAM MANAGEMENT ---
import 'features/exam_management/data/datasources/exam_management_remote_data_source.dart';
import 'features/exam_management/data/repositories/exam_management_repository_impl.dart';
import 'features/exam_management/presentation/bloc/exam_editor_bloc.dart';
import 'features/exam_management/presentation/pages/exam_edit_page.dart';
import 'features/exam_management/presentation/bloc/exam_preview_bloc.dart';
import 'features/exam_management/presentation/pages/exam_preview_page.dart';
import 'features/exam_management/domain/usecases/submit_exam_setting_use_case.dart';
import 'features/exam_management/presentation/bloc/exam_setting_bloc.dart';
import 'features/exam_management/presentation/pages/exam_setting_page.dart';
import 'features/exam_management/presentation/pages/open_room_success.dart';

// --- IMPORT EXAM BANK ---
import 'features/exam_bank/data/datasources/exam_bank_remote_data_source.dart';
import 'features/exam_bank/data/repositories/exam_bank_repository_impl.dart';
import 'features/exam_bank/domain/usecases/get_bank_exams_use_case.dart';
import 'features/exam_bank/domain/usecases/delete_bank_exam_use_case.dart';
import 'features/exam_bank/presentation/bloc/exam_bank_bloc.dart';
import 'features/exam_bank/presentation/pages/exam_bank_page.dart';

// --- IMPORT OPEN EXAM ---
import 'features/open_exam/data/datasources/open_exam_remote_data_source.dart';
import 'features/open_exam/data/repositories/open_exam_repository_impl.dart';
import 'features/open_exam/domain/usecases/get_open_exams_use_case.dart';
import 'features/open_exam/presentation/bloc/open_exam_bloc.dart';
import 'features/open_exam/presentation/pages/open_exam_page.dart';

// --- IMPORT ASSIGN EXAM ---
import 'features/assign_exam/data/datasources/assign_exam_local_data_source.dart';
import 'features/assign_exam/data/datasources/assign_exam_remote_data_source.dart';
import 'features/assign_exam/data/repositories/assign_exam_repository_impl.dart';
import 'features/assign_exam/domain/usecases/parse_exam_file_use_case.dart';
import 'features/assign_exam/domain/usecases/commit_exam_use_case.dart';
import 'features/assign_exam/presentation/bloc/assign_exam_bloc.dart';
import 'features/assign_exam/presentation/pages/assign_exam_page.dart';

// --- IMPORT EXAM RESULTS ---
import 'features/instructor_exam_results/data/datasources/exam_results_remote_datasource.dart';
import 'features/instructor_exam_results/presentation/bloc/exam_results_bloc.dart';
import 'features/instructor_exam_results/presentation/pages/instructor_exam_results_page.dart';
import 'features/instructor_exam_results/presentation/pages/result_detail_page.dart';
import 'features/instructor_exam_results/domain/entities/exam_result_entity.dart';

// --- IMPORT INSTRUCTOR ROOMS ---
import 'features/instructor_rooms/data/datasources/instructor_rooms_remote_datasource.dart';
import 'features/instructor_rooms/presentation/bloc/instructor_rooms_bloc.dart';
import 'features/instructor_rooms/presentation/bloc/instructor_room_detail_bloc.dart';
import 'features/instructor_rooms/presentation/pages/instructor_rooms_page.dart';
import 'features/instructor_rooms/presentation/pages/instructor_room_detail_page.dart';
import 'package:mobile/core/network/socket_client.dart';
import 'features/instructor/presentation/bloc/instructor_overlay_bloc.dart';
import 'features/instructor/presentation/bloc/instructor_overlay_event.dart';
import 'features/instructor/presentation/bloc/instructor_overlay_state.dart';

import 'features/student_exam/presentation/bloc/take_exam_bloc.dart';
import 'features/student_exam/presentation/pages/mobile_take_exam_page.dart';

// --- IMPORT PROFILE ---
import 'features/profile/data/datasources/profile_remote_data_source.dart';
import 'features/profile/data/repositories/profile_repository_impl.dart';
import 'features/profile/domain/usecases/get_profile_use_case.dart';
import 'features/profile/domain/usecases/update_profile_use_case.dart';
import 'features/profile/domain/usecases/update_avatar_use_case.dart';
import 'features/profile/presentation/bloc/profile_bloc.dart';
import 'features/profile/presentation/pages/profile_page.dart';

// --- IMPORT HOME / LANDING / STUDENT DASHBOARD ---
import 'landing_page.dart';
import 'features/student_dashboard/data/datasources/student_dashboard_remote_datasource.dart';
import 'features/student_dashboard/data/repositories/student_dashboard_repository_impl.dart';
import 'features/student_dashboard/domain/usecases/get_student_dashboard_data_usecase.dart';
import 'features/student_dashboard/presentation/bloc/student_dashboard_bloc.dart';
import 'features/student_dashboard/presentation/pages/student_dashboard_page.dart';

// --- IMPORT STUDENT HELPING ---
import 'features/student_helping/data/datasources/student_results_remote_datasource.dart';
import 'features/student_helping/data/repositories/student_results_repository_impl.dart';
import 'features/student_helping/presentation/bloc/results_list/results_list_bloc.dart';
import 'features/student_helping/presentation/bloc/result_detail/result_detail_bloc.dart';
import 'features/student_helping/presentation/pages/results_dashboard_page.dart';
import 'features/student_helping/presentation/pages/exam_guidelines_page.dart';
import 'features/student_helping/presentation/pages/support_page.dart';
import 'features/student_helping/domain/usecases/get_my_results_usecase.dart';
import 'features/student_helping/domain/usecases/get_result_detail_usecase.dart';
import 'features/student_helping/domain/usecases/filter_results_usecase.dart';

@pragma('vm:entry-point')
Future<void> _firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  await Firebase.initializeApp();
  await NotificationHelper.init();
  debugPrint("📩 Nhận thông báo chạy ngầm: ${message.notification?.title}");
  // Hệ điều hành đã tự động hiển thị thông báo đẩy FCM từ Server một cách tự nhiên khi app ở chế độ chạy nền / Home.
  // Không gọi NotificationHelper.showNotification ở đây để tránh bị lặp (double notification).
}

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await NotificationHelper.init();

  try {
    await Firebase.initializeApp();
    FirebaseMessaging.onBackgroundMessage(_firebaseMessagingBackgroundHandler);

    final messaging = FirebaseMessaging.instance;
    await messaging.requestPermission(
      alert: true,
      badge: true,
      sound: true,
    );

    final token = await messaging.getToken();
    if (token != null) {
      debugPrint("🔑 FCM Token: $token");
      await SecureStorageHelper.saveFcmToken(token);
    }

    FirebaseMessaging.onMessage.listen((RemoteMessage message) {
      // Khi đang mở app, giao diện trong ứng dụng (In-app overlay) sẽ hiển thị trực tiếp.
      // Không cần hiển thị thêm Banner thông báo cục bộ ở đây để tránh lặp.
    });
  } catch (e) {
    debugPrint("⚠️ Firebase Init error: $e");
  }

  // 👉 1.1 Khai báo biến nullable
  GoRouter? router;

  // 👉 1.2 Load biến môi trường từ file .env (Nếu có
  await dotenv.load(fileName: ".env");

  // 2. KHỞI TẠO DIO
  final dioClient = DioClient(
    onLogout: () {
      // Dùng dấu chấm hỏi (?) để gọi an toàn. Dart sẽ không la ó nữa.
      router?.go('/role');
    },
  );

  // 3. KHỞI TẠO AUTH
  final authRemoteDataSource = AuthRemoteDataSource(dioClient: dioClient);
  final authRepository = AuthRepositoryImpl(
    authRemoteDataSource: authRemoteDataSource,
  );
  final loginUseCase = LoginUseCase(repository: authRepository);
  final registerUseCase = RegisterUseCase(repository: authRepository);
  final setServerRoleUseCase = SetServerRoleUseCase(repository: authRepository);
  final sendOtpUseCase = SendOtpUseCase(repository: authRepository);
  final verifyOtpUseCase = VerifyOtpUseCase(repository: authRepository);
  final googleAuthUseCase = GoogleAuthUseCase(repository: authRepository);
  final verifyRoomUseCase = VerifyRoomUseCase(repository: authRepository);

  // 3.1 KHỞI TẠO PROFILE
  final profileRemoteDataSource = ProfileRemoteDataSourceImpl(
    dioClient: dioClient,
  );
  final profileRepository = ProfileRepositoryImpl(
    remoteDataSource: profileRemoteDataSource,
  );
  final getProfileUseCase = GetProfileUseCase(profileRepository);
  final updateProfileUseCase = UpdateProfileUseCase(profileRepository);
  final updateAvatarUseCase = UpdateAvatarUseCase(profileRepository);

  // 4. KHỞI TẠO INSTRUCTOR DASHBOARD
  final instructorRemoteDataSource = InstructorRemoteDataSourceImpl(
    dioClient: dioClient,
  );
  final instructorRepository = InstructorRepositoryImpl(
    remoteDataSource: instructorRemoteDataSource,
  );
  final getDashboardStatsUseCase = GetDashboardStatsUseCase(
    instructorRepository,
  );
  final getMonthlyChartUseCase = GetMonthlyChartUseCase(instructorRepository);
  final getMyExamsUseCase = GetMyExamsUseCase(instructorRepository);

  // 5. KHỞI TẠO QUẢN LÝ ĐỀ THI
  final examManagementDataSource = ExamManagementRemoteDataSourceImpl(
    dioClient: dioClient,
  );
  final examManagementRepository = ExamManagementRepositoryImpl(
    remoteDataSource: examManagementDataSource,
  );
  final excelParserService = ExcelParserService();
  final getSubmissionsUseCase = GetSubmissionsUseCase(instructorRepository);
  final getStudentsUseCase = GetStudentsUseCase(instructorRepository);
  final submitExamSettingUseCase = SubmitExamSettingUseCase(
    examManagementRepository,
  );

  // 6. KHỞI TẠO NGÂN HÀNG ĐỀ
  final examBankDataSource = ExamBankRemoteDataSourceImpl(dioClient: dioClient);
  final examBankRepository = ExamBankRepositoryImpl(
    remoteDataSource: examBankDataSource,
  );
  final getBankExamsUseCase = GetBankExamsUseCase(examBankRepository);
  final deleteBankExamUseCase = DeleteBankExamUseCase(examBankRepository);

  // 7. KHỞI TẠO OPEN EXAM
  final openExamDataSource = OpenExamRemoteDataSourceImpl(dioClient: dioClient);
  final openExamRepository = OpenExamRepositoryImpl(
    remoteDataSource: openExamDataSource,
  );
  final getOpenExamsUseCase = GetOpenExamsUseCase(openExamRepository);

  // 8. KHỞI TẠO ASSIGN EXAM
  final assignExamLocalDS = AssignExamLocalDataSourceImpl();
  final assignExamRemoteDS = AssignExamRemoteDataSourceImpl(
    dioClient: dioClient,
  );
  final assignExamRepo = AssignExamRepositoryImpl(
    localDataSource: assignExamLocalDS,
    remoteDataSource: assignExamRemoteDS,
  );

  final parseExamFileUseCase = ParseExamFileUseCase(assignExamRepo);
  final commitExamUseCase = CommitExamUseCase(assignExamRepo);

  // 9. KHỞI TẠO STUDENT EXAM
  final prepareExamRemoteDataSource = PrepareExamRemoteDataSourceImpl(
    dioClient: dioClient,
  );
  final prepareExamRepository = PrepareExamRepositoryImpl(
    remoteDataSource: prepareExamRemoteDataSource,
  );
  final joinExamUseCase = JoinExamUseCase(prepareExamRepository);
  final getExamPublicInfoUseCase = GetExamPublicInfoUseCase(
    prepareExamRepository,
  );
  final verifyStudentCodeUseCase = VerifyStudentCodeUseCase(
    prepareExamRepository,
  );
  final verifyFaceUseCase = VerifyFaceUseCase(prepareExamRepository);
  final compareFacesUseCase = CompareFacesUseCase(prepareExamRepository);
  final uploadVerifiedImagesUseCase = UploadVerifiedImagesUseCase(
    prepareExamRepository,
  );

  // GÁN GIÁ TRỊ THẬT CHO ROUTER
  router = GoRouter(
    initialLocation: '/splash',
    routes: [
      GoRoute(path: '/splash', builder: (context, state) => const SplashPage()),
      GoRoute(
        path: '/prepare-exam',
        builder: (context, state) {
          final examId =
              int.tryParse(state.uri.queryParameters['examId'] ?? '0') ?? 0;
          final roomToken = state.uri.queryParameters['roomToken'] ?? '';
          return MultiBlocProvider(
            providers: [
              BlocProvider<PrepareExamBloc>(
                create: (context) =>
                    PrepareExamBloc(joinExamUseCase: joinExamUseCase),
              ),
              BlocProvider<VerifyExamBloc>(
                create: (context) => VerifyExamBloc(
                  getExamPublicInfo: getExamPublicInfoUseCase,
                  verifyStudentCode: verifyStudentCodeUseCase,
                  verifyFace: verifyFaceUseCase,
                  compareFaces: compareFacesUseCase,
                  uploadVerifiedImages: uploadVerifiedImagesUseCase,
                ),
              ),
            ],
            child: PrepareExamPage(examId: examId, roomToken: roomToken),
          );
        },
      ),
      GoRoute(
        path: '/register',
        builder: (context, state) => const RegisterPage(),
      ),
      GoRoute(path: '/role', builder: (context, state) => const RolePage()),
      GoRoute(path: '/login', builder: (context, state) => const LoginPage()),
      GoRoute(
        path: '/forgot-password',
        builder: (context, state) => const ForgotPasswordPage(),
      ),
      GoRoute(
        path: '/verify-room',
        builder: (context, state) => const VerifyRoomPage(),
      ),
      GoRoute(
        path: '/instructor-dashboard',
        builder: (context, state) => const InstructorDashboardPage(),
      ),
      GoRoute(
        path: '/profile',
        builder: (context, state) => BlocProvider(
          create: (context) => ProfileBloc(
            getProfileUseCase: getProfileUseCase,
            updateProfileUseCase: updateProfileUseCase,
            updateAvatarUseCase: updateAvatarUseCase,
          ),
          child: const ProfilePage(),
        ),
      ),
      GoRoute(
        path: '/instructor-dashboard/exams',
        builder: (context, state) => const InstructorExamsListPage(),
      ),

      // Route Danh sách bài nộp
      GoRoute(
        path: '/instructor-dashboard/submissions',
        builder: (context, state) {
          return BlocProvider(
            create: (context) => InstructorSubmissionsBloc(
              getSubmissionsUseCase: getSubmissionsUseCase,
            ),
            child: const InstructorSubmissionsListPage(),
          );
        },
      ),

      // Route Danh sách thí sinh
      GoRoute(
        path: '/instructor-dashboard/students',
        builder: (context, state) {
          return BlocProvider(
            create: (context) =>
                InstructorStudentsBloc(getStudentsUseCase: getStudentsUseCase),
            child: const InstructorStudentsListPage(),
          );
        },
      ),

      // Route Chỉnh sửa đề thi
      GoRoute(
        path: '/instructor-dashboard/exams/:id/edit',
        builder: (context, state) {
          final examId = state.pathParameters['id']!;
          return BlocProvider(
            create: (context) => ExamEditorBloc(
              repository: examManagementRepository,
              excelParser: excelParserService,
            ),
            child: ExamEditPage(examId: examId),
          );
        },
      ),

      // Route Xem trước đề thi
      GoRoute(
        path: '/instructor-dashboard/exams/:id/preview',
        builder: (context, state) {
          final examId = state.pathParameters['id']!;
          return BlocProvider(
            create: (context) =>
                ExamPreviewBloc(repository: examManagementRepository),
            child: ExamPreviewPage(examId: examId),
          );
        },
      ),

      // Route Ngân hàng đề thi
      GoRoute(
        path: '/exam-bank',
        builder: (context, state) {
          // Cấp phát BLoC dạng Lazy: Chỉ khi vào trang này BLoC mới được tạo
          return BlocProvider(
            create: (context) => ExamBankBloc(
              getBankExamsUseCase: getBankExamsUseCase,
              deleteBankExamUseCase: deleteBankExamUseCase,
            ),
            child: const ExamBankPage(),
          );
        },
      ),

      // Route Mở đề thi
      GoRoute(
        path:
            '/open-exam', // Khớp chính xác với route trong instructor_drawer.dart
        builder: (context, state) {
          // Khởi tạo BlocProvider dạng Lazy:
          // Bloc sẽ chỉ được tạo ra khi người dùng thực sự chuyển vào trang này.
          return BlocProvider(
            create: (context) =>
                OpenExamBloc(getOpenExamsUseCase: getOpenExamsUseCase),
            child: const OpenExamPage(),
          );
        },
      ),

      // Route tải đề thi lên
      GoRoute(
        path: '/assign-exam', // Khớp chính xác với Drawer
        builder: (context, state) {
          // Khởi tạo BlocProvider (Lazy Loading)
          return BlocProvider(
            create: (context) => AssignExamBloc(
              parseExamFileUseCase: parseExamFileUseCase,
              commitExamUseCase: commitExamUseCase,
            ),
            child: const AssignExamPage(),
          );
        },
      ),

      // Route Cấu hình & Mở phòng thi
      GoRoute(
        path: '/exam-settings/:id',
        builder: (context, state) {
          // Lấy ID từ URL và ép kiểu sang int
          final examId = int.parse(state.pathParameters['id']!);

          return BlocProvider(
            create: (context) => ExamSettingBloc(
              submitExamSettingUseCase: submitExamSettingUseCase,
            ),
            child: ExamSettingPage(examId: examId),
          );
        },
      ),

      // Route Mở phòng thi thành công
      GoRoute(
        path: '/open-success/:id',
        builder: (context, state) {
          // Lấy examId từ path parameter
          final examId = int.parse(state.pathParameters['id']!);
          // Lấy roomCode từ query parameter (?room=...)
          final roomCode = state.uri.queryParameters['room'] ?? '';

          return OpenRoomSuccessPage(examId: examId, roomCode: roomCode);
        },
      ),

      // Route Kết quả bài thi
      GoRoute(
        path: '/instructor/exam-results',
        builder: (context, state) {
          final examId = state.uri.queryParameters['exam_id'];
          return BlocProvider(
            create: (context) =>
                ExamResultsBloc(ExamResultsRemoteDataSource(dioClient)),
            child: InstructorExamResultsPage(initialExamId: examId),
          );
        },
      ),
      GoRoute(
        path: '/instructor/exam-results/detail',
        builder: (context, state) {
          final extra = state.extra as Map<String, dynamic>?;
          if (extra == null) {
            return const Scaffold(
              body: Center(child: Text("Không tìm thấy dữ liệu bài thi")),
            );
          }
          return ResultDetailPage(
            result: extra['result'] as ExamResultEntity,
            examId: (extra['examId'] ?? '').toString(),
          );
        },
      ),

      // Route Quản lý phòng thi
      GoRoute(
        path: '/instructor/rooms',
        builder: (context, state) {
          return BlocProvider(
            create: (context) =>
                InstructorRoomsBloc(InstructorRoomsRemoteDataSource(dioClient)),
            child: const InstructorRoomsPage(),
          );
        },
      ),
      GoRoute(
        path: '/instructor/rooms/:id',
        builder: (context, state) {
          final id = state.pathParameters['id']!;
          return BlocProvider(
            create: (context) => InstructorRoomDetailBloc(
              InstructorRoomsRemoteDataSource(dioClient),
              socketClient,
            ),
            child: InstructorRoomDetailPage(id: id),
          );
        },
      ),
      GoRoute(
        path: '/exam/:id/take',
        builder: (context, state) {
          final examId = state.pathParameters['id']!;
          final submissionId = state.uri.queryParameters['submission_id'] ?? '';
          return BlocProvider(
            create: (context) => TakeExamBloc(dioClient: dioClient),
            child: MobileTakeExamPage(
              examId: examId,
              submissionId: submissionId,
            ),
          );
        },
      ),
      GoRoute(
        path: '/landing',
        builder: (context, state) => const LandingPage(),
      ),
      GoRoute(
        path: '/student-dashboard',
        builder: (context, state) {
          final repo = StudentDashboardRepositoryImpl(
            StudentDashboardRemoteDataSource(dioClient),
          );
          return BlocProvider(
            create: (context) => StudentDashboardBloc(
              getDashboardDataUseCase: GetStudentDashboardDataUseCase(repo),
            ),
            child: const StudentDashboardPage(),
          );
        },
      ),
      GoRoute(
        path: '/student-dashboard/results',
        builder: (context, state) {
          final remoteDS = StudentResultsRemoteDataSource(
            dioClient: dioClient,
            socketClient: socketClient,
          );
          final repo = StudentResultsRepositoryImpl(remoteDS);
          return MultiBlocProvider(
            providers: [
              BlocProvider<ResultsListBloc>(
                create: (context) => ResultsListBloc(
                  getMyResultsUseCase: GetMyResultsUseCase(repo),
                  filterResultsUseCase: FilterResultsUseCase(),
                  repository: repo,
                ),
              ),
              BlocProvider<ResultDetailBloc>(
                create: (context) => ResultDetailBloc(
                  getResultDetailUseCase: GetResultDetailUseCase(repo),
                ),
              ),
            ],
            child: const ResultsDashboardPage(),
          );
        },
      ),
      GoRoute(
        path: '/student-dashboard/guidelines',
        builder: (context, state) => const ExamGuidelinesPage(),
      ),
      GoRoute(
        path: '/student-dashboard/support',
        builder: (context, state) => const SupportPage(),
      ),
    ],
  );

  //  CHẠY APP
  runApp(
    MultiBlocProvider(
      providers: [
        BlocProvider<AuthBloc>(
          create: (context) => AuthBloc(
            loginUseCase: loginUseCase,
            registerUseCase: registerUseCase,
            setServerRoleUseCase: setServerRoleUseCase,
            sendOtpUseCase: sendOtpUseCase,
            verifyOtpUseCase: verifyOtpUseCase,
            googleAuthUseCase: googleAuthUseCase,
            verifyRoomUseCase: verifyRoomUseCase,
          ),
        ),
        BlocProvider<InstructorDashboardBloc>(
          create: (context) => InstructorDashboardBloc(
            getDashboardStatsUseCase: getDashboardStatsUseCase,
            getMonthlyChartUseCase: getMonthlyChartUseCase,
            getProfileUseCase: getProfileUseCase,
            getMyExamsUseCase: getMyExamsUseCase,
          )..add(LoadDashboardDataEvent()),
        ),
        BlocProvider<InstructorExamsBloc>(
          create: (context) =>
              InstructorExamsBloc(getMyExamsUseCase: getMyExamsUseCase),
        ),
        BlocProvider<InstructorOverlayBloc>(
          create: (context) => InstructorOverlayBloc(socketClient),
        ),
      ],
      child: MyApp(router: router),
    ),
  );
}

class MyApp extends StatefulWidget {
  final GoRouter router;
  const MyApp({super.key, required this.router});

  @override
  State<MyApp> createState() => _MyAppState();
}

class _MyAppState extends State<MyApp> with WidgetsBindingObserver {
  bool _isOverlayOpen = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      print("📱 [MyApp] App resumed, ensuring socket connection is active");
      if (socketClient.socket != null && !socketClient.isConnected) {
        print("🔌 [MyApp] Socket disconnected on resume, force reconnecting...");
        socketClient.socket?.connect();
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return MaterialApp.router(
      title: 'OEM',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(primarySwatch: Colors.blue, useMaterial3: true),
      routerConfig: widget.router,
      builder: (context, child) {
        return BlocListener<InstructorOverlayBloc, InstructorOverlayState>(
          listener: (context, state) async {
            if (state is InstructorOverlayActive) {
              final role = await SecureStorageHelper.getSelectedRole();
              print("🔍 [MyApp Overlay] Current user role: $role");
              if (role == 'student') {
                print(
                  "ℹ️ [MyApp Overlay] User is a student, not showing overlay",
                );
                return;
              }
              
              if (_isOverlayOpen) {
                // Đóng dialog hiện tại (nếu có) trước khi hiển thị dialog mới (ưu tiên)
                final navContext = widget.router.configuration.navigatorKey.currentContext;
                if (navContext != null) {
                  Navigator.of(navContext).pop('interrupt');
                }
              }

              _isOverlayOpen = true;
              print(
                "🚨 [MyApp] Displaying global cheating dialog for student: ${state.violation.studentName}",
              );
              _showGlobalCheatingDialog(context, state.violation);
            }
          },
          child: child!,
        );
      },
    );
  }

  void _showGlobalCheatingDialog(BuildContext context, dynamic violation) {
    if (violation != null && violation.deviceChange == true) {
      _showDeviceChangeDialog(context, violation).then((_) {
        _isOverlayOpen = false;
      });
      return;
    }
    showDialog(
      context: widget.router.configuration.navigatorKey.currentContext ?? context,
      barrierDismissible: false,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        contentPadding: EdgeInsets.zero,
        content: SizedBox(
          width: double.maxFinite,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              // --- HEADER ---
              Container(
                padding: const EdgeInsets.symmetric(vertical: 16),
                decoration: const BoxDecoration(
                  color: Color(0xFFC62828), // Đỏ đậm
                  borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Image.asset(
                      'assets/images/warning_icon.png',
                      height: 30,
                      errorBuilder: (c, e, s) => const Icon(
                        Icons.warning_amber_rounded,
                        color: Colors.white,
                        size: 30,
                      ),
                    ),
                    const SizedBox(width: 10),
                    const Text(
                      "CẢNH BÁO GIAN LẬN",
                      style: TextStyle(
                        color: Colors.white,
                        fontWeight: FontWeight.bold,
                        fontSize: 18,
                        letterSpacing: 0.5,
                      ),
                    ),
                  ],
                ),
              ),

              Padding(
                padding: const EdgeInsets.all(20),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // --- SINH VIÊN ---
                    _buildSectionTitle("SINH VIÊN"),
                    const SizedBox(height: 4),
                    Text(
                      violation.studentName,
                      style: const TextStyle(
                        fontWeight: FontWeight.bold,
                        fontSize: 20,
                        color: Color(0xFF1A237E),
                      ),
                    ),
                    const SizedBox(height: 16),

                    // --- LOẠI VI PHẠM ---
                    _buildSectionTitle("LOẠI VI PHẠM"),
                    const SizedBox(height: 4),
                    Text(
                      "[AI PHÁT HIỆN] ${_getViolationTitle(violation.eventType).toUpperCase()}",
                      style: const TextStyle(
                        color: Colors.red,
                        fontWeight: FontWeight.bold,
                        fontSize: 15,
                      ),
                    ),
                    const SizedBox(height: 8),
                    Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: Colors.grey[50],
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: Colors.grey[200]!),
                      ),
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Icon(
                            Icons.description_outlined,
                            size: 18,
                            color: Colors.grey,
                          ),
                          const SizedBox(width: 8),
                          Expanded(
                            child: Text(
                              _getViolationDescription(violation.eventType),
                              style: TextStyle(
                                color: Colors.grey[700],
                                fontSize: 13,
                                height: 1.4,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 16),

                    // --- GRID MỨC ĐỘ & LẦN VI PHẠM ---
                    Row(
                      children: [
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              _buildSectionTitle("MỨC ĐỘ"),
                              const SizedBox(height: 6),
                              Container(
                                padding: const EdgeInsets.symmetric(
                                  horizontal: 12,
                                  vertical: 6,
                                ),
                                decoration: BoxDecoration(
                                  color: Colors.red,
                                  borderRadius: BorderRadius.circular(20),
                                ),
                                child: const Row(
                                  mainAxisSize: MainAxisSize.min,
                                  children: [
                                    Icon(
                                      Icons.circle,
                                      color: Colors.white,
                                      size: 8,
                                    ),
                                    SizedBox(width: 6),
                                    Text(
                                      "CAO",
                                      style: TextStyle(
                                        color: Colors.white,
                                        fontWeight: FontWeight.bold,
                                        fontSize: 12,
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            ],
                          ),
                        ),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              _buildSectionTitle("LẦN VI PHẠM"),
                              const SizedBox(height: 6),
                              Text(
                                "${violation.cheatingCount} / 10",
                                style: const TextStyle(
                                  fontWeight: FontWeight.bold,
                                  fontSize: 22,
                                  color: Colors.orange,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 16),

                    // --- THỜI GIAN ---
                    _buildSectionTitle("THỜI GIAN PHÁT HIỆN"),
                    const SizedBox(height: 4),
                    Text(
                      _formatNow(),
                      style: TextStyle(color: Colors.grey[600], fontSize: 14),
                    ),
                  ],
                ),
              ),

              // --- BUTTON ---
              Padding(
                padding: const EdgeInsets.only(left: 20, right: 20, bottom: 20),
                child: SizedBox(
                  width: double.infinity,
                  height: 50,
                  child: ElevatedButton(
                    onPressed: () {
                      context.read<InstructorOverlayBloc>().add(
                        DismissOverlayEvent(),
                      );
                      Navigator.of(ctx).pop();
                    },
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFF2962FF), // Blue
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12),
                      ),
                      elevation: 0,
                    ),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        const Icon(Icons.check, color: Colors.white, size: 20),
                        const SizedBox(width: 8),
                        const Text(
                          "Tiếp tục giám sát",
                          style: TextStyle(
                            color: Colors.white,
                            fontWeight: FontWeight.bold,
                            fontSize: 16,
                          ),
                        ),
                        const SizedBox(width: 8),
                        Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 8,
                            vertical: 2,
                          ),
                          decoration: BoxDecoration(
                            color: Colors.white24,
                            borderRadius: BorderRadius.circular(4),
                          ),
                          child: Text(
                            "+${violation.cheatingCount}",
                            style: const TextStyle(
                              color: Colors.white,
                              fontSize: 12,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    ).then((_) {
      _isOverlayOpen = false;
    });
  }

  Widget _buildSectionTitle(String title) {
    return Text(
      title,
      style: TextStyle(
        color: Colors.grey[400],
        fontSize: 11,
        fontWeight: FontWeight.bold,
        letterSpacing: 0.5,
      ),
    );
  }

  String _getViolationTitle(String eventType) {
    final dict = {
      'alt_tab': "Chuyển ứng dụng (Alt+Tab)",
      'visibility_hidden': "Ẩn tab bài thi",
      'window_blur': "Click ngoài cửa sổ",
      'fullscreen_lost': "Thoát toàn màn hình",
      'split_screen': "Chia đôi màn hình",
      'multi_monitor_attempt': "Kết nối đa màn hình",
      'screenshot_attempt': "Chụp ảnh màn hình",
      'blocked_key': "Sử dụng phím tắt cấm",
      'inactivity': "Không hoạt động",
    };
    return dict[eventType] ?? eventType;
  }

  String _getViolationDescription(String eventType) {
    final dict = {
      'alt_tab':
          "Nhấn phím tắt Alt+Tab để chuyển nhanh sang ứng dụng/tài liệu khác.",
      'visibility_hidden':
          "Cố tình ẩn cửa sổ bài thi để truy cập trình duyệt hoặc phần mềm khác.",
      'window_blur':
          "Mất tiêu điểm vào bài thi. Có thể đang thao tác trên một cửa sổ ứng dụng khác.",
      'fullscreen_lost':
          "Thoát khỏi chế độ bắt buộc toàn màn hình để gian lận.",
      'split_screen':
          "Sử dụng tính năng chia đôi màn hình để xem tài liệu song song.",
      'multi_monitor_attempt':
          "Hệ thống phát hiện có thêm màn hình thứ hai đang được kết nối.",
      'screenshot_attempt':
          "Cố gắng sao lưu nội dung đề thi bằng tính năng chụp màn hình.",
      'blocked_key': "Sử dụng các tổ hợp phím bị cấm trong quá trình thi.",
      'inactivity':
          "Thí sinh không có bất kỳ thao tác nào trong thời gian dài.",
    };
    return dict[eventType] ??
        "Phát hiện hành vi bất thường trong quá trình làm bài.";
  }

  String _formatNow() {
    final now = DateTime.now();
    return "${now.hour}:${now.minute}:${now.second}  ${now.day}/${now.month}/${now.year}";
  }

  Future<void> _showDeviceChangeDialog(BuildContext context, dynamic violation) {
    return showDialog(
      context: widget.router.configuration.navigatorKey.currentContext ?? context,
      barrierDismissible: false,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        contentPadding: EdgeInsets.zero,
        content: SizedBox(
          width: double.maxFinite,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                padding: const EdgeInsets.symmetric(vertical: 16),
                decoration: const BoxDecoration(
                  color: Color(0xFFFF8F00),
                  borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
                ),
                child: const Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(
                      Icons.warning_amber_rounded,
                      color: Colors.white,
                      size: 30,
                    ),
                    SizedBox(width: 10),
                    Text(
                      "XIN ĐỔI THIẾT BỊ",
                      style: TextStyle(
                        color: Colors.white,
                        fontWeight: FontWeight.bold,
                        fontSize: 18,
                        letterSpacing: 0.5,
                      ),
                    ),
                  ],
                ),
              ),
              Padding(
                padding: const EdgeInsets.all(20),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    _buildSectionTitle("SINH VIÊN"),
                    const SizedBox(height: 4),
                    Text(
                      violation.studentName,
                      style: const TextStyle(
                        fontWeight: FontWeight.bold,
                        fontSize: 20,
                        color: Color(0xFF1A237E),
                      ),
                    ),
                    const SizedBox(height: 16),
                    _buildSectionTitle("LÝ DO XIN ĐỔI MÁY"),
                    const SizedBox(height: 4),
                    Text(
                      violation.reason.isEmpty
                          ? "Không có lý do cụ thể"
                          : violation.reason,
                      style: const TextStyle(
                        color: Colors.red,
                        fontWeight: FontWeight.bold,
                        fontSize: 15,
                      ),
                    ),
                    const SizedBox(height: 16),
                    _buildSectionTitle("THIẾT BỊ TRUY CẬP"),
                    const SizedBox(height: 6),
                    Text(
                      "Máy 1: ${violation.firstDeviceName.isEmpty ? "Không rõ" : violation.firstDeviceName}",
                      style: TextStyle(color: Colors.grey[600], fontSize: 13),
                    ),
                    Text(
                      "Máy 2: ${violation.secondDeviceName.isEmpty ? "Không rõ" : violation.secondDeviceName}",
                      style: TextStyle(color: Colors.grey[600], fontSize: 13),
                    ),
                    const SizedBox(height: 16),
                    _buildSectionTitle("THỜI GIAN YÊU CẦU"),
                    const SizedBox(height: 4),
                    Text(
                      _formatNow(),
                      style: TextStyle(color: Colors.grey[600], fontSize: 14),
                    ),
                  ],
                ),
              ),
              Padding(
                padding: const EdgeInsets.only(left: 20, right: 20, bottom: 20),
                child: Row(
                  children: [
                    Expanded(
                      child: SizedBox(
                        height: 50,
                        child: ElevatedButton(
                          onPressed: () async {
                            final subId = violation.submissionId;
                            try {
                              final dio = DioClient(onLogout: () {});
                              await dio.dio.post(
                                '/instructor/rooms/students/$subId/device-approval',
                                data: {'action': 'approved'},
                              );
                              ScaffoldMessenger.of(context).showSnackBar(
                                const SnackBar(
                                  content: Text(
                                    'Phê duyệt đổi máy thành công!',
                                  ),
                                  backgroundColor: Colors.green,
                                ),
                              );
                            } catch (e) {
                              ScaffoldMessenger.of(context).showSnackBar(
                                SnackBar(
                                  content: Text('Phê duyệt thất bại: $e'),
                                  backgroundColor: Colors.red,
                                ),
                              );
                            }
                            context.read<InstructorOverlayBloc>().add(
                              DismissOverlayEvent(),
                            );
                            Navigator.of(ctx).pop();
                          },
                          style: ElevatedButton.styleFrom(
                            backgroundColor: Colors.green,
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(12),
                            ),
                          ),
                          child: const Text(
                            "Duyệt đổi máy",
                            style: TextStyle(
                              color: Colors.white,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: SizedBox(
                        height: 50,
                        child: OutlinedButton(
                          onPressed: () async {
                            final subId = violation.submissionId;
                            try {
                              final dio = DioClient(onLogout: () {});
                              await dio.dio.post(
                                '/instructor/rooms/students/$subId/device-approval',
                                data: {'action': 'rejected'},
                              );
                              ScaffoldMessenger.of(context).showSnackBar(
                                const SnackBar(
                                  content: Text('Đã từ chối yêu cầu đổi máy.'),
                                  backgroundColor: Colors.orange,
                                ),
                              );
                            } catch (e) {
                              ScaffoldMessenger.of(context).showSnackBar(
                                SnackBar(
                                  content: Text('Từ chối thất bại: $e'),
                                  backgroundColor: Colors.red,
                                ),
                              );
                            }
                            context.read<InstructorOverlayBloc>().add(
                              DismissOverlayEvent(),
                            );
                            Navigator.of(ctx).pop();
                          },
                          style: OutlinedButton.styleFrom(
                            side: const BorderSide(color: Colors.red),
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(12),
                            ),
                          ),
                          child: const Text(
                            "Từ chối",
                            style: TextStyle(
                              color: Colors.red,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
