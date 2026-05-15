import os
import pandas as pd
import numpy as np
import joblib  # type: ignore[import-untyped]
from sklearn.ensemble import RandomForestClassifier  # type: ignore[import-untyped]
from sklearn.model_selection import train_test_split  # type: ignore[import-untyped]
from sklearn.metrics import accuracy_score, classification_report  # type: ignore[import-untyped]
import logging
import json
from typing import Dict, Any
import onnxruntime as ort  # type: ignore[import-untyped]
from app.nlp.visual_features import visual_extractor

logger = logging.getLogger(__name__)

# Paths
BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DATASET_PATH = os.path.join(BASE_DIR, "data", "comprehensive_cheating_dataset.csv")
MODEL_PATH = os.path.join(BASE_DIR, "data", "behavior_model.pkl")
ONNX_MODEL_PATH = os.path.join(BASE_DIR, "data", "behavior_model.onnx")
VISUAL_MODEL_PATH = os.path.join(BASE_DIR, "data", "visual_behavior_model.pkl")

# Các features dùng để predict cho Soft & Hard Behaviours (AI-First)
FEATURES = [
    'tab_switches', 'blur_events', 'fullscreen_exits',
    'avg_blur_duration_ms', 'max_blur_duration_ms', 'copy_attempts', 'paste_attempts',
    'mouse_outside_count', 'screenshot_attempts',
    'devtools_attempts', 'multi_monitor_attempts', 'drag_drop_attempts', 'typing_speed_violation',
    'has_f12', 'has_alt_tab', 'has_win_d_p', 'has_prt_scr', 'has_f11_f5', 'has_escape',
    'has_meta_blur' 
]
# TỪ ĐIỂN CHUẨN HÓA VI PHẠM
HARD_RULES_DICT = {
    "escape": "Cố tình nhấn phím ESC để thoát chế độ Toàn màn hình.",
    "f11": "Nhấn F11 để can thiệp kích thước màn hình thi.",
    "f5": "Cố tình làm mới (Tải lại) trang bài thi nhằm vượt mặt hệ thống.",
    "f12": "Cố tình mở Công cụ lập trình (DevTools) hòng can thiệp bài thi.",
    "printscreen": "Nhấn phím PrintScreen chụp ảnh đề thi.",
    "meta+shift+s": "Mở công cụ cắt/chụp ảnh màn hình (Snipping Tool) của Windows.",
    "alt+printscreen": "Chụp ảnh nhanh một cấu trúc cửa sổ ứng dụng.",
    "alt+tab": "Nhấn phím tắt Alt+Tab để chuyển nhanh sang ứng dụng/tài liệu khác.",
    "meta+d": "Nhanh chóng thu nhỏ toàn bộ bài thi để về Màn hình chính (Desktop).",
    "meta+p": "Kích hoạt Bảng chia sẻ màn hình phụ (Project) hòng phát đề thi ra ngoài.",
    "meta_blur": "Sử dụng Menu hệ thống (Windows/Start) để thoát/chuyển sang ứng dụng khác.",
    "copy_attempt": "Thực hiện thao tác sao chép (Copy / Ctrl+C) nội dung từ bài thi ra ngoài.",
    "paste_attempt": "Thực hiện thao tác dán (Paste / Ctrl+V) nội dung từ bên ngoài vào bài thi.",
    "drag_drop_in": "Kéo thả văn bản/tài liệu từ cửa sổ bên ngoài vào ô trả lời bài thi.",
    "fullscreen_lost": "Thoát khỏi chế độ thi Toàn màn hình.",
    "visibility_hidden": "Ẩn tab bài thi xuống (Mở một cửa sổ khác đè lên trên).",
    "window_blur": "Click chuột ra ngoài cửa sổ trình duyệt thi.",
    "multiple_screens_connected": "Phát hiện kết nối nhiều màn hình (Dual monitor).",
    "screenshot_attempt": "Sử dụng lối tắt ngăn chặn hoặc phần mềm hệ thống để chụp màn hình bài thi."
}

