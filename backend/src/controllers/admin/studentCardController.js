/**
 * 1. Lấy danh sách thẻ sinh viên (Pagination & Search)
 * Endpoint: GET /api/admin/student-cards
 */
exports.getStudentCards = async (req, res) => {
    // TODO: Triển khai logic lấy danh sách thẻ sinh viên từ bảng student_cards
    // Nhớ hỗ trợ query params: ?page=1&limit=20&search=keyword
    res.status(501).json({ success: false, message: "Chưa triển khai logic" });
};

/**
 * 2. Lấy chi tiết thẻ sinh viên
 * Endpoint: GET /api/admin/student-cards/:id
 */
exports.getStudentCardById = async (req, res) => {
    // TODO: Lấy chi tiết 1 SV (kèm biến đổi card_image_blob thành base64)
    res.status(501).json({ success: false, message: "Chưa triển khai logic" });
};

/**
 * 3. Upload thẻ thủ công từng SV (Thêm mới)
 * Endpoint: POST /api/admin/student-cards
 * Yêu cầu: Check trùng MSSV
 */
exports.createStudentCard = async (req, res) => {
    // TODO: Nhận form-data gồm student_code, student_name, card_image (file)
    res.status(501).json({ success: false, message: "Chưa triển khai logic" });
};

/**
 * 4. Sửa thẻ sinh viên
 * Endpoint: PUT /api/admin/student-cards/:id
 */
exports.updateStudentCard = async (req, res) => {
    // TODO: Nhận form-data -> Cập nhật tên, mã, (Và ảnh nếu có upload file mới)
    res.status(501).json({ success: false, message: "Chưa triển khai logic" });
};

/**
 * 5. Xóa thẻ sinh viên
 * Endpoint: DELETE /api/admin/student-cards/:id
 */
exports.deleteStudentCard = async (req, res) => {
    // TODO: Xoá record trong bảng student_cards theo ID
    res.status(501).json({ success: false, message: "Chưa triển khai logic" });
};

/**
 * 6. Batch Upload từ Excel
 * Endpoint: POST /api/admin/student-cards/batch
 */
exports.batchUploadStudentCards = async (req, res) => {
    // TODO: 
    // - Nhận chuỗi JSON `students_data` và mảng file `card_images[]` từ form-data
    // - Loop qua students_data: parse JSON -> match tên `file_name` với file ảnh tương ứng.
    // - Insert vào DB (update nếu đã tồn tại mssv)
    res.status(501).json({ success: false, message: "Chưa triển khai logic" });
};
