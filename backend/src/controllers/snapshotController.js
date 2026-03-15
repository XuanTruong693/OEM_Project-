const fs = require('fs');
const path = require('path');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegStatic = require('ffmpeg-static');

// Set ffmpeg path from bundled static binary (no system install required)
if (ffmpegStatic) {
    ffmpeg.setFfmpegPath(ffmpegStatic);
}

// Đảm bảo thư mục lưu trữ snapshots tồn tại
const SNAPSHOTS_DIR = path.join(__dirname, '../../uploads/snapshots');
if (!fs.existsSync(SNAPSHOTS_DIR)) {
    fs.mkdirSync(SNAPSHOTS_DIR, { recursive: true });
}
const VIDEOS_DIR = path.join(__dirname, '../../uploads/videos');
if (!fs.existsSync(VIDEOS_DIR)) {
    fs.mkdirSync(VIDEOS_DIR, { recursive: true });
}

exports.uploadSnapshots = async (req, res) => {
    try {
        const { submissionId } = req.params;
        const { violation_id, frames, fps } = req.body;

        if (!frames || !frames.length) {
            return res.status(400).json({ error: 'No frames provided' });
        }

        const submissionDir = path.join(SNAPSHOTS_DIR, String(submissionId));
        const violationDir = path.join(submissionDir, violation_id || 'general');

        if (!fs.existsSync(violationDir)) {
            fs.mkdirSync(violationDir, { recursive: true });
        }

        // Đếm số lượng frame hiện có để đánh số tăng dần
        const existingFiles = fs.readdirSync(violationDir).filter(f => f.endsWith('.webp'));
        let frameCounter = existingFiles.length + 1;

        // Lưu các frame WebP
        for (const frameData of frames) {
            // frameData có dạng: "data:image/webp;base64,UklGR..."
            const base64Data = frameData.replace(/^data:image\/webp;base64,/, "");
            // Lưu file format: frame_001.webp
            const fileName = `frame_${String(frameCounter).padStart(4, '0')}.webp`;
            const filePath = path.join(violationDir, fileName);

            fs.writeFileSync(filePath, base64Data, 'base64');
            frameCounter++;
        }

        return res.status(200).json({
            success: true,
            message: `Saved ${frames.length} frames for violation ${violation_id}`,
            violation_id
        });
    } catch (error) {
        console.error('[SnapshotController] upload error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

exports.mergeToVideo = async (req, res) => {
    try {
        const { submissionId } = req.params;
        const { violation_id: rawViolationId } = req.body; // Nếu undefined -> ghép toàn bộ frame của submission
        // === FIX: Convert to string to prevent path.join TypeError when it's a number ===
        const violation_id = rawViolationId != null ? String(rawViolationId) : null;

        const submissionDir = path.join(SNAPSHOTS_DIR, String(submissionId));
        let framesDir = submissionDir;
        let outputFileName = `submission_${submissionId}_full.mp4`;

        if (violation_id) {
            framesDir = path.join(submissionDir, violation_id);
            outputFileName = `submission_${submissionId}_violation_${violation_id}.mp4`;
        }

        const outputPath = path.join(VIDEOS_DIR, outputFileName);

        // Kiểm tra đã ghép chưa
        if (fs.existsSync(outputPath)) {
            return res.status(200).json({
                success: true,
                message: 'Video already exists',
                video_url: `/uploads/videos/${outputFileName}`
            });
        }

        if (!fs.existsSync(framesDir)) {
            return res.status(404).json({ error: 'No snapshots found for this target' });
        }

        // Lấy link tất cả webp (để đảm bảo có formated đúng)
        let files = [];
        if (violation_id) {
            files = fs.readdirSync(framesDir).filter(f => f.endsWith('.webp'));
        } else {
            // Đọc tất cả thư mục con nếu ghép full
            const subdirs = fs.readdirSync(framesDir, { withFileTypes: true })
                .filter(dirent => dirent.isDirectory())
                .map(dirent => dirent.name);

            for (const dir of subdirs) {
                const subFiles = fs.readdirSync(path.join(framesDir, dir)).filter(f => f.endsWith('.webp'));
                subFiles.sort().forEach(f => files.push(path.join(dir, f)));
            }
        }

        if (files.length === 0) {
            return res.status(404).json({ error: 'No frame images found' });
        }

        // Copy toàn bộ file ra 1 thư mục temp tuần tự theo format frm_%04d.webp để FFmpeg dễ đọc
        const tempDir = path.join(framesDir, 'temp_merge');
        if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

        files.forEach((file, index) => {
            const srcPath = violation_id ? path.join(framesDir, file) : path.join(framesDir, file);
            const destPath = path.join(tempDir, `frm_${String(index + 1).padStart(4, '0')}.webp`);
            fs.copyFileSync(srcPath, destPath);
        });

        const filePattern = path.join(tempDir, 'frm_%04d.webp');

        // Construct FFmpeg command
        ffmpeg()
            .input(filePattern)
            .inputFPS(3) // 3 frames per second as requested
            .outputOptions([
                '-c:v libx264',
                '-pix_fmt yuv420p',
                '-preset fast',
                '-crf 23'
            ])
            .save(outputPath)
            .on('end', () => {
                // Cleanup temp folder
                fs.rmSync(tempDir, { recursive: true, force: true });
                res.status(200).json({
                    success: true,
                    video_url: `/uploads/videos/${outputFileName}` // Cần serve static endpoint cho uploads
                });
            })
            .on('error', (err) => {
                console.error('[SnapshotController] FFmpeg error:', err);
                fs.rmSync(tempDir, { recursive: true, force: true });
                res.status(500).json({ error: 'Video merge failed', details: err.message });
            });

    } catch (error) {
        console.error('[SnapshotController] merge error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
