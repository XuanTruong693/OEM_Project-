# pyrefly: ignore [missing-import]
import cv2
import numpy as np
# pyrefly: ignore [missing-import]
import torch
# pyrefly: ignore [missing-import]
import torch.nn as nn
# pyrefly: ignore [missing-import]
import torchvision.models as models
# pyrefly: ignore [missing-import]
import torchvision.transforms as transforms
from PIL import Image
import os
import logging

logger = logging.getLogger(__name__)

class VisualFeatureExtractor:
    def __init__(self):
        try:
            self.model = models.squeezenet1_1(pretrained=True)
            self.model.eval()
            # Remove the classifier part to get raw features
            self.feature_extractor = self.model.features
            logger.info("SqueezeNet Visual Extractor initialized.")
        except Exception as e:
            logger.error(f"Failed to load SqueezeNet: {e}")
            self.feature_extractor = None

        # 2. Setup Image preprocessing
        self.transform = transforms.Compose([
            transforms.Resize((224, 224)),
            transforms.ToTensor(),
            transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
        ])

    def extract_deep_features(self, image_path):
        """Chuyển ảnh thành vector 512 đặc trưng (Deep Learning)"""
        if self.feature_extractor is None:
            return np.zeros(512)
        
        try:
            img = Image.open(image_path).convert('RGB')
            img_t = self.transform(img)
            batch_t = torch.unsqueeze(img_t, 0)
            
            with torch.no_grad():
                features = self.feature_extractor(batch_t)
                # Global Average Pooling to get 512 dimensions
                pooled_features = torch.nn.functional.adaptive_avg_pool2d(features, (1, 1))
                vector = pooled_features.flatten().numpy()
            return vector
        except Exception as e:
            logger.error(f"Error extracting deep features from {image_path}: {e}")
            return np.zeros(512)

    def extract_structural_features(self, image_path):
        """Trích xuất các đặc trưng cấu trúc dùng OpenCV (Edge density, Entropy)"""
        try:
            img = cv2.imread(image_path)
            if img is None:
                return [0, 0, 0] # entropy, edge_density, brightness_var
            
            gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
            
            # 1. Layout Entropy (Độ phức tạp giao diện)
            hist = cv2.calcHist([gray], [0], None, [256], [0, 256])
            hist = hist / hist.sum()
            entropy = -np.sum(hist * np.log2(hist + 1e-7))
            
            # 2. Edge Density (Mật độ đường kẻ - UI thường có nhiều đường kẻ thẳng)
            edges = cv2.Canny(gray, 100, 200)
            edge_density = np.mean(edges > 0)
            
            # 3. Brightness Variance (Phát hiện wallpaper nhiều màu sắc vs UI trắng của browser)
            brightness_var = np.std(gray)
            
            h, w = gray.shape
            bottom_strip = gray[int(h*0.9):, :]
            taskbar_score = np.std(bottom_strip)
            is_desktop_likely = bool(taskbar_score > 40)
            # 5. Browser Tab Detection
            top_strip = gray[:int(h*0.1), :]
            edges_top = cv2.Canny(top_strip, 50, 150)
            tab_score = np.mean(edges_top > 0)
            is_browser_ui_likely = bool(tab_score > 0.05)
            
            return {
                "entropy": entropy,
                "edge_density": edge_density,
                "brightness_var": brightness_var,
                "is_desktop_likely": is_desktop_likely,
                "is_browser_ui_likely": is_browser_ui_likely
            }
        except Exception as e:
            logger.error(f"Error extracting structural features: {e}")
            return {"entropy": 0, "edge_density": 0, "brightness_var": 0, "is_desktop_likely": False, "is_browser_ui_likely": False}

    def get_full_feature_vector(self, image_path):
        """Hợp nhất Deep Features và Structural Features"""
        deep = self.extract_deep_features(image_path)
        struct_dict = self.extract_structural_features(image_path)
        struct_vector = [
            struct_dict["entropy"], 
            struct_dict["edge_density"], 
            struct_dict["brightness_var"],
            1.0 if struct_dict["is_desktop_likely"] else 0.0,
            1.0 if struct_dict["is_browser_ui_likely"] else 0.0
        ]
        return np.concatenate([deep, struct_vector]), struct_dict

# Singleton instance
visual_extractor = VisualFeatureExtractor()
