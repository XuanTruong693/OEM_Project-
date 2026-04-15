import logging
import torch
from sentence_transformers import SentenceTransformer, CrossEncoder
from typing import Optional

# Setup logging
logger = logging.getLogger(__name__)

class AIModel:
    _instance = None
    _bi_encoder: Optional[SentenceTransformer] = None
    _finetuned_encoder: Optional[SentenceTransformer] = None
    _reranker: Optional[CrossEncoder] = None

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
            logger.info("✅ NLI Cross-Encoder loaded successfully.")

            # 3. Reranker: For High-Precision Similarity (The "Best" Model)
            self._reranker = CrossEncoder(
                'BAAI/bge-reranker-v2-m3', 
                device=device
            )
            logger.info("✅ BGE-Reranker v2-m3 loaded successfully.")

            # 3. Fine-Tuned Bi-Encoder (V3): Fast-Track Grading
            model_path = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', 'models', 'my_finetuned_mpnet_oem_v3'))
            if os.path.exists(model_path):
                try:
                    self._finetuned_encoder = SentenceTransformer(model_path, device=device)
                    logger.info("✅ Fine-Tuned Model (V3) loaded successfully.")
                except Exception as e:
                    logger.error(f"❌ Failed to load Fine-Tuned Model from {model_path}: {e}")
                    self._finetuned_encoder = None
            else:
                logger.warning(f"⚠️ Fine-Tuned Model missing: Directory '{model_path}' not found. Fast-track will be disabled.")

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

    @property
    def finetuned_encoder(self) -> Optional[SentenceTransformer]:
        if self._finetuned_encoder is None and self._bi_encoder is None:
            self._initialize_models()
        return self._finetuned_encoder

    @property
    def reranker(self) -> CrossEncoder:
        if self._reranker is None:
            self._initialize_models()
        return self._reranker

# Global helper to get the singleton instance
def get_ai_model():
    return AIModel()
