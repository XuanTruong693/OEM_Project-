const sequelize = require("../../config/db");
const fs = require("fs");
const path = require("path");

// Import hasColumn helper from RoomController
const { hasColumn } = require("./RoomController");

// Local Helper Functions
async function hasCol(table, col) {
    const [rows] = await sequelize.query(
        `SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ? LIMIT 1`,
        { replacements: [table, col] }
    );
    return Array.isArray(rows) && rows.length > 0;
}

function ensureBuffer(blob) {
    if (Buffer.isBuffer(blob)) return blob;
    if (typeof blob === "string") return Buffer.from(blob, "binary");
    if (typeof blob === "object") return Buffer.from(blob);
    return null;
}

// Controller Methods

async function uploadImages(req, res) {
    try {
        const submissionId = req.params.id;
        const userId = req.user.id;

        const [subRows] = await sequelize.query(
            `SELECT id FROM submissions WHERE id = ? AND user_id = ? LIMIT 1`,
            { replacements: [submissionId, userId] }
        );
        if (!Array.isArray(subRows) || subRows.length === 0) {
            return res.status(404).json({ message: "Submission not found" });
        }

        const faceFile =
            req.files && req.files["face_image"] && req.files["face_image"][0];
        const cardFile =
            req.files &&
            req.files["student_card_image"] &&
            req.files["student_card_image"][0];

        const response = { ok: true };

        try {
            if (faceFile) {
                const hasBlob = await hasCol("submissions", "face_image_blob");
                const hasMime = await hasCol("submissions", "face_image_mimetype");
                if (hasBlob && hasMime) {
                    await sequelize.query(
                        `UPDATE submissions SET face_image_blob = ?, face_image_mimetype = ? WHERE id = ?`,
                        {
                            replacements: [
                                faceFile.buffer,
                                faceFile.mimetype || null,
                                submissionId,
                            ],
                        }
                    );
                    response.face_uploaded = true;
                    response.face_preview = `data:${faceFile.mimetype
                        };base64,${faceFile.buffer.toString("base64")}`;
                }
            }

            if (cardFile) {
                const hasBlob = await hasCol("submissions", "student_card_blob");
                const hasMime = await hasCol("submissions", "student_card_mimetype");
                if (hasBlob && hasMime) {
                    await sequelize.query(
                        `UPDATE submissions SET student_card_blob = ?, student_card_mimetype = ? WHERE id = ?`,
                        {
                            replacements: [
                                cardFile.buffer,
                                cardFile.mimetype || null,
                                submissionId,
                            ],
                        }
                    );
                    response.card_uploaded = true;
                    response.card_preview = `data:${cardFile.mimetype
                        };base64,${cardFile.buffer.toString("base64")}`;
                }
            }
        } catch (persistErr) {
            console.error("[uploadImages] persist error:", persistErr);
            return res.status(500).json({ message: "Failed to save images" });
        }

        return res.json(response);
    } catch (err) {
        console.error("uploadImages error:", err);
        return res.status(500).json({ message: "Server error" });
    }
}

/**
 * POST /api/submissions/:id/verify-card (auth)
 * Verify uploaded student card image
 */
