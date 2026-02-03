import re
from typing import List

def extract_propositions(text: str) -> List[str]:

    # Split the Model Answer into atomic facts/propositions for granular Partial Credit scoring.
    # Splits by:
    # 1. Punctuation: . ? ! ;
    # 2. Vietnamese Conjunctions (for long sentences): và, nhưng, tuy nhiên, mà, nên

    if not text:
        return []

    # 1. Split by punctuation first (strong delimiters)
    segments = re.split(r'[.!?;]', text)
    propositions = []
    conjunctions_pattern = r'\b(và|với|cùng|cùng với|hoặc|hay|hay là|hoặc là|lẫn|nhưng|tuy nhiên|mặc dù|dẫu cho|dẫu rằng|ngược lại|trái lại|mặt khác|hơn nữa|thậm chí|ngoài ra|bên cạnh đó|thêm vào đó|đồng thời|song song|kết hợp|liên kết|bao gồm|gồm|thuộc|là|thì|mà|nên|vì|do|bởi|bởi vì|nhờ|tại|trong|khi|lúc|nơi|tức là|nghĩa là|cụ thể là|ví dụ|chẳng hạn|như là|giống như|khác với|so với|đối với|về phía|liên quan đến)\b'
    
    for seg in segments:
        seg = seg.strip()
        if not seg:
            continue
            
        # 2. Split by conjunctions within segments
        sub_segments = re.split(conjunctions_pattern, seg, flags=re.IGNORECASE)
        current_prop = ""
        for part in sub_segments:
            part = part.strip()
            if re.match(conjunctions_pattern, part, flags=re.IGNORECASE):
                continue
            
            if part:
                # Add valid content part
                propositions.append(part)
                
    # User requested "if it is in model answer, don't remove it".
    # Previous filter (len >= 2 words) was too aggressive for names like "Nam", "Pháp".
    # Relaxed to len >= 1 word, but ensure it has some content chars.
    refined_props = [p for p in propositions if len(p.split()) >= 1 and any(c.isalnum() for c in p)]
    
    # Fallback: if refinement killed everything (e.g. "Đúng"), return original text as single prop
    if not refined_props and text.strip():
        return [text.strip()]
        
    return refined_props
