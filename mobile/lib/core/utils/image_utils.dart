import 'package:flutter_dotenv/flutter_dotenv.dart';

class ImageUtils {
  static String get baseUrl {
    final envUrl = dotenv.env['API_URL'];
    if (envUrl != null && envUrl.isNotEmpty) {
      try {
        final uri = Uri.parse(envUrl);
        return '${uri.scheme}://${uri.host}${uri.hasPort ? ':${uri.port}' : ''}';
      } catch (e) {
        return envUrl.replaceAll(RegExp(r'/api$'), '');
      }
    }
    return 'http://10.0.2.2:5000';
  }

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
