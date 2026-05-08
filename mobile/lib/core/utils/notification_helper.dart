import 'package:flutter_local_notifications/flutter_local_notifications.dart';

class NotificationHelper {
  static final FlutterLocalNotificationsPlugin _notificationsPlugin =
      FlutterLocalNotificationsPlugin();

  static Future<void> init() async {
    const AndroidInitializationSettings initializationSettingsAndroid =
        AndroidInitializationSettings('@mipmap/ic_launcher');

    const DarwinInitializationSettings initializationSettingsIOS =
        DarwinInitializationSettings(
      requestAlertPermission: true,
      requestBadgePermission: true,
      requestSoundPermission: true,
      requestCriticalPermission: true,
    );

    const InitializationSettings initializationSettings = InitializationSettings(
      android: initializationSettingsAndroid,
      iOS: initializationSettingsIOS,
    );

    await _notificationsPlugin.initialize(
      initializationSettings,
    );

    try {
      const AndroidNotificationChannel channel = AndroidNotificationChannel(
        'cheating_alerts',
        'Cảnh báo Gian lận',
        description: 'Thông báo gian lận của sinh viên thời gian thực',
        importance: Importance.max,
        playSound: true,
        enableVibration: true,
      );

      await _notificationsPlugin
          .resolvePlatformSpecificImplementation<
              AndroidFlutterLocalNotificationsPlugin>()
          ?.createNotificationChannel(channel);
      print("🔔 Registered Android high-importance channel successfully.");
    } catch (e) {
      print("⚠️ Error creating notification channel: $e");
    }

    // Request permission for Android 13+
    await _notificationsPlugin
        .resolvePlatformSpecificImplementation<
            AndroidFlutterLocalNotificationsPlugin>()
        ?.requestNotificationsPermission();
  }

  static Future<void> showNotification({
    required int id,
    required String title,
    required String body,
  }) async {
    final int safeId = DateTime.now().millisecondsSinceEpoch % 100000;
    
    const AndroidNotificationDetails androidNotificationDetails =
        AndroidNotificationDetails(
      'cheating_alerts',
      'Cảnh báo Gian lận',
      channelDescription: 'Thông báo gian lận của sinh viên thời gian thực',
      importance: Importance.max,
      priority: Priority.max,
      fullScreenIntent: true,
      visibility: NotificationVisibility.public,
      category: AndroidNotificationCategory.alarm,
      audioAttributesUsage: AudioAttributesUsage.alarm,
      ticker: 'ticker',
      playSound: true,
    );

    const NotificationDetails notificationDetails = NotificationDetails(
      android: androidNotificationDetails,
      iOS: DarwinNotificationDetails(
        presentAlert: true,
        presentBadge: true,
        presentSound: true,
        interruptionLevel: InterruptionLevel.critical,
      ),
    );

    try {
      await _notificationsPlugin.show(
        safeId,
        title,
        body,
        notificationDetails,
      );
      print("🔔 Local notification triggered successfully: $title - $body");
    } catch (e) {
      print("❌ Error displaying local notification: $e");
    }
  }
}
