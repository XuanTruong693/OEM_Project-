package com.example.mobile

import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel
import android.view.WindowManager
import android.hardware.display.DisplayManager
import android.content.Context
import android.view.Display

class MainActivity: FlutterActivity() {
    private val CHANNEL = "com.example.mobile/security"

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
                for (display in displays) {
                    if (display.displayId != Display.DEFAULT_DISPLAY) {
                        isSharing = true
                        break
                    }
                }
                result.success(mapOf(
                    "isSharing" to isSharing,
                    "isRecording" to false
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
