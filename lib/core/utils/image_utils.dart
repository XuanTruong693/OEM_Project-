class ImageUtils {
  static const String baseUrl = 'http://10.0.2.2:5000'; // Base URL (không có /api)

  static String getFullImageUrl(String? path) {
    if (path == null || path.isEmpty) {
      return '';
    }
    if (path.startsWith('http')) {
      return path;
    }
    if (path.startsWith('/')) {
      return '$baseUrl$path';
    }
    return '$baseUrl/$path';
  }
}
