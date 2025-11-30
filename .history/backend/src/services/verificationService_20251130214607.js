const { spawn } = require("child_process");
const path = require("path");

/**
 * Gọi Python script verify_images.py - unified verification
 * @param {string} action - "verify_card" | "verify_face" | "compare_faces"
 * @param {object} data - Input data
 * @returns {Promise<object>}
 */
async function callPythonVerify(action, data) {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    console.log(`\n[Python ${action}] 🚀 Bắt đầu xác minh...`);
    
    const pythonScript = path.join(
      __dirname,
      "..",
      "middleware",
      "verify_images.py"
    );
    const pythonProcess = spawn("python", [pythonScript]);

    const input = JSON.stringify({ action, ...data });
    let stdout = "";
    let stderr = "";
    
    // Không có timeout - tối ưu hóa để xong trong 10s

    pythonProcess.stdout.on("data", (data) => {
      stdout += data.toString("utf8");
    });

    pythonProcess.stderr.on("data", (data) => {
      const msg = data.toString("utf8");
      stderr += msg;
      
      // Parse progress percentage từ Python
      const progressMatch = msg.match(/Progress:\s*(\d+)%/);
      if (progressMatch) {
        const progress = parseInt(progressMatch[1]);
        console.log(`[Python ${action}] 📊 Progress: ${progress}%`);
      }
      
      // Log các message quan trọng khác
      if (msg.includes("[OCR]") || msg.includes("[Liveness]") || msg.includes("[Face Matching]")) {
        console.log(`[Python ${action}] ${msg.trim()}`);
      }
    });

    pythonProcess.on("close", (code) => {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
      
      if (code !== 0) {
        console.error(`[Python ${action}] ❌ Lỗi (${elapsed}s):`, stderr);
        return reject(new Error(`Python process exited with code ${code}`));
      }

      try {
        const result = JSON.parse(stdout);
        console.log(`[Python ${action}] ✅ Hoàn thành trong ${elapsed}s`);
        resolve(result);
      } catch (parseErr) {
        console.error(`[Python ${action}] ❌ Invalid JSON (${elapsed}s):`, stdout.substring(0, 200));
        reject(new Error("Invalid JSON from Python script"));
      }
    });

    pythonProcess.on("error", (err) => {
      console.error(`[Python ${action}] ❌ Không khởi động được Python:`, err.message);
      reject(new Error(`Failed to start Python process: ${err.message}`));
    });

    pythonProcess.stdin.write(input);
    pythonProcess.stdin.end();
  });
}

/**
 * Xác minh thẻ sinh viên qua OCR Python script
 * @param {Buffer} imageBuffer - Buffer của ảnh thẻ SV
 * @returns {Promise<{valid: boolean, details: object}>}
 */
async function verifyStudentCard(imageBuffer) {
  const base64Image = imageBuffer.toString("base64");
  const result = await callPythonVerify("verify_card", {
    card_image: base64Image,
  });
  
  if (!result.success) {
    throw new Error(result.error || "Verification failed");
  }
  
  return result;
}

/**
 * Xác minh khuôn mặt selfie (liveness detection)
 * @param {Buffer} faceBuffer - Buffer của ảnh selfie
 * @returns {Promise<{is_live: boolean, confidence: number, reasons: array}>}
 */
async function verifyFaceLiveness(faceBuffer) {
  const base64Image = faceBuffer.toString("base64");
  const result = await callPythonVerify("verify_face", {
    face_image: base64Image,
  });
  
  if (!result.success) {
    throw new Error(result.error || "Liveness check failed");
  }
  
  return result.liveness;
}

/**
 * So sánh khuôn mặt giữa selfie và thẻ SV
 * @param {Buffer} faceBuffer - Buffer của ảnh selfie
 * @param {Buffer} cardBuffer - Buffer của ảnh thẻ SV
 * @param {number} tolerance - Ngưỡng chấp nhận (0.35 = 35%)
 * @returns {Promise<{match: boolean, confidence: number, distance: number}>}
 */
async function compareFaces(faceBuffer, cardBuffer, tolerance = 0.35) {
  const base64Face = faceBuffer.toString("base64");
  const base64Card = cardBuffer.toString("base64");
  
  const result = await callPythonVerify("compare_faces", {
    face_image: base64Face,
    card_image: base64Card,
    tolerance: tolerance,
  });
  
  if (!result.success) {
    throw new Error(result.error || "Face comparison failed");
  }
  
  return result.comparison;
}

module.exports = {
  verifyStudentCard,
  verifyFaceLiveness,
  compareFaces,
};