async function verifyStudentCardImage(req, res) {
    try {
        const submissionId = req.params.id;
        const userId = req.user.id;

        // Lấy ảnh thẻ SV từ database
        const [subRows] = await sequelize.query(
            `SELECT student_card_blob, student_card_mimetype FROM submissions WHERE id = ? AND user_id = ? LIMIT 1`,
            { replacements: [submissionId, userId] }
        );

        if (!Array.isArray(subRows) || subRows.length === 0) {
            return res.status(404).json({ message: "Submission not found" });
        }

        let cardBlob = subRows[0].student_card_blob;
        if (!cardBlob) {
            return res.status(400).json({ message: "Chưa upload ảnh thẻ sinh viên" });
        }

        // Đảm bảo cardBlob là Buffer
        cardBlob = ensureBuffer(cardBlob);
        if (!cardBlob) {
            return res
                .status(400)
                .json({ message: "Ảnh thẻ sinh viên không hợp lệ" });
        }

        // Gọi Python verify
        const { verifyStudentCard } = require("../../services/verificationService");

        console.log(
            `[Verify Card] 🚀 Bắt đầu xác minh thẻ SV cho submission ${submissionId}`
        );
        console.log(`[Verify Card] 📊 Kích thước blob: ${cardBlob.length} bytes`);

        const result = await verifyStudentCard(cardBlob);

        console.log(
            `[Verify Card] 📝 Kết quả từ Python:`,
            JSON.stringify(result, null, 2)
        );

        if (!result.valid) {
            const reasons = result.details?.reasons?.join("\n") || "Không rõ lý do";
            const fieldsMatched = result.details?.fields_matched || [];
            const mssv = result.details?.mssv || "không tìm thấy";

            console.log(`[Verify Card] ❌ Thẻ SV không hợp lệ: ${reasons}`);
            return res.status(400).json({
                ok: false,
                valid: false,
                message: `❌ Thẻ sinh viên không hợp lệ!\n\nCác trường đã tìm thấy: ${fieldsMatched.join(", ") || "không có"
                    }\nMSSV tìm thấy: ${mssv}\n\nLý do:\n${reasons}\n\n⚠️ Vui lòng upload lại ảnh thẻ SV rõ nét hơn!`,
                details: result.details,
            });
        }

        // ✅ Xác minh thành công
        console.log(
            `[Verify Card] ✅ Thẻ SV hợp lệ (MSSV: ${result.details?.mssv})`
        );
        return res.json({
            ok: true,
            valid: true,
            message: "✅ Thẻ SV hợp lệ!",
            details: result.details,
        });
    } catch (err) {
        console.error("[Verify Card] ❌ Lỗi chi tiết:", {
            message: err.message,
            stack: err.stack,
            name: err.name,
            code: err.code,
        });

        // Provide actionable error messages
        let userMessage = "Lỗi xác minh thẻ SV";
        if (
            err.message.includes("numpy.dtype") ||
            err.message.includes("binary incompatibility")
        ) {
            userMessage =
                "🔧 Lỗi Python Environment: numpy/pandas không tương thích. Vui lòng chạy: python scripts/fix_python_env.py";
        } else if (err.message.includes("Missing Dependencies")) {
            userMessage = "🔧 " + err.message;
        } else if (err.message.includes("Failed to write to Python stdin")) {
            userMessage =
                "🔧 Lỗi Python Process: Python không khởi động được. Vui lòng kiểm tra môi trường Python.";
        }

        return res.status(500).json({
            message: userMessage,
            error: err.message,
            details: err.stack,
        });
    }
}

/**
 * POST /api/submissions/:id/verify-face (auth)
 * Verify uploaded face image (liveness check)
 */
async function verifyFaceImage(req, res) {
    try {
        const submissionId = req.params.id;
        const userId = req.user.id;

        // Lấy ảnh khuôn mặt từ database
        const [subRows] = await sequelize.query(
            `SELECT face_image_blob, face_image_mimetype FROM submissions WHERE id = ? AND user_id = ? LIMIT 1`,
            { replacements: [submissionId, userId] }
        );

        if (!Array.isArray(subRows) || subRows.length === 0) {
            return res.status(404).json({ message: "Submission not found" });
        }

        let faceBlob = subRows[0].face_image_blob;
        if (!faceBlob) {
            return res.status(400).json({ message: "Chưa upload ảnh khuôn mặt" });
        }

        // Đảm bảo faceBlob là Buffer
        faceBlob = ensureBuffer(faceBlob);
        if (!faceBlob) {
            return res.status(400).json({ message: "Ảnh khuôn mặt không hợp lệ" });
        }

        // Gọi Python verify
        const { verifyFaceLiveness } = require("../../services/verificationService");

        console.log(
            `[Verify Face] Bắt đầu kiểm tra liveness cho submission ${submissionId}`
        );
        const livenessResult = await verifyFaceLiveness(faceBlob);

        if (!livenessResult.is_live) {
            const reasons = livenessResult.reasons?.join("\n") || "Không rõ lý do";
            const confidence = livenessResult.confidence || 0;
            console.log(`[Verify Face] ❌ Liveness check failed: ${reasons}`);
            return res.status(400).json({
                ok: false,
                valid: false,
                message: `❌ Ảnh khuôn mặt không hợp lệ!\n\nĐộ tin cậy: ${confidence}%\n\nLý do:\n${reasons}\n\n⚠️ Vui lòng chụp lại ảnh khuôn mặt!`,
                liveness: livenessResult,
            });
        }

        // ✅ Xác minh thành công
        console.log(
            `[Verify Face] ✅ Liveness check passed (${livenessResult.confidence}%)`
        );
        return res.json({
            ok: true,
            valid: true,
            message: `✅ Khuôn mặt hợp lệ! (Độ tin cậy: ${livenessResult.confidence}%)`,
            liveness: livenessResult,
        });
    } catch (err) {
        console.error("verifyFaceImage error:", err);
        return res
            .status(500)
            .json({ message: "Lỗi xác minh khuôn mặt", error: err.message });
    }
}