SOFT_RULES_DICT = {
    "typing_speed_violation": "Tốc độ gõ phím nhanh bất thường (>120WPM) - Nghi vấn dùng Bot/Tool.",
    "frequent_blur_switch": "Nhấn chuột ra ngoài cửa sổ bài thi quá nhiều lần trong thời gian ngắn.",
    "prolonged_away": "Rời bỏ bài thi quá thời gian cho phép (>15 giây)."
}

# Ánh xạ feature name sang rule key để lấy mô tả
FEATURE_TO_RULE_MAP = {
    "has_f12": "f12",
    "has_alt_tab": "alt+tab",
    "has_win_d_p": "meta+d",
    "has_prt_scr": "printscreen",
    "has_f11_f5": "f11",
    "has_escape": "escape",
    "has_meta_blur": "meta_blur",
    "devtools_attempts": "f12",
    "screenshot_attempts": "screenshot_attempt",
    "typing_speed_violation": "typing_speed_violation",
    "copy_attempts": "copy_attempt",
    "paste_attempts": "paste_attempt",
    "tab_switches": "visibility_hidden",
    "blur_events": "window_blur",
    "fullscreen_lost": "fullscreen_lost",
    "multi_monitor_attempts": "multiple_screens_connected"
}

# Thứ tự ưu tiên hiển thị lỗi (Từ nặng đến nhẹ)
SEVERITY_PRIORITY = [
    'has_prt_scr', 'screenshot_attempts', 'has_f12', 'devtools_attempts', 
    'has_meta_blur', 'has_win_d_p',
    'has_alt_tab', 'has_f11_f5', 'has_escape', 'copy_attempts', 'paste_attempts', 
    'fullscreen_lost', 'tab_switches', 'typing_speed_violation'
]

