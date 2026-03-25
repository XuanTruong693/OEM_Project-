const StudentCard = require('../../models/StudentCard');
const { Op } = require('sequelize');
const sequelize = require('../../config/db');
const exceljs = require('exceljs');

// Regex: chỉ cho phép chữ cái (bao gồm Unicode / tiếng Việt) và khoảng trắng
const VALID_NAME_REGEX = /^[\p{L}\s]+$/u;
const isValidStudentName = (name) => VALID_NAME_REGEX.test(name);

/**
 * 1. GET /api/admin/student-cards
 * Lấy danh sách thẻ SV (phân trang + tìm kiếm)
 * KHÔNG trả về card_image để tránh làm nặng response
 */
exports.getStudentCards = async (req, res) => {
    try {
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.max(1, parseInt(req.query.limit) || 20);
        const search = (req.query.search || '').trim();
        const offset = (page - 1) * limit;

        const where = {};
        if (search) {
            where[Op.or] = [
                { student_name: { [Op.like]: `%${search}%` } },
                { student_code: { [Op.like]: `%${search}%` } },
            ];
        }

        const { count, rows } = await StudentCard.findAndCountAll({
            where,
            attributes: { exclude: ['card_image'] }, // ⚠️ Không tải blob ảnh
            order: [['created_at', 'DESC']],
            limit,
            offset,
        });

        return res.json({
            success: true,
            data: rows,
            totalItems: count,
            totalPages: Math.ceil(count / limit),
            currentPage: page,
        });
    } catch (err) {
        console.error('❌ [getStudentCards]', err);
        return res.status(500).json({ success: false, message: 'Lỗi server khi lấy danh sách thẻ SV.' });
    }
};

/**
 * 2. GET /api/admin/student-cards/:id
 * Lấy chi tiết 1 thẻ (kèm ảnh Base64)
 */
exports.getStudentCardById = async (req, res) => {
    try {
        const card = await StudentCard.findByPk(req.params.id);
        if (!card) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy thẻ sinh viên.' });
        }

        const cardData = card.toJSON();

        // Chuyển blob → base64 data URL
        if (cardData.card_image) {
            const base64 = Buffer.from(cardData.card_image).toString('base64');
            cardData.card_image_base64 = `data:image/jpeg;base64,${base64}`;
        } else {
            cardData.card_image_base64 = null;
        }
        delete cardData.card_image; // Không trả blob thô về FE

        return res.json({ success: true, data: cardData });
    } catch (err) {
        console.error('❌ [getStudentCardById]', err);
        return res.status(500).json({ success: false, message: 'Lỗi server khi lấy chi tiết thẻ SV.' });
    }
};

/**
 * 3. POST /api/admin/student-cards
 * Thêm mới 1 thẻ (upload thủ công)
 */
exports.createStudentCard = async (req, res) => {
    try {
        const { student_code, student_name } = req.body;

        // Validate
        if (!student_code || !student_name) {
            return res.status(400).json({ success: false, message: 'Thiếu MSSV hoặc Tên sinh viên.' });
        }

        if (!isValidStudentName(student_name.trim())) {
            return res.status(400).json({ success: false, message: 'Tên sinh viên chỉ được chứa chữ cái và khoảng trắng (không có số hoặc ký tự đặc biệt).' });
        }

        const imageFile = req.files && req.files['card_image'] && req.files['card_image'][0];
        // Ảnh thẻ không còn bắt buộc khi tạo mới

        // Check trùng MSSV
        const existing = await StudentCard.findOne({ where: { student_code: student_code.trim() } });
        if (existing) {
            return res.status(400).json({
                success: false,
                message: `MSSV "${student_code}" đã tồn tại trong hệ thống.`
            });
        }

        await StudentCard.create({
            student_code: student_code.trim(),
            student_name: student_name.trim(),
            card_image: imageFile ? imageFile.buffer : null,
        });

        return res.status(201).json({ success: true, message: 'Thêm thẻ sinh viên thành công!' });
    } catch (err) {
        console.error('❌ [createStudentCard]', err);
        return res.status(500).json({ success: false, message: 'Lỗi server khi thêm thẻ SV.' });
    }
};

/**
 * 4. PUT /api/admin/student-cards/:id
 * Cập nhật thông tin / ảnh thẻ
 */
