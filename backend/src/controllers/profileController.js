const { User } = require("../models/User");

// GET /api/profile/   - return current user's profile
const getProfile = async (req, res) => {
	try {
		const userId = req.user && req.user.id;
		if (!userId) return res.status(401).json({ message: "Unauthorized" });

		const user = await User.findByPk(userId, {
			attributes: [
				"id",
				"full_name",
				"email",
				"phone_number",
				"address",
				"avatar",
				"gender",
				"role",
				"created_at",
			],
		});

		if (!user) return res.status(404).json({ message: "User not found" });

		res.json({ success: true, data: user });
	} catch (err) {
		console.error("[getProfile]", err);
		res.status(500).json({ success: false, message: "Server error" });
	}
};

// PUT /api/profile/  - update profile fields
const updateProfile = async (req, res) => {
	try {
		const userId = req.user && req.user.id;
		if (!userId) return res.status(401).json({ message: "Unauthorized" });

		// Allow these fields to be updated from the frontend. Ignore email if present.
		const { full_name, phone_number, address, avatar, gender } = req.body;

		// Server-side validation: phone must be 10 digits if provided
		if (typeof phone_number !== 'undefined' && phone_number !== null && phone_number !== '') {
			if (!/^\d{10}$/.test(String(phone_number))) {
				return res.status(400).json({ success: false, message: 'Nhập sai định dạng số điện thoại' });
			}
		}

		// Validate gender value if provided
		const allowedGenders = ['male', 'female', 'other', null];
		if (typeof gender !== 'undefined' && gender !== null && gender !== '') {
			if (!allowedGenders.includes(gender)) {
				return res.status(400).json({ success: false, message: 'Giới tính không hợp lệ' });
			}
		}

		const user = await User.findByPk(userId);
		if (!user) return res.status(404).json({ message: "User not found" });

		// Update only provided fields
		if (typeof full_name !== "undefined") user.full_name = full_name;
		if (typeof phone_number !== "undefined") user.phone_number = phone_number;
		if (typeof address !== "undefined") user.address = address;
		if (typeof avatar !== "undefined") user.avatar = avatar;
		if (typeof gender !== "undefined") user.gender = gender;

		// Ensure email is not changed by profile update
		// (do not assign req.body.email anywhere)
		await user.save();

		res.json({ success: true, message: "Profile updated", data: user });
	} catch (err) {
		console.error("[updateProfile]", err);
		res.status(500).json({ success: false, message: "Server error" });
	}
};

// exports are declared at the end of the file
// Avatar upload handler
const uploadAvatar = async (req, res) => {
	try {
		const userId = req.user && req.user.id;
		if (!userId) return res.status(401).json({ message: 'Unauthorized' });
		// debug logging: ensure upload arrived
		console.log('[uploadAvatar] hit userId=', userId);

		if (!req.file || !req.file.buffer) {
			console.warn('[uploadAvatar] no file in request or buffer missing');
			return res.status(400).json({ success: false, message: 'No file uploaded' });
		}

		console.log('[uploadAvatar] file info:', {
			originalname: req.file.originalname,
			mimetype: req.file.mimetype,
			size: req.file.size,
		});

		const user = await User.findByPk(userId);
		if (!user) {
			console.warn('[uploadAvatar] user not found id=', userId);
			return res.status(404).json({ message: 'User not found' });
		}
		user.avatar_blob = req.file.buffer;
		user.avatar_mimetype = req.file.mimetype || 'application/octet-stream';

		// Add timestamp to bust browser cache when avatar changes
		user.avatar = `/api/profile/avatar/${userId}?t=${Date.now()}`;

		console.log('[uploadAvatar] saving user avatar to DB...');
		await user.save();

		console.log('[uploadAvatar] saved avatar blob for user', userId);

		res.json({ success: true, message: 'Avatar uploaded', data: { avatar: user.avatar } });
	} catch (err) {
		console.error('[uploadAvatar]', err && err.stack ? err.stack : err);
		res.status(500).json({ success: false, message: err.message || 'Server error' });
	}
};

// GET /api/profile/avatar/:id - stream avatar blob from DB
const getAvatar = async (req, res) => {
	try {
		const id = req.params.id;
		const user = await User.findByPk(id);
		if (!user || !user.avatar_blob) return res.status(404).send('Not found');

		const mime = user.avatar_mimetype || 'application/octet-stream';
		res.set('Content-Type', mime);
		// Disable caching to ensure fresh load
		res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');

		console.log(`[getAvatar] serving avatar for user ${id}, size: ${user.avatar_blob ? user.avatar_blob.length : 0} bytes`);
		res.send(user.avatar_blob);
	} catch (err) {
		console.error('[getAvatar]', err);
		res.status(500).send('Server error');
	}
};

module.exports = { getProfile, updateProfile, uploadAvatar, getAvatar };
