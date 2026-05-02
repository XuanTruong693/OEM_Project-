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

/**
 * Ghép các frame ảnh thành video MP4
 * @param {string} submissionId 
 * @param {string} violation_id (Tùy chọn) - Nếu có thì chỉ lấy frame của vi phạm đó
 */
exports.mergeToVideo = async (req, res) => {
    try {
        const { submissionId } = req.params;
        const { violation_id: rawViolationId } = req.body; // Nếu undefined -> ghép toàn bộ frame của submission
        const violation_id = rawViolationId != null ? String(rawViolationId) : null;

        const submissionDir = path.join(SNAPSHOTS_DIR, String(submissionId));
        let framesDir = submissionDir;
        
        const outputFileName = violation_id 
            ? `submission_${submissionId}_violation_${violation_id}.mp4`
            : `submission_${submissionId}_full.mp4`;
        const outputPath = path.normalize(path.join(VIDEOS_DIR, outputFileName));
        const tempOutputPath = path.join(VIDEOS_DIR, `temp_${outputFileName}`);

        console.log(`[SnapshotController] 🔍 Checking existence of: ${outputPath}`);

        // Kiểm tra đã ghép chưa
        if (fs.existsSync(outputPath)) {
            console.log(`[SnapshotController] ✅ Video already exists at: ${outputPath}`);
            return res.status(200).json({
                success: true,
                message: 'Video already exists',
                video_url: `/api/uploads/videos/${outputFileName}`
            });
        }

        console.log(`[SnapshotController] ⌛ Video NO found. Checking frames at: ${framesDir}`);

        if (violation_id) {
            framesDir = path.join(submissionDir, violation_id);
        }

        if (!fs.existsSync(framesDir)) {
            console.error(`[SnapshotController] ❌ Target frames directory NOT found for merge: ${framesDir}`);
            if (violation_id && fs.existsSync(submissionDir)) {
                console.warn(`[SnapshotController] ⚠️ Falling back to main submission directory for ID: ${submissionId}`);
                framesDir = submissionDir;
            } else {
                return res.status(404).json({
                    error: 'No snapshots found for this target',
                    path: framesDir,
                    hint: 'Ensure that snapshots were uploaded before merging'
                });
            }
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
            const srcPath = path.join(framesDir, file);
            const destPath = path.join(tempDir, `frm_${String(index + 1).padStart(4, '0')}.webp`);
            fs.copyFileSync(srcPath, destPath);
        });

        const filePattern = path.join(tempDir, 'frm_%04d.webp');

        // Construct FFmpeg command
        await new Promise((resolve, reject) => {
            ffmpeg()
                .input(filePattern)
                .inputFPS(3) // 3 frames per second as requested
                .outputOptions([
                    '-c:v libx264',
                    '-profile:v baseline',
                    '-level 3.0',
                    '-vf', 'scale=-2:720', // Force 720p height, proportional width (must be even)
                    '-pix_fmt yuv420p',
                    '-movflags +faststart',
                    '-preset superfast',
                    '-crf 24' // Slightly better quality for 720p
                ])
                .on('end', () => {
                    // Rename temp file to official file name after completion
                    if (fs.existsSync(tempOutputPath)) {
                        fs.renameSync(tempOutputPath, outputPath);
                    }
                    // Cleanup temp frames
                    fs.rmSync(tempDir, { recursive: true, force: true });
                    console.log(`✅ [SnapshotController] Merge completed: ${outputFileName}`);
                    resolve();
                })
                .on('error', (err) => {
                    console.error(`❌ [SnapshotController] Merge error:`, err.message);
                    if (fs.existsSync(tempOutputPath)) fs.unlinkSync(tempOutputPath);
                    if (fs.existsSync(tempDir)) fs.rmSync(tempDir, { recursive: true, force: true });
                    reject(err);
                })
                .save(tempOutputPath);
        });

        return res.status(200).json({
            success: true,
            message: 'Merging completed',
            video_url: `/api/uploads/videos/${outputFileName}`
        });

    } catch (error) {
        console.error('[SnapshotController] merge error:', error);
        res.status(500).json({ error: 'Internal server error', details: error.message });
    }
};

/**
 * Xóa bằng chứng (cả frame và video liên quan)
 */
exports.deleteEvidence = async (req, res) => {
    try {
        const { submissionId, violationId } = req.params;
        const framesDir = path.join(SNAPSHOTS_DIR, String(submissionId), String(violationId));
        const videoPath = path.join(VIDEOS_DIR, `submission_${submissionId}_violation_${violationId}.mp4`);

        if (fs.existsSync(framesDir)) fs.rmSync(framesDir, { recursive: true, force: true });
        if (fs.existsSync(videoPath)) fs.unlinkSync(videoPath);

        res.json({ message: 'Evidence deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: 'Delete failed', details: error.message });
    }
};

exports.uploadSnapshots = async (req, res) => {
    try {
        const { submissionId } = req.params;
        const { violation_id } = req.body;
        
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ error: 'No files uploaded' });
        }

        const targetDir = violation_id 
            ? path.join(SNAPSHOTS_DIR, String(submissionId), String(violation_id))
            : path.join(SNAPSHOTS_DIR, String(submissionId));

        if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });

        // Multer đã lưu vào temp, giờ move vào targetDir
        req.files.forEach((file, index) => {
            const fileName = `frame_${Date.now()}_${index}.webp`;
            fs.renameSync(file.path, path.join(targetDir, fileName));
        });

        res.json({ message: 'Snapshots uploaded successfully', count: req.files.length });
    } catch (error) {
        res.status(500).json({ error: 'Upload failed', details: error.message });
    }
};
