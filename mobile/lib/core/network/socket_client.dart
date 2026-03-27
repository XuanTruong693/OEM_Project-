import 'package:socket_io_client/socket_io_client.dart' as io;

class SocketClient {
  io.Socket? socket;

  void connectAndListen(String token) {
    socket = io.io(
      'http://10.0.2.2:5000',
      io.OptionBuilder()
          .setTransports(['websocket'])
          .disableAutoConnect()
          .setExtraHeaders({
            'Authorization': 'Bearer $token',
          }) // Gửi token lên Node.js
          .build(),
    );

    socket?.connect();

    socket?.onConnect((_) {
      print('✅ KẾT NỐI SOCKET THÀNH CÔNG');
    });

    socket?.onDisconnect((_) => print('❌ NGẮT KẾT NỐI SOCKET'));
  }

  void disconnect() {
    socket?.disconnect();
  }
}
