import re
from typing import List

def extract_propositions(text: str) -> List[str]:
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
    refined_props = [p for p in propositions if len(p.split()) >= 1 and any(c.isalnum() for c in p)]
    if not refined_props and text.strip():
        return [text.strip()]
        
    return refined_props
