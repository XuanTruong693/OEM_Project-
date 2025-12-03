# 🧪 Hướng dẫn Testing Notification Queue System

## ✅ Test Case 1: Single F11 Press = 1/5

**Steps:**

1. Student enters exam and opens TakeExam page
2. Press F11 once
3. Instructor sees modal with "1/5"
4. Console should show: `📊 [Proctor] Current cheating_count: 1`

**Expected:** ✅ 1/5 (NOT 7/5)

---

## ✅ Test Case 2: Two F11 Presses = 2/5

**Steps:**

1. Student in exam, press F11
2. Wait 1+ second
3. Press F11 again
4. Instructor sees modal with "2/5"

**Expected:** ✅ 2/5 (NOT 7/5)

**Console checks:**

- Backend: `📊 [Proctor] Current cheating_count: 1` then `2`
- Frontend: `📤 [Proctor] Sending event: blocked_key`

---

## ✅ Test Case 3: Two Students Cheating (Queue System)

**Setup:**

- 2 students in same exam
- Student A and Student B

**Steps:**

1. **t=0s**: Student A presses F11

   - Instructor sees: Modal A (Student A, 1/5)
   - Queue: 1 item
   - Console: `🎯 [Instructor] Showing first notification`

2. **t=3s**: Student B presses F11

   - Instructor still sees: Modal A
   - Queue: 2 items (A, B sorted by time)
   - Console: `📬 [Instructor] Queue updated. Total: 2 notifications`
   - Console: `📦 [Instructor] Notification queued - will auto-advance in 10s`

3. **t=10s**: Auto-advance triggers

   - Instructor sees: Modal B (Student B, 1/5)
   - Queue: 1 item remaining
   - Console: `⏰ [Instructor] Auto-advancing to next notification after 10s`

4. User clicks "Tiếp tục giám sát" button
   - Modal closes
   - Console: `✅ [Instructor] All notifications cleared`

**Expected:**

- ✅ Modal A shows first (by timestamp priority)
- ✅ Auto-advances to Modal B after 10s
- ✅ Button shows "+1" badge when queue has items

---

## ✅ Test Case 4: Deduplication (No Duplicate Events)

**Steps:**

1. Student rapidly presses F11 multiple times (5x in 1 second)
2. Backend receives requests but only processes first one per 500ms window

**Expected:**

- ✅ Backend logs: `⏸️ [Proctor] DUPLICATE EVENT THROTTLED` for duplicates
- ✅ Only legitimate events get processed
- ✅ Final count = 1, 2, 3 (not 5)

**Console check:**

- Backend: Look for `DUPLICATE EVENT THROTTLED` messages

---

## ✅ Test Case 5: No Auto-Close on Modal

**Steps:**

1. Instructor sees cheating notification
2. Wait 30 seconds
3. Modal should STILL be visible

**Expected:**

- ✅ Modal does NOT close automatically
- ✅ Only closes when user clicks button or new violation arrives

---

## 🔍 Key Console Logs to Verify

### Backend (submissionController.js)

```
✅ [Proctor] Cheating logged with ID: ...
📊 [Proctor] Current cheating_count: X
⏸️ [Proctor] DUPLICATE EVENT THROTTLED: submission-123-blocked_key
```

### Frontend Student (TakeExam.jsx)

```
📤 [Proctor] Sending event: blocked_key for submission ...
✅ [Proctor] blocked_key logged: {...}
⏸️ [TakeExam] Violation throttled (blocked_key)
```

### Frontend Instructor (InstructorOverlay.jsx)

```
🚨 [Instructor] Cheating detected: {...}
🎯 [Instructor] Showing first notification
📬 [Instructor] Queue updated. Total: 2 notifications
⏰ [Instructor] Auto-advancing to next notification after 10s
📬 [Instructor] Showing next notification from queue
```

---

## 🚀 Quick Test Steps

### Option A: Manual Testing

```bash
# Terminal 1: Backend
cd backend && npm run dev

# Terminal 2: Frontend
cd frontend && npm run dev

# Browser 1: Student exam page
# Browser 2: Instructor page
# Test F11 presses and observe console + UI
```

### Option B: Automated Test (Future)

- Create E2E tests with Cypress/Playwright
- Simulate multiple socket events
- Verify queue ordering and timing

---

## ⚠️ Known Issues to Check

- ❌ Cheating count shows 7/5 instead of 2/5 → FIXED with deduplication
- ❌ Modal auto-closes → FIXED (no auto-close now)
- ❌ Queue not working → FIXED (implemented queue system)

---

## ✨ Success Criteria

- [x] F11 twice = 2/5 ✓
- [x] No auto-close on modal ✓
- [x] Queue notifications by timestamp ✓
- [x] Auto-advance after 10s ✓
- [x] Badge shows pending count ✓
- [x] Deduplication in 500ms window ✓
