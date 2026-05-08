import 'dart:io';
import 'package:device_info_plus/device_info_plus.dart';

class DeviceInfoHelper {
  static final DeviceInfoPlugin _deviceInfoPlugin = DeviceInfoPlugin();

  static Future<String> getDeviceModelName() async {
    try {
      if (Platform.isAndroid) {
        final androidInfo = await _deviceInfoPlugin.androidInfo;
        final manufacturer = androidInfo.manufacturer;
        final model = androidInfo.model;
        
        // Tránh lặp tên hãng nếu tên model đã chứa sẵn tên hãng
        final capitalizedManufacturer = manufacturer[0].toUpperCase() + manufacturer.substring(1);
        if (model.toLowerCase().startsWith(manufacturer.toLowerCase())) {
          return model;
        }
        return '$capitalizedManufacturer $model';
      } else if (Platform.isIOS) {
        final iosInfo = await _deviceInfoPlugin.iosInfo;
        return iosInfo.name; // Trả về dạng "iPhone 11 Pro Max" hoặc tên thiết bị người dùng đặt
      }
    } catch (e) {
      print("❌ [DeviceInfoHelper] Error reading device info: $e");
    }
    return Platform.isAndroid ? 'Thiết bị Android' : 'Thiết bị iOS';
  }
}
