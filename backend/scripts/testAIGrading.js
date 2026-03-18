/**
 * Test AI Grading Reliability Fixes
 * Tests the following fixes:
 * 1. Deduplication Guard - Prevents double-submit race conditions
 * 2. Atomic DB Lock - Only one process claims submission
 * 3. Immediate Retry - Fast recovery from failures
 * 4. Queue Status Monitoring - Admin can check queue status
 * 5. Score Validation - AI scores are validated before saving
 */

const http = require('http');
const https = require('https');

// Configuration
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:4000';
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || 'test-token'; // Should be obtained from login

// Test Results
let testResults = {
    passed: 0,
    failed: 0,
    tests: []
};

// Helper: Make HTTP request
function makeRequest(method, path, body = null, token = null) {
    return new Promise((resolve, reject) => {
        const url = new URL(BACKEND_URL + path);
        const isHttps = url.protocol === 'https:';
        const client = isHttps ? https : http;

        const options = {
            method,
            headers: {
                'Content-Type': 'application/json'
            }
        };

        if (token) {
            options.headers['Authorization'] = `Bearer ${token}`;
        }

        const req = client.request(url, options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    resolve({
                        status: res.statusCode,
                        body: data ? JSON.parse(data) : null,
                        headers: res.headers
                    });
                } catch (e) {
                    resolve({
                        status: res.statusCode,
                        body: data,
                        headers: res.headers
                    });
                }
            });
        });

        req.on('error', reject);

        if (body) {
            req.write(JSON.stringify(body));
        }
        req.end();
    });
}

// Test Helper
function recordTest(testName, passed, message = '') {
    testResults.tests.push({
        name: testName,
        passed,
        message
    });
    if (passed) {
        testResults.passed++;
        console.log(`✅ ${testName}`);
    } else {
        testResults.failed++;
        console.log(`❌ ${testName}: ${message}`);
    }
}

// Test 1: Backend Connectivity
async function testBackendConnectivity() {
    console.log('\n[Test 1] Backend Connectivity');
    try {
        const res = await makeRequest('GET', '/api/admin/dashboard', null, ADMIN_TOKEN);
        recordTest('Backend accessible', res.status === 200 || res.status === 401, 
                   `Status: ${res.status}`);
    } catch (err) {
        recordTest('Backend accessible', false, err.message);
    }
}

// Test 2: AI Queue Status API
async function testQueueStatusAPI() {
    console.log('\n[Test 2] AI Queue Status API');
    try {
        const res = await makeRequest('GET', '/api/admin/ai/queue-status', null, ADMIN_TOKEN);
        const statusOk = res.status === 200 && res.body && res.body.data;
        recordTest('Queue status endpoint exists', statusOk, 
                   `Status: ${res.status}, Body: ${JSON.stringify(res.body)}`);

        if (statusOk) {
            const { active, maxConcurrent, dbStats } = res.body.data;
            console.log(`   📊 Queue Status: ${active}/${maxConcurrent} active jobs`);
            if (dbStats) {
                console.log(`   📊 DB Stats:`, dbStats);
            }
        }
    } catch (err) {
        recordTest('Queue status endpoint exists', false, err.message);
    }
}

// Test 3: Retry Failed API
async function testRetryFailedAPI() {
    console.log('\n[Test 3] Retry Failed Submissions API');
    try {
        const res = await makeRequest('POST', '/api/admin/ai/retry-failed', {}, ADMIN_TOKEN);
        const statusOk = res.status === 200 && res.body && res.body.success !== false;
        recordTest('Retry failed endpoint exists', statusOk, 
                   `Status: ${res.status}, Body: ${JSON.stringify(res.body)}`);

        if (statusOk) {
            console.log(`   🔄 Retried ${res.body.retryCount || 0} submissions`);
        }
    } catch (err) {
        recordTest('Retry failed endpoint exists', false, err.message);
    }
}

// Test 4: Database Structure Check
async function testDatabaseStructure() {
    console.log('\n[Test 4] Database Structure Validation');
    try {
        const { pool } = require('../config/db');
        const conn = await pool.getConnection();

        // Check for required columns
        const [columns] = await conn.query(`
            SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_NAME = 'submissions' 
            AND TABLE_SCHEMA = DATABASE()
            AND COLUMN_NAME IN ('ai_grading_status', 'ai_grading_retry_count', 'ai_grading_started_at', 'ai_grading_error')
        `);

        conn.release();

        const requiredColumns = ['ai_grading_status', 'ai_grading_retry_count', 'ai_grading_started_at', 'ai_grading_error'];
        const foundColumns = columns.map(c => c.COLUMN_NAME);
        const hasAllColumns = requiredColumns.every(col => foundColumns.includes(col));

        recordTest('AI grading columns exist', hasAllColumns, 
                   `Found: ${foundColumns.join(', ')}`);
    } catch (err) {
        recordTest('AI grading columns exist', false, err.message);
    }
}

