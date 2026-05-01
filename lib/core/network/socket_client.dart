import 'package:socket_io_client/socket_io_client.dart' as io;

final socketClient = SocketClient();

class SocketClient {
  io.Socket? socket;
  final Map<String, List<Function(dynamic)>> _listeners = {};

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

    socket = io.io(
      'http://10.0.2.2:5000',
      io.OptionBuilder()
          .setTransports(['websocket'])
          .disableAutoConnect()
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

    socket?.connect();

    socket?.onConnect((_) {
      print('✅ KẾT NỐI SOCKET THÀNH CÔNG');
    });

    socket?.onDisconnect((_) => print('❌ NGẮT KẾT NỐI SOCKET'));
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

  void disconnect() {
    socket?.disconnect();
  }
}

