"""
Test AI Model - Nhan dien hanh vi gian lan tinh vi
Ma rule-based cung khong bat duoc
"""
import sys, logging
logging.basicConfig(level=logging.WARNING)
sys.path.insert(0, '.')
from app.nlp.behavior_detection import behavior_model

print("=" * 65)
print("  TEST AI MODEL: Nhan dien hanh vi gian lan TINH VI")
print("  (Nhung hanh vi ma rule-based khong bao gio bat duoc)")
print("=" * 65)

test_cases = [
    {
        "name": "1. Nhin dien thoai / tai lieu giay",
        "desc": "Mouse ra ngoai nhieu lan, moi lan 10-15s - khong doi tab",
        "events": [
            {"event_type": "mouse_outside", "details": {"duration_ms": 12000}},
            {"event_type": "mouse_outside", "details": {"duration_ms": 9000}},
            {"event_type": "mouse_outside", "details": {"duration_ms": 15000}},
            {"event_type": "mouse_outside", "details": {"duration_ms": 11000}},
        ]
    },
    {
        "name": "2. Roi cua so lau (nghi nhac tai lieu)",
        "desc": "Blur truong hop SV alt+tab xong nhin man hinh khac 25 giay",
        "events": [
            {"event_type": "window_blur", "details": {"duration_ms": 25000}},
            {"event_type": "window_blur", "details": {"duration_ms": 18000}},
        ]
    },
    {
        "name": "3. Copy-Paste nhieu lan (chua bao gio doi tab)",
        "desc": "SV copy tu man hinh khac paste vao - khong thay tab switch",
        "events": [
            {"event_type": "copy", "details": {}},
            {"event_type": "copy", "details": {}},
            {"event_type": "copy", "details": {}},
            {"event_type": "paste", "details": {}},
            {"event_type": "paste", "details": {}},
            {"event_type": "paste", "details": {}},
        ]
    },
    {
        "name": "4. Doi tab nhanh - evasive (moi lan < 3s de tranh bi bat)",
        "desc": "SV co tinh xem nhanh tai lieu 7 lan, moi lan duoi nguong phat hien",
        "events": [
            {"event_type": "tab_switch", "details": {"duration_ms": 2000}},
            {"event_type": "tab_switch", "details": {"duration_ms": 1500}},
            {"event_type": "tab_switch", "details": {"duration_ms": 2500}},
            {"event_type": "tab_switch", "details": {"duration_ms": 1800}},
            {"event_type": "tab_switch", "details": {"duration_ms": 2100}},
            {"event_type": "tab_switch", "details": {"duration_ms": 900}},
            {"event_type": "tab_switch", "details": {"duration_ms": 3000}},
        ]
    },
    {
        "name": "5. Gian lan ket hop tinh vi (nhieu hanh vi nho)",
        "desc": "Blur ngan + mouse out + copy moi lan chi 1 => tong the dang nghi",
        "events": [
            {"event_type": "window_blur", "details": {"duration_ms": 3500}},
            {"event_type": "mouse_outside", "details": {"duration_ms": 9500}},
            {"event_type": "copy", "details": {}},
            {"event_type": "mouse_outside", "details": {"duration_ms": 8200}},
            {"event_type": "window_blur", "details": {"duration_ms": 4500}},
            {"event_type": "paste", "details": {}},
        ]
    },
    {
        "name": "6. Fullscreen exit nhieu lan (co the vo tinh HOAC co y)",
        "desc": "3 lan thoat fullscreen - AI phan tich xac suat dua tren ket hop",
        "events": [
            {"event_type": "fullscreen_lost", "details": {}},
            {"event_type": "window_blur", "details": {"duration_ms": 5000}},
            {"event_type": "fullscreen_lost", "details": {}},
            {"event_type": "fullscreen_lost", "details": {}},
        ]
    },
    {
        "name": "7. SCREENSHOT: Chup man hinh don thuan (PrtSc nhieu lan)",
        "desc": "SV nhan PrtSc 5 lan trong bai thi, khong lam gi them",
        "events": [
            {"event_type": "screenshot_attempt", "details": {"key": "PrtSc"}},
            {"event_type": "screenshot_attempt", "details": {"key": "PrtSc"}},
            {"event_type": "screenshot_attempt", "details": {"key": "PrtSc"}},
            {"event_type": "screenshot_attempt", "details": {"key": "PrtSc"}},
            {"event_type": "screenshot_attempt", "details": {"key": "PrtSc"}},
        ]
    },
    {
        "name": "8. SCREENSHOT: Ctrl+PrtSc roi paste vao bai",
        "desc": "SV chup Ctrl+PrtSc 3 lan, sau do paste vao o tra loi",
        "events": [
            {"event_type": "screenshot_attempt", "details": {"key": "Ctrl+PrtSc"}},
            {"event_type": "screenshot_attempt", "details": {"key": "Ctrl+PrtSc"}},
            {"event_type": "paste", "details": {}},
            {"event_type": "screenshot_attempt", "details": {"key": "Ctrl+PrtSc"}},
            {"event_type": "paste", "details": {}},
            {"event_type": "paste", "details": {}},
        ]
    },
    {
        "name": "9. SCREENSHOT: Alt+PrtSc lien tuc + doi tab",
        "desc": "SV doi tab, chup man hinh cua so khac nhieu lan lien tuc",
        "events": [
            {"event_type": "tab_switch", "details": {"duration_ms": 3000}},
            {"event_type": "screenshot_attempt", "details": {"key": "Alt+PrtSc"}},
            {"event_type": "tab_switch", "details": {"duration_ms": 2500}},
            {"event_type": "screenshot_attempt", "details": {"key": "Alt+PrtSc"}},
            {"event_type": "screenshot_attempt", "details": {"key": "Alt+PrtSc"}},
            {"event_type": "tab_switch", "details": {"duration_ms": 2000}},
            {"event_type": "screenshot_attempt", "details": {"key": "Alt+PrtSc"}},
        ]
    },
    {
        "name": "--- SV binh thuong: tap trung lam bai ---",
        "desc": "Khong co bat ky dau hieu nao bat thuong",
        "events": [
            {"event_type": "window_blur", "details": {"duration_ms": 300}},  # vo tinh
        ]
    },
    {
        "name": "--- SV binh thuong: ray chuot ra ngoai 1 lan ---",
        "desc": "Chi 1 lan mouse ra ngoai ngan - hoan toan binh thuong",
        "events": [
            {"event_type": "mouse_outside", "details": {"duration_ms": 800}},
        ]
    },
]