// Test 5: AIService Module Imports
async function testAIServiceLoaded() {
    console.log('\n[Test 5] AIService Module Validation');
    try {
        const AIService = require('../services/AIService');
        const hasRequiredExports = 
            typeof AIService.gradeSubmission === 'function' &&
            typeof AIService.getQueueStatus === 'function' &&
            typeof AIService.retryAllFailed === 'function' &&
            typeof AIService.recoverPendingSubmissions === 'function';

        recordTest('AIService exports all required functions', hasRequiredExports, 
                   `Exports: gradeSubmission, getQueueStatus, retryAllFailed, recoverPendingSubmissions`);
    } catch (err) {
        recordTest('AIService exports all required functions', false, err.message);
    }
}

// Test 6: ExamSessionController Updates
async function testExamSessionController() {
    console.log('\n[Test 6] ExamSessionController Deduplication');
    try {
        const code = require('fs').readFileSync('../controllers/exam/ExamSessionController.js', 'utf8');
        
        // Check for deduplication guard
        const hasSubmittedAtCheck = code.includes('submitted_at IS NULL');
        const hasAffectedRowsCheck = code.includes('affectedRows === 0');
        const hasDuplicateResponse = code.includes('duplicate: true');

        recordTest('Deduplication guard implemented', 
                   hasSubmittedAtCheck && hasAffectedRowsCheck && hasDuplicateResponse,
                   `Has submitted_at check: ${hasSubmittedAtCheck}, affectedRows check: ${hasAffectedRowsCheck}, duplicate response: ${hasDuplicateResponse}`);
    } catch (err) {
        recordTest('Deduplication guard implemented', false, err.message);
    }
}

// Test 7: Score Validation
async function testScoreValidation() {
    console.log('\n[Test 7] Score Validation in AIService');
    try {
        const code = require('fs').readFileSync('../services/AIService.js', 'utf8');
        
        // Check for score validation
        const hasNaNCheck = code.includes('isNaN(score)');
        const hasRangeValidation = code.includes('score < 0') && code.includes('score > ans.max_points');
        const hasClamping = code.includes('Math.max') || code.includes('score = 0') || code.includes('score = ans.max_points');

        recordTest('Score validation implemented', 
                   hasNaNCheck && hasRangeValidation,
                   `Has NaN check: ${hasNaNCheck}, range validation: ${hasRangeValidation}`);
    } catch (err) {
        recordTest('Score validation implemented', false, err.message);
    }
}

// Test 8: Logging for Diagnostics
async function testDiagnosticLogging() {
    console.log('\n[Test 8] Diagnostic Logging for 0-Marks');
    try {
        const code = require('fs').readFileSync('../services/AIService.js', 'utf8');
        
        // Check for 0-mark diagnostic logging
        const hasDiagnosticLogging = code.includes('score === 0') && 
                                    code.includes('explanation') &&
                                    code.includes('console.log');

        recordTest('0-mark diagnostic logging implemented', 
                   hasDiagnosticLogging,
                   `Has score === 0 logging: ${hasDiagnosticLogging}`);
    } catch (err) {
        recordTest('0-mark diagnostic logging implemented', false, err.message);
    }
}

// Main Test Runner
async function runAllTests() {
    console.log('🧪 AI GRADING RELIABILITY TEST SUITE');
    console.log('=====================================\n');
    console.log(`Backend URL: ${BACKEND_URL}`);
    console.log(`Timestamp: ${new Date().toISOString()}\n`);

    try {
        // Run tests in sequence
        await testBackendConnectivity();
        await testQueueStatusAPI();
        await testRetryFailedAPI();
        await testDatabaseStructure();
        await testAIServiceLoaded();
        await testExamSessionController();
        await testScoreValidation();
        await testDiagnosticLogging();

        // Summary
        console.log('\n=====================================');
        console.log('📊 TEST SUMMARY');
        console.log('=====================================');
        console.log(`✅ Passed: ${testResults.passed}`);
        console.log(`❌ Failed: ${testResults.failed}`);
        console.log(`📈 Total: ${testResults.passed + testResults.failed}`);
        console.log(`Success Rate: ${Math.round(testResults.passed / (testResults.passed + testResults.failed) * 100)}%\n`);

        if (testResults.failed === 0) {
            console.log('🎉 All tests passed!');
        } else {
            console.log('⚠️ Some tests failed. Please review the output above.');
        }

        // Write results to file
        const fs = require('fs');
        fs.writeFileSync('test-results-ai-grading.json', JSON.stringify(testResults, null, 2));
        console.log('\n📁 Results saved to test-results-ai-grading.json');

    } catch (err) {
        console.error('❌ Fatal error during testing:', err);
        process.exit(1);
    }
}

// Run if executed directly
if (require.main === module) {
    runAllTests().then(() => {
        process.exit(testResults.failed === 0 ? 0 : 1);
    }).catch(err => {
        console.error('Fatal error:', err);
        process.exit(1);
    });
}

module.exports = { runAllTests, testResults };
