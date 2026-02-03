const express = require("express");
const router = express.Router();
const { verifyToken } = require("../middleware/authMiddleware");
const { getProfile, updateProfile, uploadAvatar, getAvatar } = require("../controllers/profileController");
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Use the uploads directory created by app.js
const UPLOADS_DIR = path.resolve(__dirname, '..', '..', 'uploads');
const storage = multer.memoryStorage();

const upload = multer({
	storage,
	limits: { fileSize: 5 * 1024 * 1024 },
	fileFilter: (req, file, cb) => {
		// Log mimetype and original name for debugging
		try {
			console.log('[multer] incoming file:', { originalname: file.originalname, mimetype: file.mimetype, size: file.size });
		} catch (e) {
			console.warn('[multer] failed to log file info', e);
		}

		if (!file.mimetype || !file.mimetype.startsWith('image/')) {
			// Reject non-image types but include mimetype in message for debugging
			return cb(new Error(`Only image uploads are allowed; received: ${file.mimetype || 'unknown'}`));
		}
		cb(null, true);
	}
});

// Lấy thông tin hồ sơ người dùng hiện tại
router.get("/", verifyToken, getProfile);

// Cập nhật hồ sơ
router.put("/", verifyToken, updateProfile);

// Upload avatar (multipart/form-data) - field name: avatar
router.post('/avatar', verifyToken, upload.single('avatar'), uploadAvatar);

// Serve avatar binary from DB
router.get('/avatar/:id', getAvatar);

// Error handling for multer
router.use((err, req, res, next) => {
	if (err instanceof multer.MulterError) {
		console.error('[MulterError]', err);
		return res.status(400).json({ success: false, message: `Lỗi upload: ${err.message}` });
	} else if (err) {
		console.error('[UploadError]', err);
		return res.status(400).json({ success: false, message: err.message });
	}
	next();
});

router.post('/avatar-test', upload.single('avatar'), (req, res) => {
	try {
		if (!req.file || !req.file.buffer) return res.status(400).json({ success: false, message: 'No file received' });
		const dataUrl = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
		console.log('[avatar-test] received file', req.file.originalname, 'size=', req.file.size);
		return res.json({ success: true, message: 'Test upload ok', data: { originalname: req.file.originalname, size: req.file.size, dataUrl } });
	} catch (err) {
		console.error('[avatar-test] error', err);
		return res.status(500).json({ success: false, message: 'Server error' });
	}
});

module.exports = router;