exports.updateStudentCard = async (req, res) => {
    try {
        const card = await StudentCard.findByPk(req.params.id);
        if (!card) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy thẻ sinh viên.' });
        }

        const { student_code, student_name } = req.body;
        const updateData = {};

        // Cập nhật student_code nếu gửi lên và khác hiện tại
        if (student_code && student_code.trim() !== card.student_code) {
            // Check trùng với record KHÁC
            const conflict = await StudentCard.findOne({
                where: {
                    student_code: student_code.trim(),
                    id: { [Op.ne]: card.id }
                }
            });
            if (conflict) {
                return res.status(400).json({
                    success: false,
                    message: `MSSV "${student_code}" đã được dùng bởi sinh viên khác.`
                });
            }
            updateData.student_code = student_code.trim();
        }

        if (student_name && student_name.trim()) {
            if (!isValidStudentName(student_name.trim())) {
                return res.status(400).json({ success: false, message: 'Tên sinh viên chỉ được chứa chữ cái và khoảng trắng (không có số hoặc ký tự đặc biệt).' });
            }
            updateData.student_name = student_name.trim();
        }

        // Nếu có file ảnh mới → ghi đè, không có → giữ nguyên ảnh cũ
        const imageFile = req.files && req.files['card_image'] && req.files['card_image'][0];
        if (imageFile) {
            updateData.card_image = imageFile.buffer;
        }

        await card.update(updateData); // updated_at tự động cập nhật bởi Sequelize

        return res.json({ success: true, message: 'Cập nhật thẻ sinh viên thành công!' });
    } catch (err) {
        console.error('❌ [updateStudentCard]', err);
        return res.status(500).json({ success: false, message: 'Lỗi server khi cập nhật thẻ SV.' });
    }
};

/**
 * 5. DELETE /api/admin/student-cards/:id
 * Xóa vĩnh viễn thẻ sinh viên
 */
exports.deleteStudentCard = async (req, res) => {
    try {
        const card = await StudentCard.findByPk(req.params.id);
        if (!card) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy thẻ sinh viên.' });
        }

        const { student_name, student_code } = card;
        await card.destroy();

        return res.json({
            success: true,
            message: `Đã xóa thẻ sinh viên ${student_name} (${student_code}) thành công.`
        });
    } catch (err) {
        console.error('❌ [deleteStudentCard]', err);
        return res.status(500).json({ success: false, message: 'Lỗi server khi xóa thẻ SV.' });
    }
};

/**
 * 6. POST /api/admin/student-cards/batch
 * Upload hàng loạt từ Excel + Ảnh
 */
exports.batchUploadStudentCards = async (req, res) => {
    try {
        const file = req.files && req.files.length > 0 ? req.files[0] : null;
        if (!file) {
            return res.status(400).json({ success: false, message: 'Vui lòng upload file Excel.' });
        }

        const workbook = new exceljs.Workbook();
        await workbook.xlsx.load(file.buffer);
        const worksheet = workbook.worksheets[0];

        const successList = [];
        const errorList = [];

        // Trích xuất hình ảnh
        const rowImages = {};
        for (const image of worksheet.getImages()) {
            const imgId = image.imageId;
            const imgRef = workbook.model.media.find(m => m.index === imgId);
            if (imgRef) {
                const anchor = image.range.tl;
                const naiveRow = anchor.nativeRow + 1; // 1-based index
                rowImages[naiveRow] = imgRef.buffer;
            }
        }

        let totalProcessed = 0;

        for (let i = 2; i <= worksheet.rowCount; i++) { // Bỏ qua header
            const row = worksheet.getRow(i);
            const mssvVal = row.getCell(1).value;
            const tenVal = row.getCell(2).value;

            if (!mssvVal && !tenVal) continue; // Bỏ qua dòng trống hoàn toàn

            const mssv = String(mssvVal || '').trim();
            const ten = String(tenVal || '').trim();

            totalProcessed++;

            if (!mssv || !ten) {
                errorList.push({ mssv, ten, ly_do: 'Thiếu MSSV hoặc Tên trong Excel.' });
                continue;
            }

            if (!isValidStudentName(ten)) {
                errorList.push({ mssv, ten, ly_do: 'Tên SV chỉ được chứa chữ cái và khoảng trắng (không có số/ký tự đặc biệt).' });
                continue;
            }

            // Validate MSSV === 11 ký tự
            if (mssv.length !== 11) {
                errorList.push({ mssv, ten, ly_do: 'MSSV không hợp lệ (phải nhập đúng 11 ký tự số/chữ).' });
                continue;
            }

            const imageBuffer = rowImages[i] || null;

            try {
                const [record, created] = await StudentCard.findOrCreate({
                    where: { student_code: mssv },
                    defaults: {
                        student_code: mssv,
                        student_name: ten,
                        card_image: imageBuffer,
                    },
                });

                if (!created) {
                    const updateData = { student_name: ten };
                    // Chỉ ghi đè ảnh nếu file Excel có ảnh mới
                    if (imageBuffer) {
                        updateData.card_image = imageBuffer;
                    }
                    await record.update(updateData);
                }

                successList.push({
                    mssv, ten,
                    action: created ? 'đã thêm' : 'đã cập nhật',
                    hasImage: !!imageBuffer,
                });
            } catch (innerErr) {
                console.error(`❌ [batch] Lỗi xử lý SV ${mssv}:`, innerErr.message);
                errorList.push({ mssv, ten, ly_do: `Lỗi DB: ${innerErr.message}` });
            }
        }

        return res.json({
            success: true,
            total: totalProcessed,
            successCount: successList.length,
            errorCount: errorList.length,
            successList,
            errorList,
        });

    } catch (err) {
        console.error('❌ [batchUploadStudentCards]', err);
        return res.status(500).json({ success: false, message: 'Lỗi server khi upload file Excel: ' + err.message });
    }
};

