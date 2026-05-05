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

    const pythonPath = process.env.PYTHON_PATH || "python";

    const pythonProcess = spawn(pythonPath, [pythonScript], {
      stdio: ['pipe', 'pipe', 'pipe'],
      maxBuffer: 10 * 1024 * 1024, // 10MB buffer
      env: { ...process.env, PYTHONIOENCODING: 'utf-8' }
    });

    const input = JSON.stringify({ action, ...data });
    let stdout = "";
    let stderr = "";
    let stdinWritten = false;

    // Timeout 60s để xử lý ảnh lớn
    const timeout = setTimeout(() => {
      pythonProcess.kill();
      reject(new Error("Python verification timeout after 60s"));
    }, 60000);

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
      clearTimeout(timeout);
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);

      if (code !== 0) {
        console.error(`[Python ${action}] ❌ Lỗi (${elapsed}s):`, stderr);

        // Detect specific Python environment issues
        if (stderr.includes("numpy.dtype size changed") || stderr.includes("binary incompatibility")) {
          const msg = `🔧 Python Environment Issue: numpy/pandas version mismatch. Run: pip install --upgrade --force-reinstall numpy pandas`;
          console.error(`[Python ${action}] ${msg}`);
          return reject(new Error(msg));
        }

        if (stderr.includes("ModuleNotFoundError") || stderr.includes("ImportError")) {
          const msg = `🔧 Python Missing Dependencies: ${stderr.match(/ModuleNotFoundError.*|ImportError.*/)?.[0] || "Unknown module"}. Run: pip install -r requirements.txt`;
          console.error(`[Python ${action}] ${msg}`);
          return reject(new Error(msg));
        }

        return reject(new Error(`Python process exited with code ${code}: ${stderr}`));
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
      clearTimeout(timeout);
      console.error(`[Python ${action}] ❌ Không khởi động được Python:`, err.message);
      reject(new Error(`Failed to start Python process: ${err.message}`));
    });

    // ✅ FIX: Xử lý lỗi khi write vào stdin
    pythonProcess.stdin.on("error", (err) => {
      console.error(`[Python ${action}] ❌ Stdin write error:`, err.message);
      if (!stdinWritten) {
        clearTimeout(timeout);
        reject(new Error(`Failed to write to Python stdin: ${err.message}`));
      }
    });

    // Write input và đánh dấu đã ghi xong
    try {
      pythonProcess.stdin.write(input, "utf8", (err) => {
        if (err) {
          console.error(`[Python ${action}] ❌ Write callback error:`, err);
        } else {
          stdinWritten = true;
        }
      });
      pythonProcess.stdin.end();
    } catch (writeErr) {
      clearTimeout(timeout);
      reject(new Error(`Failed to write input: ${writeErr.message}`));
    }
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