/**
 * POST /api/submissions/:id/compare-faces (auth)
 * Compare face image with student card image
 */
async function compareFaceImages(req, res) {
    try {
        const submissionId = req.params.id;
        const userId = req.user.id;

        // Lấy cả 2 ảnh từ database
        const [subRows] = await sequelize.query(
            `SELECT face_image_blob, student_card_blob
       FROM submissions WHERE id = ? AND user_id = ? LIMIT 1`,
            { replacements: [submissionId, userId] }
        );

        if (!Array.isArray(subRows) || subRows.length === 0) {
            return res.status(404).json({ message: "Submission not found" });
        }

        let { face_image_blob, student_card_blob } = subRows[0];

        if (!face_image_blob) {
            return res.status(400).json({ message: "Chưa upload ảnh khuôn mặt" });
        }
        if (!student_card_blob) {
            return res.status(400).json({ message: "Chưa upload ảnh thẻ sinh viên" });
        }

        // Đảm bảo cả 2 blobs là Buffers
        face_image_blob = ensureBuffer(face_image_blob);
        student_card_blob = ensureBuffer(student_card_blob);

        if (!face_image_blob) {
            return res.status(400).json({ message: "Ảnh khuôn mặt không hợp lệ" });
        }
        if (!student_card_blob) {
            return res.status(400).json({ message: "Ảnh thẻ sinh viên không hợp lệ" });
        }

        // Gọi Python compare
        const { compareFaces } = require("../../services/verificationService");
        const tolerance = req.body.tolerance || 0.35;

        console.log(
            `[Compare Faces] Bắt đầu so sánh khuôn mặt cho submission ${submissionId} với tolerance ${tolerance}`
        );
        const matchResult = await compareFaces(
            face_image_blob,
            student_card_blob,
            tolerance
        );

        if (matchResult.error) {
            console.log(`[Compare Faces] ❌ Lỗi: ${matchResult.error}`);
            return res.status(400).json({
                ok: false,
                match: false,
                message: matchResult.error,
                details: matchResult,
            });
        }

        // Tính confidence từ distance
        const confidence =
            matchResult.confidence || (1 - (matchResult.distance || 1)) * 100;
        const threshold = 50;
        const isMatch = confidence >= threshold;

        console.log(
            `[Compare Faces] Confidence: ${confidence.toFixed(
                1
            )}%, Threshold: ${threshold}%, Match: ${isMatch}`
        );

        if (!isMatch) {
            return res.status(400).json({
                ok: false,
                match: false,
                confidence: confidence,
                distance: matchResult.distance,
                threshold: threshold,
                message: `Khuôn mặt không khớp (độ tương đồng: ${confidence.toFixed(
                    1
                )}%, yêu cầu ≥${threshold}%)`,
                details: matchResult,
            });
        }

        try {
            console.log(`[Compare Faces] 💾 Cập nhật ảnh đã xác minh vào DB...`);
            await sequelize.query(
                `UPDATE submissions 
         SET face_image_blob = ?, student_card_blob = ?
         WHERE id = ? AND user_id = ?`,
                {
                    replacements: [
                        face_image_blob,
                        student_card_blob,
                        submissionId,
                        userId,
                    ],
                }
            );
            console.log(`[Compare Faces] ✅ Đã cập nhật ảnh đã xác minh vào DB`);
        } catch (saveErr) {
            console.error(`[Compare Faces] ⚠️ Lỗi lưu DB:`, saveErr);
            return res.status(500).json({
                ok: false,
                match: false,
                message: "Lỗi lưu ảnh đã xác minh vào database",
                error: saveErr.message,
            });
        }

        console.log(
            `[Compare Faces] ✅ Khuôn mặt khớp (${confidence.toFixed(1)}%)`
        );
        return res.json({
            ok: true,
            match: true,
            confidence: confidence,
            distance: matchResult.distance,
            threshold: threshold,
            message: `Xác minh thành công! Độ tương đồng: ${confidence.toFixed(1)}%`,
            details: matchResult,
        });
    } catch (err) {
        console.error("compareFaceImages error:", err);
        return res
            .status(500)
            .json({ message: "Lỗi so sánh khuôn mặt", error: err.message });
    }
}