/**
 * 7. GET /api/admin/student-cards/no-image
 * Lấy danh sách SV chưa có ảnh thẻ (card_image IS NULL)
 */
exports.getStudentCardsWithoutImage = async (req, res) => {
    try {
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.max(1, parseInt(req.query.limit) || 20);
        const search = (req.query.search || '').trim();
        const offset = (page - 1) * limit;

        const where = { card_image: null };
        if (search) {
            where[Op.or] = [
                { student_name: { [Op.like]: `%${search}%` } },
                { student_code: { [Op.like]: `%${search}%` } },
            ];
        }

        const { count, rows } = await StudentCard.findAndCountAll({
            where,
            attributes: ['id', 'student_code', 'student_name', 'created_at', 'updated_at'],
            order: [['created_at', 'DESC']],
            limit,
            offset,
        });

        return res.json({
            success: true,
            data: rows,
            totalItems: count,
            totalPages: Math.ceil(count / limit),
            currentPage: page,
        });
    } catch (err) {
        console.error('❌ [getStudentCardsWithoutImage]', err);
        return res.status(500).json({ success: false, message: 'Lỗi server khi lấy danh sách SV chưa có ảnh.' });
    }
};

/**
 * 8. POST /api/admin/student-cards/batch-update-images
 * Cập nhật ảnh hàng loạt cho các SV đã có trong DB
 * Body: multipart/form-data với các file có field name = student_code
 */
exports.batchUpdateCardImages = async (req, res) => {
    try {
        const files = req.files;
        if (!files || files.length === 0) {
            return res.status(400).json({ success: false, message: 'Không có file ảnh nào được gửi lên.' });
        }

        const successList = [];
        const errorList = [];

        for (const file of files) {
            const studentCode = file.fieldname; // field name = student_code
            try {
                const card = await StudentCard.findOne({ where: { student_code: studentCode } });
                if (!card) {
                    errorList.push({ student_code: studentCode, ly_do: 'Không tìm thấy SV với MSSV này.' });
                    continue;
                }

                await card.update({ card_image: file.buffer });
                successList.push({
                    student_code: studentCode,
                    student_name: card.student_name,
                    action: 'đã cập nhật ảnh',
                });
            } catch (innerErr) {
                console.error(`❌ [batchUpdateImages] Lỗi SV ${studentCode}:`, innerErr.message);
                errorList.push({ student_code: studentCode, ly_do: `Lỗi DB: ${innerErr.message}` });
            }
        }

        return res.json({
            success: true,
            total: files.length,
            successCount: successList.length,
            errorCount: errorList.length,
            successList,
            errorList,
        });
    } catch (err) {
        console.error('❌ [batchUpdateCardImages]', err);
        return res.status(500).json({ success: false, message: 'Lỗi server khi cập nhật ảnh hàng loạt.' });
    }
};