class BehaviorDetectionModel:
    def __init__(self):
        self.model = None
        self._load_model()
        
    def _load_model(self):
        """Load pretrained model if exists (Preferred ONNX for speed)"""
        # Load ONNX model for inference
        if os.path.exists(ONNX_MODEL_PATH):
            try:
                self.ort_session = ort.InferenceSession(ONNX_MODEL_PATH)
                logger.info("✅ Load Behavior ONNX Model thành công (Fast Inference Mode).")
            except Exception as e:
                logger.error(f"❌ Failed to load ONNX model: {str(e)}")
        
        # Always try to load .pkl for retraining purposes
        if os.path.exists(MODEL_PATH):
            try:
                self.model = joblib.load(MODEL_PATH)
                logger.info("✅ Load Behavior PKL Model thành công (Training Mode).")
            except Exception as e:
                logger.error(f"❌ Failed to load PKL model: {str(e)}")
        else:
            logger.warning("⚠️ Chưa có file model. Hệ thống sẽ dùng rule-based.")
        
        # Load Visual AI model if exists
        self.visual_model = None
        if os.path.exists(VISUAL_MODEL_PATH):
            try:
                self.visual_model = joblib.load(VISUAL_MODEL_PATH)
                logger.info("✅ Load Visual AI Model thành công.")
            except Exception as e:
                logger.error(f"❌ Failed to load Visual model: {str(e)}")

    def train_model(self):
        """Huấn luyện mô hình từ comprehensive_cheating_dataset.csv"""
        if not os.path.exists(DATASET_PATH):
            logger.error(f"Khong tim thay dataset file {DATASET_PATH}")
            return False
            
        logger.info(f"Đang đọc dataset từ: {DATASET_PATH}...")
        df = pd.read_csv(DATASET_PATH)
        
        # Bảm bảo dataset chứa đủ cột cho features mới
        for feature in FEATURES:
            if feature not in df.columns:
                df[feature] = 0
                
        X = df[FEATURES]
        y = df['label'] if 'label' in df.columns else [0]*len(df) # Safety check
        
        X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
        
        logger.info("Tiến hành train mô hình Random Forest...")
        clf = RandomForestClassifier(n_estimators=100, max_depth=10, random_state=42, class_weight='balanced')
        if len(set(y_train)) > 1: # Require at least 2 classes
            clf.fit(X_train, y_train)
            
            y_pred = clf.predict(X_test)
            acc = accuracy_score(y_test, y_pred)
            logger.info(f"Độ chính xác Model (Accuracy): {acc:.4f}")
            logger.info("\n" + classification_report(y_test, y_pred))
            
            joblib.dump(clf, MODEL_PATH)
            self.model = clf
            logger.info(f"✅ Lưu model PKL thành công tại: {MODEL_PATH}")

            try:
                from skl2onnx import to_onnx  # type: ignore[import-untyped]
                from skl2onnx.common.data_types import FloatTensorType  # type: ignore[import-untyped]
                initial_type = [('float_input', FloatTensorType([None, len(FEATURES)]))]
                onx = to_onnx(clf, initial_types=initial_type, target_opset=12)  # type: ignore[arg-type]
                
                with open(ONNX_MODEL_PATH, "wb") as f:
                    f.write(onx.SerializeToString())  # type: ignore[union-attr]
                self.ort_session = ort.InferenceSession(ONNX_MODEL_PATH)
                logger.info(f"🚀 Tự động chuyển đổi và lưu ONNX thành công: {ONNX_MODEL_PATH}")
            except Exception as e:
                logger.error(f"⚠️ Lỗi khi chuyển đổi ONNX: {str(e)}")
                
            return True
        return False

    def process_raw_events(self, events):
        features = {f: 0 for f in FEATURES}
        blur_durations = []
        
        for e in events:
            typ = e.get('event_type')
            details = e.get('details', {})
            key = str(details.get('key') or '').lower()
            is_internal = details.get('is_internal', False)
            
            # --- GRANULAR FEATURE EXTRACTION ---
            if typ in ['tab_switch', 'alt_tab']: features['tab_switches'] += 1
            if typ in ['window_blur', 'visibility_hidden']: features['blur_events'] += 1
            if typ in ['fullscreen_lost', 'fullscreen_exit']: features['fullscreen_exits'] += 1
            
            # Chỉ đếm là vi phạm nếu KHÔNG phải nội bộ
            if typ == 'copy_attempt' and not is_internal: features['copy_attempts'] += 1
            if typ == 'paste_attempt' and not is_internal: features['paste_attempts'] += 1
            
            if typ == 'mouse_outside': features['mouse_outside_count'] += 1
            if typ == 'screenshot_attempt': features['screenshot_attempts'] += 1
            if typ == 'devtools_attempt': features['devtools_attempts'] += 1
            if typ == 'multi_monitor_attempt': features['multi_monitor_attempts'] += 1
            if typ == 'drag_drop_in': features['drag_drop_attempts'] += 1
            if typ == 'typing_speed_violation': features['typing_speed_violation'] += 1
            
            # --- KEY SPECIFIC FEATURES (Granular Mapping) ---
            if typ in ['blocked_key', 'screenshot_attempt', 'alt_tab', 'fullscreen_lost', 
                      'copy_attempt', 'paste_attempt', 'window_blur', 'visibility_hidden', 'window_blur_duration']:
                if key == 'f12': features['has_f12'] = 1
                elif key == 'escape' or typ == 'fullscreen_lost': features['has_escape'] = 1
                elif key in ['f11', 'f5']: features['has_f11_f5'] = 1
                elif ('alt' in key and 'tab' in key) or typ == 'alt_tab': features['has_alt_tab'] = 1
                elif 'meta' in key and ('d' in key or 'p' in key): features['has_win_d_p'] = 1
                elif ('printscreen' in key or 
                      ('meta' in key and 'shift' in key and 's' in key) or 
                      ('alt' in key and 'printscreen' in key) or 
                      typ == 'screenshot_attempt'):
                    features['has_prt_scr'] = 1
                    features['screenshot_attempts'] += 1
                
                # [Refinement] Catch raw meta key as high-priority
                if 'meta' in key:
                    features['has_win_d_p'] = 1 # Meta key generally used for escapes
                
                # Check for Meta Key + Window Blur combo
                if 'meta' in key and typ in ['window_blur', 'visibility_hidden']:
                    features['has_meta_blur'] = 1 
                    features['has_alt_tab'] = 1 # Lead to high severity

            duration = details.get('duration_ms', 0)
            if duration > 0:
                blur_durations.append(duration)
                
        if len(blur_durations) > 0:
            features['max_blur_duration_ms'] = max(blur_durations)
            features['avg_blur_duration_ms'] = float(sum(blur_durations) / len(blur_durations))  # type: ignore
            
        return features

    def detect_cheating(self, events):
        vision_override_reason = None
        # ==========================================
        # LUỒNG 0: PHÂN TÍCH NGỮ CẢNH HỆ THỐNG (Smart Buffer)
        # ==========================================
        is_confirmed_cheat = False
        
        for e in events:
            context = e.get('context', {})
            details = e.get('details', {})
            battery_level = context.get('battery_level', 1.0)
            network_rtt = context.get('network_rtt', 0)
            event_type = e.get('event_type')
            
            # Kiểm tra vị trí chuột (Nếu có) để phát hiện hành vi cố tình tương tác thanh tab
            mouse_pos = details.get('mouse_pos', {})
            is_mouse_in_prohibited_area = mouse_pos.get('y', 999) < 100 # Vùng thanh Tab/Địa chỉ
            
            # Sync with frontend: Ngưỡng pin 20%
            is_recent_power_change = context.get('is_power_changed', False)
            is_low_battery_context = (battery_level < 0.2) or is_recent_power_change

            # [HÀNH VI GIAN LẬN XÁC ĐỊNH BẤT CHẤP NGỮ CẢNH]
            confirm_reason = None
            if event_type in ['visibility_hidden', 'paste_attempt', 'copy_attempt', 'blocked_key']:
                confirm_reason = f"Phát hiện hành vi gian lận cố tình ({event_type}) - Chốt vi phạm tuyệt đối."
            elif is_mouse_in_prohibited_area:
                confirm_reason = f"Chuột di chuyển vào vùng Tab Bar ({mouse_pos.get('y')}px) - Nghi ngờ tương tác với thanh điều hướng."
            elif event_type == 'window_blur' and details.get('duration_ms', 0) > 5000:
                confirm_reason = f"Mất tiêu điểm (Blur) quá lâu ({details.get('duration_ms')}ms) - Vượt ngưỡng ân xá hệ thống."

            if confirm_reason:
                logger.info(f"🚨 [AI Behavior] {confirm_reason} -> Chốt gian lận.")
                return {
                    "is_cheating": True,
                    "confidence": 1.0,
                    "features_extracted": self.process_raw_events(events),
                    "reason": confirm_reason
                }
            if is_low_battery_context or (network_rtt > 500):
                # Nếu có ảnh chụp màn hình, AI sẽ dùng "Mắt" để kiểm tra xem thực sự là gì
                snapshot_path = details.get('snapshot_path')
                if snapshot_path and os.path.exists(snapshot_path) and self.visual_model:
                    try:
                        v_features, v_info = visual_extractor.get_full_feature_vector(snapshot_path)
                        v_info_dict: Dict[str, Any] = v_info  # type: ignore
                        v_probs = self.visual_model.predict_proba([v_features])[0]
                        v_prob_cheating = v_probs[1]
                        if v_info_dict.get('is_desktop_likely'):
                            v_prob_cheating = min(1.0, v_prob_cheating + 0.30)
                        elif v_info_dict.get('is_browser_ui_likely'):
                            v_prob_cheating = min(1.0, v_prob_cheating + 0.20)
                        THRESHOLD = 0.65
                        
                        if v_prob_cheating < (1 - THRESHOLD):
                            logger.info(f"🛡️ [AI Vision] Ảnh chụp xác nhận an toàn ({v_prob_cheating:.2f}). Ân xá hoàn toàn.")
                            return { "is_cheating": False, "confidence": 0.0, "reason": "AI Vision xác nhận giao diện an toàn." }
                        
                        elif v_prob_cheating >= THRESHOLD:
                            vision_reason = "Phát hiện giao diện ứng dụng lạ bên ngoài bài thi."
                            if v_info_dict.get('is_desktop_likely'):
                                vision_reason = "Phát hiện thí sinh đang sử dụng Màn hình nền (Desktop) hoặc Taskbar ứng dụng khác."
                            elif v_info_dict.get('is_browser_ui_likely'):
                                vision_reason = "Phát hiện thí sinh đang tương tác với các thẻ Tab hoặc thanh công cụ trình duyệt bên ngoài."
                                
                            logger.info(f"🚨 [AI Vision] {vision_reason} ({v_prob_cheating:.2f}). Hủy ân xá!")
                            return { 
                                "is_cheating": True, 
                                "confidence": v_prob_cheating, 
                                "reason": f"[AI VISION]: {vision_reason}" 
                            }
                        else:
                            logger.info(f"⚖️ [AI Vision] Kết quả không chắc chắn ({v_prob_cheating:.2f}). Giữ nguyên cảnh báo ban đầu.")
                            return { 
                                "is_cheating": False, 
                                "confidence": v_prob_cheating, 
                                "reason": f"AI không chắc chắn về hình ảnh ({v_prob_cheating:.2f}). Có thể do mạng yếu hoặc pin yếu."
                            }
                    except Exception as ve:
                        logger.error(f"Vision Inference Error: {ve}")

                reason = "Sự kiện hệ thống hợp lệ"
                if is_low_battery_context: reason += " (Pin yếu)"
                if network_rtt > 500: reason += " (Mạng lag)"
                
                logger.info(f"🛡️ [AI Behavior] Ân xá sự kiện {event_type} do {reason}.")
                return {
                    "is_cheating": False,
                    "confidence": 0.0,
                    "features_extracted": {},
                    "reason": reason
                }

        # ==========================================
        # LUỒNG 1: PHÂN TÍCH HÀNH VI
        # ==========================================
        features_dict = self.process_raw_events(events)
        
        # Lấy thông tin tiêu đề cửa sổ từ context (nếu có)
        window_title = "bài thi"
        for e in events:
            det = e.get('details', {})
            if det.get('window_title'):
                window_title = det.get('window_title')
                break

        is_cheating = False
        confidence = 0.0

        # ==========================================
        # LUỒNG 2: PHÂN TÍCH HÀNH VI (DETERMINISTIC & MACHINE LEARNING)
        # ==========================================
        HARD_KEY_FEATURES = [
            'has_f12', 'has_alt_tab', 'has_win_d_p', 'has_prt_scr', 
            'has_f11_f5', 'has_escape', 
            'devtools_attempts', 'screenshot_attempts', 'multi_monitor_attempts',
            'copy_attempts', 'paste_attempts', 'tab_switches'
        ]
        
        # Đặc biệt: meta_blur chỉ là deterministic nếu duration đủ lâu (lọc nhấn nhầm)
        is_serious_meta = features_dict.get('has_meta_blur', False) and features_dict.get('max_blur_duration_ms', 0) > 1000
        
        # Biến đánh dấu kết quả từ logic cơ bản
        is_det_cheating = any(features_dict.get(f, 0) >= 1 for f in HARD_KEY_FEATURES) or is_serious_meta
        
        if is_det_cheating:
            is_cheating = True
            confidence = 1.0
            logger.info(f"🚨 [AI Deterministic] Phát hiện vi phạm gian lận. Khẳng định gian lận.")
        else:
            ml_confidence = 0.0
            if hasattr(self, 'ort_session') and self.ort_session:
                try:
                    input_name = self.ort_session.get_inputs()[0].name
                    X_input = np.array([[features_dict[f] for f in FEATURES]], dtype=np.float32)
                    outputs = self.ort_session.run(None, {input_name: X_input})
                    ml_confidence = float(outputs[1][0][1]) if len(outputs) > 1 else 0.5
                except Exception as e: logger.error(f"ONNX Error: {e}")
            elif self.model:
                X_input = pd.DataFrame([features_dict], columns=FEATURES)
                ml_confidence = self.model.predict_proba(X_input)[0][1]
            
            is_cheating = bool(ml_confidence > 0.6)
            confidence = ml_confidence

            # ==========================================
            # [MỚI] LUỒNG 2.5: VISION TIE-BREAKER (TRỌNG TÀI)
            # ==========================================
            # Nếu kết quả ML mập mờ (30% - 65%) hoặc cần xác thực thêm khi có snapshot
            snapshot_path = None
            for e in events:
                if e.get('details', {}).get('snapshot_path'):
                    snapshot_path = e.get('details', {}).get('snapshot_path')
                    break
            
            is_ambiguous = (0.3 < confidence < 0.65)
            
            if snapshot_path and os.path.exists(snapshot_path) and self.visual_model:
                try:
                    v_features, v_info = visual_extractor.get_full_feature_vector(snapshot_path)
                    v_info_dict: Dict[str, Any] = v_info  # type: ignore
                    v_probs = self.visual_model.predict_proba([v_features])[0]
                    v_prob_cheating = v_probs[1]    
                    if v_info_dict.get('is_desktop_likely'):
                        v_prob_cheating = min(1.0, v_prob_cheating + 0.35) 
                        logger.info(f"🚀 [AI Boost] Phát hiện Desktop -> Nâng xác suất lên {v_prob_cheating:.2f}")
                    elif v_info_dict.get('is_browser_ui_likely'):
                        v_prob_cheating = min(1.0, v_prob_cheating + 0.20) # Boost cho Browser
                        logger.info(f"🚀 [AI Boost] Phát hiện Browser Tab -> Nâng xác suất lên {v_prob_cheating:.2f}")

                    V_THRESHOLD = 0.65

                    if is_ambiguous:
                        logger.info(f"⚖️ [AI Tie-breaker] Telemetry mập mờ ({confidence:.2f}). Gọi Vision trọng tài...")
                        if v_prob_cheating >= V_THRESHOLD:
                            is_cheating = True
                            confidence = v_prob_cheating
                            logger.info(f"🚨 [AI Tie-breaker] Vision XÁC NHẬN GIAN LẬN ({v_prob_cheating:.2f}). Ghi đè kết quả.")
                        elif v_prob_cheating < (1 - V_THRESHOLD):
                            is_cheating = False
                            confidence = 0.0
                            logger.info(f"✅ [AI Tie-breaker] Vision XÁC NHẬN AN TOÀN ({v_prob_cheating:.2f}). Ân xá hoàn toàn.")
                    
                    # Cập nhật thông tin reason từ Vision nếu Vision quá rõ ràng
                    if v_prob_cheating >= V_THRESHOLD:
                        v_reason = "Phát hiện ứng dụng lạ."
                        if v_info_dict.get('is_desktop_likely'): v_reason = "Thí sinh đang tương tác với Màn hình nền (Desktop)/Taskbar."
                        elif v_info_dict.get('is_browser_ui_likely'): v_reason = "Thí sinh đang tương tác với các thẻ Tab hoặc thanh địa chỉ trình duyệt."
                        vision_confirm_msg = f"[AI VISION CONFIRMED]: {v_reason}"
                        # Gán trực tiếp vào reason nếu đạt ngưỡng
                        vision_override_reason = vision_confirm_msg
                except Exception as ve:
                    logger.error(f"Tie-breaker Vision Error: {ve}")

        # ==========================================
        # LUỒNG 3: FEATURE ATTRIBUTION & DETAILED REASONING
        # ==========================================
        final_reason = "Phát hiện hành vi gian lận bất thường."
        
        if is_cheating:
            # 1. Ưu tiên lý do từ Vision (nếu có và rõ ràng)
            if vision_override_reason is not None:
                final_reason = vision_override_reason
            else:
                found_reason = False
                for feat in SEVERITY_PRIORITY:
                    if features_dict.get(feat, 0) >= 1:
                        rule_key = FEATURE_TO_RULE_MAP.get(feat)
                        if rule_key:
                            final_reason = HARD_RULES_DICT.get(rule_key) or SOFT_RULES_DICT.get(rule_key) or final_reason
                            found_reason = True
                            break
                
                # Dự phòng nếu không khớp priority nào
                if not found_reason:
                    if features_dict.get('max_blur_duration_ms', 0) > 15000:
                        final_reason = SOFT_RULES_DICT["prolonged_away"]

        return {
            "is_cheating": is_cheating,
            "confidence": float(confidence),
            "features_extracted": features_dict,
            "reason": final_reason if is_cheating else "Báo động giả (An toàn)"
        }

behavior_model = BehaviorDetectionModel()