/**
 * POST /api/submissions/:id/upload-verified-images (auth)
 * Upload final verified images
 */
async function uploadVerifiedImages(req, res) {
    try {
        const submissionId = req.params.id;
        const userId = req.user.id;

        // Kiểm tra submission tồn tại
        const [subRows] = await sequelize.query(
            `SELECT id FROM submissions WHERE id = ? AND user_id = ? LIMIT 1`,
            { replacements: [submissionId, userId] }
        );
        if (!Array.isArray(subRows) || subRows.length === 0) {
            return res.status(404).json({ message: "Submission not found" });
        }

        const verifiedFace =
            req.files && req.files["verified_face"] && req.files["verified_face"][0];
        const verifiedCard =
            req.files && req.files["verified_card"] && req.files["verified_card"][0];

        if (!verifiedFace && !verifiedCard) {
            return res.status(400).json({ message: "Không có ảnh nào được tải lên" });
        }

        console.log(
            `[Upload Verified] submission ${submissionId}: face=${!!verifiedFace}, card=${!!verifiedCard}`
        );

        // Save to DB
        try {
            if (verifiedFace) {
                await sequelize.query(
                    `UPDATE submissions SET face_image_blob = ?, face_image_mimetype = ? WHERE id = ?`,
                    {
                        replacements: [
                            verifiedFace.buffer,
                            verifiedFace.mimetype || "image/jpeg",
                            submissionId,
                        ],
                    }
                );
            }
            if (verifiedCard) {
                await sequelize.query(
                    `UPDATE submissions SET student_card_blob = ?, student_card_mimetype = ? WHERE id = ?`,
                    {
                        replacements: [
                            verifiedCard.buffer,
                            verifiedCard.mimetype || "image/jpeg",
                            submissionId,
                        ],
                    }
                );
            }
            console.log(`[Upload Verified] ✅ Saved verified images to DB for submission ${submissionId}`);
        } catch (saveErr) {
            console.error("[Upload Verified] ❌ Failed to save images:", saveErr);
            return res.status(500).json({ message: "Failed to save verified images to DB" });
        }

        return res.json({
            ok: true,
            message: "Đã tải lên ảnh đã xác minh thành công",
            uploaded: {
                face: !!verifiedFace,
                card: !!verifiedCard,
            },
        });
    } catch (err) {
        console.error("uploadVerifiedImages error:", err);
        return res
            .status(500)
            .json({ message: "Lỗi tải ảnh đã xác minh", error: err.message });
    }
}

/**
 * POST /api/submissions/:id/verify (auth, multipart)
 * Legacy endpoint - full verification flow (backward compatibility)
 */
