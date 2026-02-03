import logging
import torch
from sentence_transformers import SentenceTransformer, CrossEncoder
from typing import Optional

# Setup logging
logger = logging.getLogger(__name__)

class AIModel:
    _instance = None
    _bi_encoder: Optional[SentenceTransformer] = None
    _cross_encoder: Optional[CrossEncoder] = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(AIModel, cls).__new__(cls)
            cls._instance._initialize_models()
        return cls._instance

    def _initialize_models(self):
        try:
            import os
            if torch.cuda.is_available():
                device = 'cuda'
                gpu_name = torch.cuda.get_device_name(0)
                gpu_memory = torch.cuda.get_device_properties(0).total_memory / 1024**3
                logger.info(f"🚀 GPU detected: {gpu_name} ({gpu_memory:.1f} GB)")
            else:
                device = 'cpu'
                num_threads = os.cpu_count() or 4
                torch.set_num_threads(num_threads)
                logger.info(f"⚙️ No GPU detected, using CPU with {num_threads} threads")
            
            logger.info(f"Loading models on {device}...")

            # 1. Bi-Encoder: For Semantic Similarity (Fast)
            self._bi_encoder = SentenceTransformer(
                'sentence-transformers/paraphrase-multilingual-mpnet-base-v2', 
                device=device
            )
            logger.info("✅ Bi-Encoder loaded successfully.")

            # 2. Cross-Encoder: For NLI/Logic Analysis (Accurate)
            self._cross_encoder = CrossEncoder(
                'symanto/xlm-roberta-base-snli-mnli-anli-xnli', 
                device=device
            )
            logger.info("✅ Cross-Encoder loaded successfully.")

            if device == 'cuda':
                torch.cuda.empty_cache()
                logger.info(f"📊 GPU Memory used: {torch.cuda.memory_allocated(0) / 1024**2:.1f} MB")

        except Exception as e:
            logger.error(f"Failed to load AI Models: {e}")
            raise RuntimeError("Critical: AI Models failed to initialize.") from e

    @property
    def bi_encoder(self) -> SentenceTransformer:
        if self._bi_encoder is None:
            self._initialize_models()
        return self._bi_encoder

    @property
    def cross_encoder(self) -> CrossEncoder:
        if self._cross_encoder is None:
            self._initialize_models()
        return self._cross_encoder

# Global helper to get the singleton instance
def get_ai_model():
    return AIModel()
