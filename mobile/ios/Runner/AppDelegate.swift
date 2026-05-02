import Flutter
import UIKit

@main
@objc class AppDelegate: FlutterAppDelegate, FlutterImplicitEngineDelegate {
  private var secureField: UITextField?

  override func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?
  ) -> Bool {
    let controller : FlutterViewController = window?.rootViewController as! FlutterViewController
    let securityChannel = FlutterMethodChannel(name: "com.example.mobile/security",
                                              binaryMessenger: controller.binaryMessenger)
    
    securityChannel.setMethodCallHandler({ [weak self]
      (call: FlutterMethodCall, result: @escaping FlutterResult) -> Void in
      if call.method == "isScreenCaptured" {
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

    return super.application(application, didFinishLaunchingWithOptions: launchOptions)
  }

  private func makeScreenSecure() {
    if secureField == nil {
      let field = UITextField()
      field.isSecureTextEntry = true
      if let view = window?.rootViewController?.view {
        view.addSubview(field)
        field.centerYAnchor.constraint(equalTo: view.centerYAnchor).isActive = true
        field.centerXAnchor.constraint(equalTo: view.centerXAnchor).isActive = true
        field.layer.superlayer?.addSublayer(field.layer)
        secureField = field
      }
    }
  }

  private func makeScreenNormal() {
    secureField?.removeFromSuperview()
    secureField = nil
  }

  func didInitializeImplicitFlutterEngine(_ engineBridge: FlutterImplicitEngineBridge) {
    GeneratedPluginRegistrant.register(with: engineBridge.pluginRegistry)
  }
}
