package com.example.mobile

import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel
import android.view.WindowManager
import android.hardware.display.DisplayManager
import android.content.Context
import android.view.Display
import android.content.res.Configuration

class MainActivity: FlutterActivity() {
    private val CHANNEL = "com.example.mobile/security"
    private var isOverlayActive = false

    override fun onWindowFocusChanged(hasFocus: Boolean) {
        super.onWindowFocusChanged(hasFocus)
        // Khi mất tiêu điểm (có thể do kéo thanh thông báo, hoặc app bong bóng chat đè lên)
        isOverlayActive = !hasFocus
    }

    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)
        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, CHANNEL).setMethodCallHandler { call, result ->
            if (call.method == "enableSecureMode") {
                activity.window.addFlags(WindowManager.LayoutParams.FLAG_SECURE)
                result.success(true)
            } else if (call.method == "disableSecureMode") {
                activity.window.clearFlags(WindowManager.LayoutParams.FLAG_SECURE)
                result.success(true)
            } else if (call.method == "checkScreenStatus") {
                val dm = getSystemService(Context.DISPLAY_SERVICE) as DisplayManager
                val displays = dm.displays
                var isSharing = false
                var isRecording = false
                
                for (display in displays) {
                    if (display.displayId != Display.DEFAULT_DISPLAY) {
                        val name = display.name?.lowercase() ?: ""
                        if (name.contains("cast") || name.contains("mirror") || name.contains("display")) {
                            isSharing = true
                        } else {
                            isRecording = true
                        }
                    }
                }
                
                var inMultiWindow = false
                if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.N) {
                    inMultiWindow = this.isInMultiWindowMode
                }
                
                result.success(mapOf(
                    "isSharing" to isSharing,
                    "isRecording" to isRecording,
                    "isSplitScreen" to inMultiWindow,
                    "isOverlayActive" to isOverlayActive
                ))
            } else if (call.method == "isScreenCaptured") {
                val dm = getSystemService(Context.DISPLAY_SERVICE) as DisplayManager
                val displays = dm.displays
                var isCaptured = false
                for (display in displays) {
                    if (display.displayId != Display.DEFAULT_DISPLAY) {
                        isCaptured = true
                        break
                    }
                }
                result.success(isCaptured)
            } else {
                result.notImplemented()
            }
        }
    }
}
