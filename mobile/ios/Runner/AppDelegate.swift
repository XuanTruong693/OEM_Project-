import Flutter
import UIKit

@main
@objc class AppDelegate: FlutterAppDelegate {
  private var secureField: UITextField?

  override func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?
  ) -> Bool {
    GeneratedPluginRegistrant.register(with: self)

    if let controller = window?.rootViewController as? FlutterViewController {
      let securityChannel = FlutterMethodChannel(name: "com.example.mobile/security",
                                                binaryMessenger: controller.binaryMessenger)
      
      securityChannel.setMethodCallHandler({ [weak self]
        (call: FlutterMethodCall, result: @escaping FlutterResult) -> Void in
        if call.method == "checkScreenStatus" {
          let isCaptured = UIScreen.main.isCaptured
          let isMirrored = UIScreen.screens.count > 1 || UIScreen.main.mirroredScreen != nil
          result([
            "isRecording": isCaptured && !isMirrored,
            "isSharing": isMirrored
          ])
        } else if call.method == "isScreenCaptured" {
          result(UIScreen.main.isCaptured)
        } else if call.method == "enableSecureMode" {
          self?.makeScreenSecure()
          result(true)
        } else if call.method == "disableSecureMode" {
          self?.makeScreenNormal()
          result(true)
        } else {
          result(FlutterMethodNotImplemented)
        }
      })
    }

    return super.application(application, didFinishLaunchingWithOptions: launchOptions)
  }

  private func makeScreenSecure() {
    if secureField == nil {
      let field = UITextField()
      field.isSecureTextEntry = true
      field.translatesAutoresizingMaskIntoConstraints = false
      if let w = window {
        w.addSubview(field)
        secureField = field
      }
    }
  }

  private func makeScreenNormal() {
    secureField?.removeFromSuperview()
    secureField = nil
  }
}
