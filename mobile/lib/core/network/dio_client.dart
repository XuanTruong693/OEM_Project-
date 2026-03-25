import 'package:dio/dio.dart';
import '../storage/secure_storage_helper.dart';

class DioClient {
  // IP của máy ảo Android gọi về localhost của máy tính là 10.0.2.2
  static const String baseUrl = 'http://10.0.2.2:5000/api';

  final Dio dio;

  DioClient()
    : dio = Dio(
        BaseOptions(
          baseUrl: baseUrl,
          connectTimeout: const Duration(seconds: 10),
        ),
      ) {
    _initializeInterceptors();
  }

  void _initializeInterceptors() {
    dio.interceptors.add(
      InterceptorsWrapper(
        // 1. TRƯỚC KHI GỬI REQUEST: Nhét Token vào Header
        onRequest: (options, handler) async {
          final accessToken = await SecureStorageHelper.getAccessToken();
          if (accessToken != null) {
            options.headers['Authorization'] = 'Bearer $accessToken';
          }
          return handler.next(options);
        },

        // 2. KHI NHẬN RESPONSE BÌNH THƯỜNG: Cho qua
        onResponse: (response, handler) {
          return handler.next(response);
        },

        // 3. KHI CÓ LỖI (Đặc biệt là lỗi 401 Hết hạn Token)
        onError: (DioException e, handler) async {
          if (e.response?.statusCode == 401) {
            // Lấy Refresh Token từ két sắt
            final refreshToken = await SecureStorageHelper.getRefreshToken();

            if (refreshToken != null) {
              try {
                // Tạo 1 Dio mới (để không bị dính cái interceptor cũ gây lặp vô hạn)
                final refreshDio = Dio(BaseOptions(baseUrl: baseUrl));

                // Gọi API refresh giống hệt backend Node.js của bạn
                final response = await refreshDio.post(
                  '/auth/refresh',
                  data: {'refreshToken': refreshToken},
                );

                // Nếu thành công, lấy token mới và lưu lại
                final newAccessToken = response.data['accessToken'];
                // Giả sử backend trả về cả user info, ta chỉ cần lưu token
                await SecureStorageHelper.saveTokens(
                  accessToken: newAccessToken,
                  refreshToken:
                      refreshToken, // backend của bạn đang không cấp lại refresh token mới, nên giữ cái cũ
                );

                // Gắn token mới vào request vừa bị lỗi (original request)
                e.requestOptions.headers['Authorization'] =
                    'Bearer $newAccessToken';

                // Gọi lại chính cái request bị lỗi đó
                final retryResponse = await dio.fetch(e.requestOptions);
                return handler.resolve(retryResponse);
              } catch (refreshError) {
                // Nếu refresh cũng lỗi (hết hạn nốt) -> Xóa sạch, đuổi về Login
                await SecureStorageHelper.clearAll();
                // TODO: Bắn event văng ra màn hình Login (Sẽ làm ở Phase BLoC)
                print("❌ Refresh Token failed. Logging out.");
              }
            } else {
              await SecureStorageHelper.clearAll();
            }
          }

          return handler.next(
            e,
          ); // Các lỗi khác 400, 403, 500 thì ném tiếp cho UI tự xử
        },
      ),
    );
  }
}
