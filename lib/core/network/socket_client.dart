import 'dart:async';
import 'package:socket_io_client/socket_io_client.dart' as io;
import 'package:flutter_dotenv/flutter_dotenv.dart';

final socketClient = SocketClient();

class SocketClient {
  io.Socket? socket;
  final Map<String, List<Function(dynamic)>> _listeners = {};

  /// Completer dùng để đợi socket kết nối thành công trước khi emit
  Completer<void>? _connectCompleter;

  bool get isConnected => socket?.connected ?? false;

  void connectAndListen(String token) {
    connectSocket(token);
  }

  void connectSocket(String token) {
    // If there's an active old socket, clean it up first
    if (socket != null) {
      socket!.disconnect();
      socket!.dispose();
    }

    // Tạo completer mới mỗi khi connect
    _connectCompleter = Completer<void>();

    String socketUrl = dotenv.env['SOCKET_URL'] ?? 'http://10.0.2.2:5000';
    final apiEnv = dotenv.env['API_URL'];
    if (dotenv.env['SOCKET_URL'] == null && apiEnv != null && apiEnv.isNotEmpty) {
      try {
        final uri = Uri.parse(apiEnv);
        socketUrl = '${uri.scheme}://${uri.host}${uri.hasPort ? ':${uri.port}' : ''}';
      } catch (_) {
        socketUrl = apiEnv.replaceAll(RegExp(r'/api$'), '');
      }
    }

    print('🔌 [SocketClient] Connecting to: $socketUrl');

    socket = io.io(
      socketUrl,
      io.OptionBuilder()
          .setTransports(['websocket', 'polling'])
          .disableAutoConnect()
          .enableReconnection()
          .setReconnectionDelay(1000)
          .setReconnectionDelayMax(5000)
          .setReconnectionAttempts(99999)
          .setExtraHeaders({
            'Authorization': 'Bearer $token',
          })
          .build(),
    );

    // Re-attach all stored event listeners to the new socket
    _listeners.forEach((event, callbacks) {
      for (final cb in callbacks) {
        socket?.on(event, cb);
      }
    });

    socket?.onConnect((_) {
      print('✅ KẾT NỐI SOCKET THÀNH CÔNG (connected: ${socket?.connected})');
      // Hoàn thành completer để các hàm đang đợi biết socket đã sẵn sàng
      if (_connectCompleter != null && !_connectCompleter!.isCompleted) {
        _connectCompleter!.complete();
      }
    });

    socket?.onDisconnect((_) => print('❌ NGẮT KẾT NỐI SOCKET'));

    socket?.onConnectError((data) {
      print('⚠️ [SocketClient] Connection error: $data');
    });

    socket?.onReconnect((_) {
      print('🔄 [SocketClient] Reconnected successfully');
    });

    socket?.connect();
  }

  /// Đợi cho socket kết nối thành công (timeout 10s)
  Future<void> waitForConnection() async {
    if (isConnected) return;
    if (_connectCompleter == null) return;
    try {
      await _connectCompleter!.future.timeout(
        const Duration(seconds: 10),
        onTimeout: () {
          print('⏰ [SocketClient] Connection timeout after 10s');
        },
      );
    } catch (e) {
      print('⚠️ [SocketClient] waitForConnection error: $e');
    }
  }

  Function onEvent(String event, Function(dynamic data) callback) {
    _listeners.putIfAbsent(event, () => []).add(callback);
    socket?.on(event, callback);
    return () {
      _listeners[event]?.remove(callback);
      socket?.off(event, callback);
    };
  }

  void emit(String event, [dynamic data]) {
    socket?.emit(event, data);
  }

  /// Emit sau khi chắc chắn socket đã connected
  Future<void> emitWhenReady(String event, [dynamic data]) async {
    await waitForConnection();
    if (isConnected) {
      socket?.emit(event, data);
      print('📤 [SocketClient] Emitted "$event" successfully');
    } else {
      print('⚠️ [SocketClient] Failed to emit "$event" - still not connected');
    }
  }

  void disconnect() {
    socket?.disconnect();
  }
}