PASS = 0
TOTAL = 0
for tc in test_cases:
    result = behavior_model.detect_cheating(tc["events"])
    is_cheat = result["is_cheating"]
    conf = result["confidence"]
    reason = result.get("reason", "-")
    f = result["features_extracted"]

    if "binh thuong" in tc["name"].lower():
        correct = not is_cheat
        expected = "BINH THUONG"
    else:
        correct = is_cheat
        expected = "GIAN LAN"

    status_icon = "PASS" if correct else "FAIL"
    detect_icon = "🚨 GIAN LAN" if is_cheat else "✅ BINH THUONG"
    TOTAL += 1
    if correct: PASS += 1

    print(f"\n[{status_icon}] {tc['name']}")
    print(f"       {tc['desc']}")
    print(f"       => {detect_icon} | Confidence: {conf:.1%} | Ly do: {reason}")
    print(f"       Features: tab={f['tab_switches']}, blur={f['blur_events']}, copy={f['copy_attempts']}, "
          f"paste={f['paste_attempts']}, mouse_out={f['mouse_outside_count']}, "
          f"screenshot={f['screenshot_attempts']}, max_blur={f['max_blur_duration_ms']}ms")

print("\n" + "=" * 65)
print(f"  TONG KET: {PASS}/{TOTAL} test cases du kien dung")
print("=" * 65)
