// ===== Inactivity Monitor Hook =====
// Mục đích: Theo dõi thao tác của sinh viên và phát hiện không hoạt động (idle)
// - 30s idle: Warning sound (loop 3s) + toast
// - 60s idle: Low-severity violation + alarm + notify instructor

import { useRef, useEffect } from "react";

// Thời gian ngưỡng (ms)
const WARNING_THRESHOLD_MS = 30000;    // 30 giây - cảnh báo
const VIOLATION_THRESHOLD_MS = 60000;  // 60 giây - vi phạm
const CHECK_INTERVAL_MS = 5000;        // Kiểm tra mỗi 5 giây
const WARNING_SOUND_DURATION_MS = 3000; // Âm thanh cảnh báo kêu 3 giây

/**
 * Hook theo dõi inactivity của sinh viên
 * @param {Object} options
 * @param {boolean} options.enabled - Bật/tắt monitoring
 * @param {Function} options.onWarning - Callback khi cảnh báo (30s)
 * @param {Function} options.onViolation - Callback khi vi phạm (60s)
 * @param {Function} options.flash - Function hiển thị toast
 */
export function useInactivityMonitor({
    enabled = true,
    onWarning,
    onViolation,
    flash,
}) {
    // Use refs to store callbacks to avoid dependency changes
    const onWarningRef = useRef(onWarning);
    const onViolationRef = useRef(onViolation);
    const flashRef = useRef(flash);

    // Update refs when callbacks change
    useEffect(() => {
        onWarningRef.current = onWarning;
        onViolationRef.current = onViolation;
        flashRef.current = flash;
    }, [onWarning, onViolation, flash]);

    const lastActivityRef = useRef(Date.now());
    const warningShownRef = useRef(false);
    const violationReportedRef = useRef(false);
    const checkIntervalRef = useRef(null);
    const warningSoundRef = useRef(null);
    const alarmSoundRef = useRef(null);
    const warningSoundTimeoutRef = useRef(null);
    const isMonitoringRef = useRef(false); // Track if already monitoring

    // Main effect - runs only when `enabled` changes
    useEffect(() => {
        if (!enabled) {
            // Cleanup when disabled
            if (checkIntervalRef.current) {
                clearInterval(checkIntervalRef.current);
                checkIntervalRef.current = null;
            }
            if (warningSoundTimeoutRef.current) {
                clearTimeout(warningSoundTimeoutRef.current);
            }
            isMonitoringRef.current = false;
            console.log("🔴 [Inactivity] Monitoring STOPPED");
            return;
        }

        // Prevent multiple starts
        if (isMonitoringRef.current) {
            return;
        }
        isMonitoringRef.current = true;

        console.log("🟢 [Inactivity] Monitoring STARTED - will check every 5s");

        // Initialize sounds
        try {
            warningSoundRef.current = new Audio("/sounds/ting_warning.mp3");
            warningSoundRef.current.volume = 0.7;
            alarmSoundRef.current = new Audio("/sounds/alarm.mp3");
            alarmSoundRef.current.volume = 0.8;
        } catch (e) {
            console.warn("[Inactivity] Cannot load sounds:", e);
        }

        // Reset activity timestamp when starting
        lastActivityRef.current = Date.now();
        warningShownRef.current = false;
        violationReportedRef.current = false;

        // Play warning sound with 3s loop
        const playWarningSound = () => {
            try {
                if (warningSoundRef.current) {
                    warningSoundRef.current.currentTime = 0;
                    warningSoundRef.current.loop = true;
                    warningSoundRef.current.play().catch(() => { });
                    warningSoundTimeoutRef.current = setTimeout(() => {
                        if (warningSoundRef.current) {
                            warningSoundRef.current.loop = false;
                            warningSoundRef.current.pause();
                            warningSoundRef.current.currentTime = 0;
                        }
                    }, WARNING_SOUND_DURATION_MS);
                }
            } catch (e) {
                console.warn("[Inactivity] Cannot play warning sound:", e);
            }
        };

        // Play alarm sound
        const playAlarmSound = () => {
            try {
                if (alarmSoundRef.current) {
                    alarmSoundRef.current.currentTime = 0;
                    alarmSoundRef.current.play().catch(() => { });
                }
            } catch (e) {
                console.warn("[Inactivity] Cannot play alarm sound:", e);
            }
        };

        // Check inactivity function
        const checkInactivity = () => {
            const elapsed = Date.now() - lastActivityRef.current;
            const elapsedSec = Math.round(elapsed / 1000);

            // 60s+ = Violation
            if (elapsed >= VIOLATION_THRESHOLD_MS && !violationReportedRef.current) {
                console.log(`🚨 [Inactivity] VIOLATION! Idle for ${elapsedSec}s`);
                violationReportedRef.current = true;
                playAlarmSound();

                if (flashRef.current) {
                    flashRef.current("🚨 Không thao tác, không làm bài - Đã ghi nhận vi phạm!", "danger", 6000);
                }
                if (onViolationRef.current) {
                    onViolationRef.current("inactivity", "Không thao tác, không làm bài quá 1 phút");
                }

                // Reset timer to continue counting - after 1 more minute without activity, trigger another violation
                setTimeout(() => {
                    if (isMonitoringRef.current) {
                        lastActivityRef.current = Date.now(); // Reset activity timer
                        violationReportedRef.current = false; // Allow next violation
                        warningShownRef.current = false; // Reset warning state
                        console.log("🔄 [Inactivity] Timer reset - will count next 60s of inactivity");
                    }
                }, 1000); // Small delay before resetting
            }
            // 30s-60s = Warning
            else if (elapsed >= WARNING_THRESHOLD_MS && !warningShownRef.current) {
                console.log(`⚠️ [Inactivity] WARNING! Idle for ${elapsedSec}s`);
                warningShownRef.current = true;
                playWarningSound();

                if (flashRef.current) {
                    flashRef.current("⚠️ Vui lòng tập trung làm bài!", "warn", 5000);
                }
                if (onWarningRef.current) {
                    onWarningRef.current();
                }
            }
        };

        // Activity handler - reset timer when user interacts
        const handleActivity = () => {
            const wasIdle = warningShownRef.current || violationReportedRef.current;
            lastActivityRef.current = Date.now();

            if (wasIdle) {
                console.log("✅ [Inactivity] User active again, resetting");
                warningShownRef.current = false;
                violationReportedRef.current = false;
                // Stop warning sound if playing
                if (warningSoundRef.current) {
                    warningSoundRef.current.pause();
                    warningSoundRef.current.currentTime = 0;
                    warningSoundRef.current.loop = false;
                }
                if (warningSoundTimeoutRef.current) {
                    clearTimeout(warningSoundTimeoutRef.current);
                }
            }
        };

        // Desktop + mobile events
        const events = ["mousemove", "mousedown", "keydown", "wheel", "scroll", "touchstart", "touchmove", "click"];
        events.forEach(evt => document.addEventListener(evt, handleActivity, { passive: true }));

        // Start interval
        checkIntervalRef.current = setInterval(checkInactivity, CHECK_INTERVAL_MS);

        // Cleanup function
        return () => {
            events.forEach(evt => document.removeEventListener(evt, handleActivity));
            if (checkIntervalRef.current) {
                clearInterval(checkIntervalRef.current);
                checkIntervalRef.current = null;
            }
            if (warningSoundTimeoutRef.current) {
                clearTimeout(warningSoundTimeoutRef.current);
            }
            if (warningSoundRef.current) {
                warningSoundRef.current.pause();
                warningSoundRef.current = null;
            }
            if (alarmSoundRef.current) {
                alarmSoundRef.current.pause();
                alarmSoundRef.current = null;
            }
            isMonitoringRef.current = false;
            console.log("🛑 [Inactivity] Cleanup complete");
        };
    }, [enabled]); // ONLY depend on `enabled` - use refs for callbacks

    return {
        resetActivity: () => {
            lastActivityRef.current = Date.now();
            warningShownRef.current = false;
            violationReportedRef.current = false;
        },
    };
}

export default useInactivityMonitor;