async function uploadVerifyAssets(req, res) {
    try {
        const submissionId = req.params.id;
        const userId = req.user.id;

        const [subRows] = await sequelize.query(
            `SELECT id FROM submissions WHERE id = ? AND user_id = ? LIMIT 1`,
            { replacements: [submissionId, userId] }
        );
        if (!Array.isArray(subRows) || subRows.length === 0) {
            return res.status(404).json({ message: "Submission not found" });
        }

        const faceFile =
            req.files && req.files["face_image"] && req.files["face_image"][0];
        const cardFile =
            req.files &&
            req.files["student_card_image"] &&
            req.files["student_card_image"][0];
        const faceUploaded = !!faceFile;
        const cardUploaded = !!cardFile;

        // Import verification service
        const {
            verifyFaceLiveness,
            verifyStudentCard,
            compareFaces,
        } = require("../../services/verificationService");

        let faceVerified = false;
        let cardVerified = false;
        let verificationErrors = [];
        let verificationDetails = {};

        // ========== BƯỚC 1: Xác minh khuôn mặt selfie (liveness) ==========
        if (faceUploaded) {
            try {
                console.log(
                    `[Verify] Bước 1: Kiểm tra liveness cho submission ${submissionId}`
                );
                const livenessResult = await verifyFaceLiveness(faceFile.buffer);

                if (livenessResult.error) {
                    verificationErrors.push(
                        `Lỗi xác minh khuôn mặt: ${livenessResult.error}`
                    );
                    verificationDetails.face_liveness = { error: livenessResult.error };
                } else if (!livenessResult.is_live) {
                    const reasons =
                        livenessResult.reasons?.join(", ") || "Không rõ lý do";
                    verificationErrors.push(`Ảnh khuôn mặt không hợp lệ: ${reasons}`);
                    verificationDetails.face_liveness = {
                        valid: false,
                        confidence: livenessResult.confidence,
                        reasons: livenessResult.reasons,
                    };
                } else {
                    faceVerified = true;
                    verificationDetails.face_liveness = {
                        valid: true,
                        confidence: livenessResult.confidence,
                    };
                    console.log(
                        `[Verify] ✅ Liveness check passed (${livenessResult.confidence}%)`
                    );
                }
            } catch (livenessErr) {
                console.error("[Verify] Liveness check error:", livenessErr);
                verificationErrors.push(
                    "Không thể xác minh khuôn mặt. Vui lòng thử lại."
                );
                verificationDetails.face_liveness = { error: livenessErr.message };
            }
        }

        // ========== BƯỚC 2: Xác minh thẻ sinh viên (OCR) ==========
        if (cardUploaded) {
            try {
                console.log(
                    `[Verify] Bước 2: Kiểm tra thẻ SV cho submission ${submissionId}`
                );
                const cardResult = await verifyStudentCard(cardFile.buffer);

                if (cardResult.error) {
                    verificationErrors.push(`Lỗi xác minh thẻ SV: ${cardResult.error}`);
                    verificationDetails.student_card = { error: cardResult.error };
                } else if (!cardResult.valid) {
                    const reasons = cardResult.reasons?.join(", ") || "Không rõ lý do";
                    verificationErrors.push(`Thẻ sinh viên không hợp lệ: ${reasons}`);
                    verificationDetails.student_card = {
                        valid: false,
                        fields_matched: cardResult.fields_matched,
                        mssv: cardResult.mssv,
                        reasons: cardResult.reasons,
                    };
                } else {
                    cardVerified = true;
                    verificationDetails.student_card = {
                        valid: true,
                        fields_matched: cardResult.fields_matched,
                        mssv: cardResult.mssv,
                    };
                    console.log(`[Verify] ✅ Card OCR passed (MSSV: ${cardResult.mssv})`);
                }
            } catch (cardErr) {
                console.error("[Verify] Card verification error:", cardErr);
                verificationErrors.push(
                    "Không thể xác minh thẻ sinh viên. Vui lòng thử lại."
                );
                verificationDetails.student_card = { error: cardErr.message };
            }
        }

        // ========== BƯỚC 3: So sánh khuôn mặt (Face matching) ==========
        if (faceUploaded && cardUploaded && faceVerified && cardVerified) {
            try {
                console.log(
                    `[Verify] Bước 3: So sánh khuôn mặt cho submission ${submissionId}`
                );
                const matchResult = await compareFaces(
                    faceFile.buffer,
                    cardFile.buffer,
                    0.35
                );

                if (matchResult.error) {
                    verificationErrors.push(
                        `Lỗi so sánh khuôn mặt: ${matchResult.error}`
                    );
                    verificationDetails.face_match = { error: matchResult.error };
                    faceVerified = false;
                    cardVerified = false;
                } else {
                    const confidence =
                        matchResult.confidence || (1 - (matchResult.distance || 1)) * 100;
                    const threshold = 50;

                    if (confidence >= threshold) {
                        verificationDetails.face_match = {
                            valid: true,
                            confidence: confidence,
                            distance: matchResult.distance,
                            match: true,
                        };
                        console.log(
                            `[Verify] ✅ Face match passed (${confidence.toFixed(1)}%)`
                        );
                    } else {
                        verificationErrors.push(
                            `Khuôn mặt không khớp với thẻ sinh viên (độ tương đồng: ${confidence.toFixed(
                                1
                            )}%, yêu cầu ≥${threshold}%)`
                        );
                        verificationDetails.face_match = {
                            valid: false,
                            confidence: confidence,
                            distance: matchResult.distance,
                            match: false,
                        };
                        faceVerified = false;
                        cardVerified = false;
                    }
                }
            } catch (matchErr) {
                console.error("[Verify] Face matching error:", matchErr);
                verificationErrors.push(
                    "Không thể so sánh khuôn mặt. Vui lòng thử lại."
                );
                verificationDetails.face_match = { error: matchErr.message };
                faceVerified = false;
                cardVerified = false;
            }
        }

        // Cập nhật database verification status
        try {
            if (faceVerified && (await hasCol("submissions", "face_verified"))) {
                await sequelize.query(
                    `UPDATE submissions SET face_verified = 1 WHERE id = ?`,
                    { replacements: [submissionId] }
                );
            }
            if (cardVerified && (await hasCol("submissions", "card_verified"))) {
                await sequelize.query(
                    `UPDATE submissions SET card_verified = 1 WHERE id = ?`,
                    { replacements: [submissionId] }
                );
            }
        } catch (e) {
            /* ignore if columns missing */
        }

        // Persist binary/photo if columns are available
        try {
            if (faceUploaded) {
                const hasBlob = await hasCol("submissions", "face_image_blob");
                const hasMime = await hasCol("submissions", "face_image_mimetype");
                const hasUrl = await hasCol("submissions", "face_image_url");
                if (hasBlob && hasMime) {
                    await sequelize.query(
                        `UPDATE submissions SET face_image_blob = ?, face_image_mimetype = ? WHERE id = ?`,
                        {
                            replacements: [
                                faceFile.buffer,
                                faceFile.mimetype || null,
                                submissionId,
                            ],
                        }
                    );
                } else if (hasUrl) {
                    const uploadsDir = path.resolve(
                        __dirname,
                        "..",
                        "..",
                        "uploads",
                        "submissions",
                        String(submissionId)
                    );
                    fs.mkdirSync(uploadsDir, { recursive: true });
                    const outPath = path.join(uploadsDir, `face_${Date.now()}.jpg`);
                    fs.writeFileSync(outPath, faceFile.buffer);
                    const rel = outPath
                        .split(path.resolve(__dirname, "..", ".."))[1]
                        .replace(/\\/g, "/");
                    await sequelize.query(
                        `UPDATE submissions SET face_image_url = ? WHERE id = ?`,
                        {
                            replacements: [
                                rel.startsWith("/") ? rel : `/${rel}`,
                                submissionId,
                            ],
                        }
                    );
                }
            }
            if (cardUploaded) {
                const hasBlob = await hasCol("submissions", "student_card_blob");
                const hasMime = await hasCol("submissions", "student_card_mimetype");
                const hasUrl = await hasCol("submissions", "student_card_url");
                if (hasBlob && hasMime) {
                    await sequelize.query(
                        `UPDATE submissions SET student_card_blob = ?, student_card_mimetype = ? WHERE id = ?`,
                        {
                            replacements: [
                                cardFile.buffer,
                                cardFile.mimetype || null,
                                submissionId,
                            ],
                        }
                    );
                } else if (hasUrl) {
                    const uploadsDir = path.resolve(
                        __dirname,
                        "..",
                        "..",
                        "uploads",
                        "submissions",
                        String(submissionId)
                    );
                    fs.mkdirSync(uploadsDir, { recursive: true });
                    const outPath = path.join(uploadsDir, `card_${Date.now()}.jpg`);
                    fs.writeFileSync(outPath, cardFile.buffer);
                    const rel = outPath
                        .split(path.resolve(__dirname, "..", ".."))[1]
                        .replace(/\\/g, "/");
                    await sequelize.query(
                        `UPDATE submissions SET student_card_url = ? WHERE id = ?`,
                        {
                            replacements: [
                                rel.startsWith("/") ? rel : `/${rel}`,
                                submissionId,
                            ],
                        }
                    );
                }
            }
        } catch (persistErr) {
            console.warn(
                "[uploadVerifyAssets] persist image error:",
                persistErr?.message || persistErr
            );
        }

        // Trả về response với thông tin chi tiết
        if (verificationErrors.length > 0) {
            return res.status(400).json({
                ok: false,
                face: false,
                card: false,
                errors: verificationErrors,
                details: verificationDetails,
                message: verificationErrors.join(" | "),
            });
        }

        return res.json({
            ok: true,
            face: faceVerified,
            card: cardVerified,
            details: verificationDetails,
            message: "Xác minh thành công",
        });
    } catch (err) {
        console.error("uploadVerifyAssets error:", err);
        return res
            .status(500)
            .json({ message: "Server error", error: err.message });
    }
}

module.exports = {
    uploadImages,
    verifyStudentCardImage,
    verifyFaceImage,
    compareFaceImages,
    uploadVerifiedImages,
    uploadVerifyAssets,
};
