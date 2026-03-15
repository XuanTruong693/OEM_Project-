import pandas as pd
import numpy as np
import random
import os

# Đường dẫn file output
output_file = os.path.join(os.path.dirname(__file__), "comprehensive_cheating_dataset.csv")

# Tổng số sessions cần tạo
NUM_SESSIONS = 5000

print(f"Bắt đầu tạo {NUM_SESSIONS} sessions dữ liệu giả lập...")

data = []

for i in range(NUM_SESSIONS):
    session_id = f"SES_{str(i+1).zfill(5)}"
    student_id = f"STU_{random.randint(1000, 9999)}"
    duration = 3600  # 1 hour
    
    # Random label: 0 (Normal) - 60%, 1 (Cheating) - 40%
    label = 1 if random.random() < 0.4 else 0
    
    if label == 1:
        # Cheating profiles (da dang tu tinh vi den ro rang)
        cheating_type = random.choice([
            'heavy_tapper',      # Doi tab nhieu, ro rang
            'long_blurer',       # Blur lau - nhin tai lieu
            'copy_paster',       # Copy paste nhieu
            'mixed',             # Ket hop nhieu loai
            'blur_only',         # Chi blur lau, khong doi tab
            'copy_paste_only',   # Chi copy paste, khong doi tab
            'tab_evasive',       # Doi tab nhanh nhieu lan
            'mouse_looker',      # Chi nhin dien thoai qua mouse_outside
            'mixed_light',       # Nhieu hanh vi nhe ket hop
            # --- MỚI: Hanh vi chup man hinh ---
            'screenshot_only',        # Chi PrtSc / Ctrl+PrtSc nhieu lan, khong co gi khac
            'screenshot_then_paste',  # Chup roi paste vao bai (chup tu dien thoai / tai lieu)
            'screenshot_frequent',    # Chup man hinh lien tuc + doi tab + blur
        ])
        
        if cheating_type == 'heavy_tapper':
            tab_switches = random.randint(5, 25)
            blur_events = tab_switches + random.randint(0, 5)
            blocked_keys = random.randint(1, 10)
            fullscreen_exits = random.randint(1, 4)
            copy_attempts = random.randint(0, 2)
            paste_attempts = random.randint(0, 2)
            avg_blur_dur = random.randint(1000, 5000)
            max_blur_dur = avg_blur_dur + random.randint(1000, 6000)
            mouse_outside = random.randint(3, 15)
        elif cheating_type == 'long_blurer':
            tab_switches = random.randint(1, 5)
            blur_events = tab_switches + random.randint(0, 2)
            blocked_keys = random.randint(0, 2)
            fullscreen_exits = random.randint(1, 3)
            copy_attempts = 0
            paste_attempts = 0
            avg_blur_dur = random.randint(10000, 30000)
            max_blur_dur = avg_blur_dur + random.randint(5000, 20000)
            mouse_outside = random.randint(2, 10)
        elif cheating_type == 'copy_paster':
            tab_switches = random.randint(2, 5)
            blur_events = tab_switches
            blocked_keys = random.randint(3, 8)
            fullscreen_exits = random.randint(0, 1)
            copy_attempts = random.randint(3, 10)
            paste_attempts = random.randint(3, 10)
            avg_blur_dur = random.randint(2000, 8000)
            max_blur_dur = avg_blur_dur + random.randint(1000, 5000)
            mouse_outside = random.randint(2, 8)
        elif cheating_type == 'mixed':
            tab_switches = random.randint(8, 15)
            blur_events = tab_switches + random.randint(2, 6)
            blocked_keys = random.randint(4, 12)
            fullscreen_exits = random.randint(2, 5)
            copy_attempts = random.randint(1, 5)
            paste_attempts = random.randint(1, 5)
            avg_blur_dur = random.randint(4000, 12000)
            max_blur_dur = avg_blur_dur + random.randint(5000, 15000)
            mouse_outside = random.randint(5, 20)
        elif cheating_type == 'blur_only':
            # Chi roi cua so / blur lau, KHONG doi tab - nhin tai lieu giay
            tab_switches = random.randint(0, 1)
            blur_events = random.randint(2, 5)
            blocked_keys = 0
            fullscreen_exits = random.randint(0, 1)
            copy_attempts = 0
            paste_attempts = 0
            avg_blur_dur = random.randint(15000, 35000)  # 15-35s la dau hieu ro
            max_blur_dur = avg_blur_dur + random.randint(5000, 15000)
            mouse_outside = random.randint(0, 2)
        elif cheating_type == 'copy_paste_only':
            # Chi copy paste, khong doi tab - co the dung AI khac tren may
            tab_switches = 0
            blur_events = random.randint(0, 1)
            blocked_keys = random.randint(2, 6)
            fullscreen_exits = 0
            copy_attempts = random.randint(3, 10)
            paste_attempts = random.randint(3, 10)
            avg_blur_dur = random.randint(0, 1000)
            max_blur_dur = avg_blur_dur + random.randint(0, 2000)
            mouse_outside = random.randint(0, 2)
        elif cheating_type == 'tab_evasive':
            # Doi tab nhieu lan NHUNG moi lan rat ngan (< 3s) de tranh bi bat
            tab_switches = random.randint(6, 15)  # nhieu lan
            blur_events = tab_switches + random.randint(0, 2)
            blocked_keys = random.randint(0, 3)
            fullscreen_exits = 0
            copy_attempts = random.randint(0, 1)
            paste_attempts = random.randint(0, 1)
            avg_blur_dur = random.randint(1000, 3000)  # ngan moi lan
            max_blur_dur = avg_blur_dur + random.randint(500, 2000)  # max cung ngan
            mouse_outside = random.randint(1, 5)
        elif cheating_type == 'mouse_looker':
            # Chi nhin dien thoai qua mouse_outside, khong doi tab
            tab_switches = 0
            blur_events = random.randint(0, 1)
            blocked_keys = 0
            fullscreen_exits = 0
            copy_attempts = 0
            paste_attempts = 0
            avg_blur_dur = random.randint(0, 500)
            max_blur_dur = avg_blur_dur + random.randint(0, 1000)
            mouse_outside = random.randint(4, 20)  # chi co mouse ra ngoai nhieu
        else:  # mixed_light
            # Nhieu loai hanh vi tinh vi NHO ket hop voi nhau
            tab_switches = random.randint(1, 4)
            blur_events = random.randint(2, 4)
            blocked_keys = random.randint(1, 3)
            fullscreen_exits = random.randint(0, 2)
            copy_attempts = random.randint(1, 3)
            paste_attempts = random.randint(1, 3)
            avg_blur_dur = random.randint(5000, 12000)
            max_blur_dur = avg_blur_dur + random.randint(2000, 8000)
            mouse_outside = random.randint(2, 6)

        # --- Screenshot cheating profiles ---
        if cheating_type == 'screenshot_only':
            # SV chi dung PrtSc / Ctrl+PrtSc de chup de lieu, khong lam gi them
            tab_switches = random.randint(0, 2)
            blur_events = random.randint(0, 1)
            blocked_keys = 0
            fullscreen_exits = 0
            copy_attempts = 0
            paste_attempts = 0
            avg_blur_dur = random.randint(0, 1000)
            max_blur_dur = avg_blur_dur + random.randint(0, 2000)
            mouse_outside = random.randint(0, 2)
            screenshot_attempts = random.randint(3, 12)  # Rat nhieu lan chup
        elif cheating_type == 'screenshot_then_paste':
            # Chup man hinh dap an roi paste vao o tra loi
            tab_switches = random.randint(1, 3)
            blur_events = random.randint(1, 3)
            blocked_keys = random.randint(1, 4)
            fullscreen_exits = random.randint(0, 1)
            copy_attempts = random.randint(2, 6)   # Copy sau khi chup
            paste_attempts = random.randint(2, 6)  # Paste vao bai
            avg_blur_dur = random.randint(3000, 10000)
            max_blur_dur = avg_blur_dur + random.randint(2000, 8000)
            mouse_outside = random.randint(1, 5)
            screenshot_attempts = random.randint(2, 8)  # Chup nhieu lan
        elif cheating_type == 'screenshot_frequent':
            # Chup man hinh thuong xuyen + doi tab + moi lan ngan
            tab_switches = random.randint(3, 8)
            blur_events = tab_switches + random.randint(0, 3)
            blocked_keys = random.randint(2, 6)
            fullscreen_exits = random.randint(0, 2)
            copy_attempts = random.randint(0, 2)
            paste_attempts = random.randint(0, 2)
            avg_blur_dur = random.randint(1500, 5000)
            max_blur_dur = avg_blur_dur + random.randint(1000, 5000)
            mouse_outside = random.randint(3, 10)
            screenshot_attempts = random.randint(5, 15)  # Chup lien tuc

        idle_time = random.randint(10000, 150000)
        typing_gaps = round(random.uniform(5.0, 25.0), 2)
        devtools_attempts = 1 if random.random() < 0.2 else 0
        # Neu chua duoc set boi screenshot profile, gan gia tri mac dinh nho (0-2)
        if cheating_type not in ('screenshot_only', 'screenshot_then_paste', 'screenshot_frequent'):
            screenshot_attempts = random.randint(0, 2) if random.random() < 0.3 else 0

    else:
        # Normal profiles (Sinh viên thi bình thường)
        # Thỉnh thoảng có false positives nhỏ
        is_clumsy = random.random() < 0.15 # 15% sv normal lóng ngóng exit out
        
        if is_clumsy:
            tab_switches = random.randint(1, 2)
            blur_events = random.randint(1, 3)
            blocked_keys = random.randint(0, 1)
            fullscreen_exits = 1
            avg_blur_dur = random.randint(500, 2000)
        else:
            tab_switches = 0
            blur_events = random.randint(0, 1)
            blocked_keys = 0
            fullscreen_exits = 0
            avg_blur_dur = random.randint(0, 500) if blur_events > 0 else 0
            
        max_blur_dur = avg_blur_dur + random.randint(0, 1000) if avg_blur_dur > 0 else 0
        copy_attempts = 0
        paste_attempts = 0
        idle_time = random.randint(1000, 15000)
        typing_gaps = round(random.uniform(0.3, 3.5), 2)
        mouse_outside = random.randint(0, 1)  # Normal students rarely move mouse outside
        devtools_attempts = 0
        screenshot_attempts = 0  # Normal students don't take screenshots

    data.append([
        session_id, student_id, duration, 
        tab_switches, blur_events, blocked_keys, fullscreen_exits, 
        avg_blur_dur, max_blur_dur, idle_time, typing_gaps, 
        mouse_outside, copy_attempts, paste_attempts, devtools_attempts, 
        screenshot_attempts, label
    ])

df = pd.DataFrame(data, columns=[
    'session_id', 'student_id', 'duration_seconds', 
    'tab_switches', 'blur_events', 'blocked_keys', 'fullscreen_exits', 
    'avg_blur_duration_ms', 'max_blur_duration_ms', 'total_idle_ms', 'typing_gaps_avg_sec', 
    'mouse_outside_count', 'copy_attempts', 'paste_attempts', 'devtools_attempts', 
    'screenshot_attempts', 'label'
])

df.to_csv(output_file, index=False)
print(f"Đã lưu dataset thành công tại {output_file}")
print("Phân phối nhãn:")
print(df['label'].value_counts(normalize=True))
