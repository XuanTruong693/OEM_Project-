import os
import pandas as pd
import numpy as np
import joblib
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, classification_report
import logging
import json

logger = logging.getLogger(__name__)

# Paths
BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DATASET_PATH = os.path.join(BASE_DIR, "data", "comprehensive_cheating_dataset.csv")
MODEL_PATH = os.path.join(BASE_DIR, "data", "behavior_model.pkl")

# Các features dùng để predict
FEATURES = [
    'tab_switches', 'blur_events', 'blocked_keys', 'fullscreen_exits',
    'avg_blur_duration_ms', 'max_blur_duration_ms', 'copy_attempts', 'paste_attempts',
    'mouse_outside_count', 'screenshot_attempts'  # Prtsc, Ctrl+PrtSc, Alt+PrtSc
]

class BehaviorDetectionModel:
    def __init__(self):
        self.model = None
        self._load_model()
        
    def _load_model(self):
        """Load pretrained model if exists"""
        if os.path.exists(MODEL_PATH):
            try:
                self.model = joblib.load(MODEL_PATH)
                logger.info("✅ Load Behavior Model thành công.")
            except Exception as e:
                logger.error(f"❌ Failed to load model: {str(e)}")
        else:
            logger.warning("⚠️ Chưa có file model. Hệ thống sẽ tự train hoặc dùng rule-based heuristic.")

    def train_model(self):
        """Huấn luyện mô hình từ comprehensive_cheating_dataset.csv"""
        if not os.path.exists(DATASET_PATH):
            logger.error(f"Khong tim thay dataset file {DATASET_PATH}")
            return False
            
        logger.info(f"Đang đọc dataset từ: {DATASET_PATH}...")
        df = pd.read_csv(DATASET_PATH)
        
        X = df[FEATURES]
        y = df['label']
        
        X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
        
        logger.info("Tiến hành train mô hình Random Forest...")
        clf = RandomForestClassifier(n_estimators=100, max_depth=10, random_state=42, class_weight='balanced')
        clf.fit(X_train, y_train)
        
        y_pred = clf.predict(X_test)
        acc = accuracy_score(y_test, y_pred)
        logger.info(f"Độ chính xác Model (Accuracy): {acc:.4f}")
        logger.info("\n" + classification_report(y_test, y_pred))
        
        # Save model
        joblib.dump(clf, MODEL_PATH)
        self.model = clf
        logger.info(f"✅ Lưu model thành công tại: {MODEL_PATH}")
        return True

    def process_raw_events(self, events):
        """Từ raw events, trích xuất feature vector"""
        features = {f: 0 for f in FEATURES}
        blur_durations = []
        
        for e in events:
            typ = e.get('event_type')
            if typ == 'tab_switch': features['tab_switches'] += 1
            if typ in ['window_blur', 'visibility_hidden']: features['blur_events'] += 1
            if typ == 'blocked_key': features['blocked_keys'] += 1
            if typ == 'fullscreen_lost': features['fullscreen_exits'] += 1
            if typ == 'copy': features['copy_attempts'] += 1
            if typ == 'paste': features['paste_attempts'] += 1
            if typ == 'mouse_outside': features['mouse_outside_count'] += 1
            if typ == 'screenshot_attempt': features['screenshot_attempts'] += 1
            
            # Extract duration if present
            details = e.get('details', {})
            duration = details.get('duration_ms', 0)
            if duration > 0:
                blur_durations.append(duration)
                
        if len(blur_durations) > 0:
            features['max_blur_duration_ms'] = max(blur_durations)
            features['avg_blur_duration_ms'] = sum(blur_durations) / len(blur_durations)
            
        return features

    def detect_cheating(self, events):
        """
        Nhận mảng event dict, phân tích features và predict.
        Dùng cho endpoint API để realtime detection.
        """
        features_dict = self.process_raw_events(events)
        
        if self.model:
            # Prepare DataFrame for scikit-learn
            X_input = pd.DataFrame([features_dict], columns=FEATURES)
            # Predict Probability
            probs = self.model.predict_proba(X_input)[0] 
            # Giả định classes_ là [0, 1] => idx 1 là xác suất gian lận
            confidence = probs[1]
            is_cheating = bool(confidence > 0.65) # threshold custom
             
            # Identify primary reason for cheating if true
            reason = "Hành vi bất thường (Tổng hợp)"
            if is_cheating or features_dict.get('screenshot_attempts', 0) > 0: # Force screenshot trigger
                # Ngưỡng phát hiện
                if features_dict.get('screenshot_attempts', 0) >= 1:
                    reason = "Sử dụng phím chụp màn hình"
                    is_cheating = True # Force cheating to true
                    confidence = max(confidence, 0.85) # Boost confidence
                elif features_dict.get('copy_attempts', 0) >= 2 or features_dict.get('paste_attempts', 0) >= 2:
                    reason = "Lạm dụng sao chép/dán"
                elif features_dict.get('max_blur_duration_ms', 0) >= 15000:
                    reason = "Xem tài liệu (Rời cửa sổ quá lâu)"
                elif features_dict.get('tab_switches', 0) >= 3 or features_dict.get('blur_events', 0) >= 3:
                    reason = "Chuyển tab hoặc cửa sổ liên tục"
                elif features_dict.get('mouse_outside_count', 0) >= 2:
                    reason = "Sử dụng thiết bị khác ngoài màn hình"
                elif features_dict.get('fullscreen_exits', 0) >= 2:
                    reason = "Thoát toàn màn hình liên tục"

            # Fallback if no specific reason is dominant but AI is highly confident
            if is_cheating and reason == "Hành vi bất thường (Tổng hợp)":
                reason = "Phối hợp nhiều hành vi bất thường"
                    
            return {
                "is_cheating": is_cheating,
                "confidence": float(confidence),
                "features_extracted": features_dict,
                "reason": reason
            }
        else:
            # Fallback Rule-based if no model
            logger.warning("No ML model loaded, using rule-based fallback.")
            score = 0
            score += features_dict['tab_switches'] * 0.3
            score += features_dict['blur_events'] * 0.2
            score += features_dict['blocked_keys'] * 0.2
            score += features_dict['fullscreen_exits'] * 0.3
            score += min(1.0, features_dict['max_blur_duration_ms'] / 10000.0) * 0.5
            score += (features_dict['copy_attempts'] + features_dict['paste_attempts']) * 0.4
            
            is_cheat = score > 1.0
            return {
                "is_cheating": is_cheat,
                "confidence": min(1.0, score / 2.0),
                "features_extracted": features_dict,
                "reason": "rule_based_fallback"
            }

behavior_model = BehaviorDetectionModel()
