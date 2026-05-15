const axios = require("axios");

let activeRequests = 0;
const GLOBAL_CONCURRENCY_LIMIT = 20;
const queue = [];

function processQueue() {
    if (activeRequests >= GLOBAL_CONCURRENCY_LIMIT || queue.length === 0) return;

    const { ans, resolve, reject, AI_SERVICE_URL } = queue.shift();
    activeRequests++;

    axios.post(`${AI_SERVICE_URL}/grade`, {
        student_answer: ans.text,
        model_answer: ans.model_answer,
        max_points: ans.points || 10
    }, { timeout: 0 }) // INFINITE TIMEOUT
    .then(res => {
        resolve(res.data);
    })
    .catch(err => {
        const errorDetail = err.response ? 
            `Status: ${err.response.status} - Data: ${JSON.stringify(err.response.data)}` : 
            err.message;
        console.error(`[AI Queue Error] ${errorDetail}`);
        reject(new Error(errorDetail));
    })
    .finally(() => {
        activeRequests--;
        processQueue();
    });
}

function addToQueue(ans, AI_SERVICE_URL) {
    return new Promise((resolve, reject) => {
        queue.push({ ans, resolve, reject, AI_SERVICE_URL });
        processQueue();
    });
}

async function stressTestAI(req, res) {
    const { student_answers } = req.body;
    const AI_SERVICE_URL = process.env.AI_SERVICE_URL || "http://127.0.0.1:8000";

    if (!student_answers || !Array.isArray(student_answers)) {
        return res.status(400).json({ message: "Invalid payload" });
    }

    try {
        const promises = student_answers.map(ans => addToQueue(ans, AI_SERVICE_URL));
        const results = await Promise.allSettled(promises);

        const successResults = results.filter(r => r.status === 'fulfilled');
        const scores = successResults.map(r => r.value.score || 0);
        const errors = results.filter(r => r.status === 'rejected').map(r => r.reason.message);

        return res.json({
            status: successResults.length > 0 ? "success" : "failure",
            processed_count: student_answers.length,
            success_count: successResults.length,
            total_score: scores.reduce((a, b) => a + b, 0),
            errors: errors.slice(0, 5),
            message: "Benchmark processed"
        });
    } catch (err) {
        console.error("Critical Benchmark Error:", err);
        return res.status(500).json({ message: "Internal Server Error", error: err.message });
    }
}

async function stressTestVerify(req, res) {
    const { face_image_base64 } = req.body;
    
    if (!face_image_base64) {
        return res.status(400).json({ message: "face_image_base64 is required" });
    }

    try {
        const { verifyFaceLiveness } = require("../services/verificationService");
        const buffer = Buffer.from(face_image_base64, 'base64');
        
        const startTime = Date.now();
        const result = await verifyFaceLiveness(buffer);
        const duration = Date.now() - startTime;

        return res.json({
            status: "success",
            duration_ms: duration,
            result: result
        });
    } catch (err) {
        console.error("Verification Stress Test Error:", err);
        return res.status(500).json({ message: "Verification failed", error: err.message });
    }
}

module.exports = { stressTestAI, stressTestVerify };
