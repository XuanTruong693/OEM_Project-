const { spawn } = require('child_process');
const path = require('path');

const ROOT_DIR = __dirname;
const isWin = process.platform === 'win32';

// Color codes for console output
const colors = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m',
};

function startProcess(name, command, args, cwd, color, customEnv = {}) {
    console.log(`\x1b[32m[PM2]\x1b[0m${color}[${name}]\x1b[0m Starting...`);

    const proc = spawn(command, args, {
        cwd,
        shell: true,
        stdio: 'pipe',
        env: { ...process.env, ...customEnv },
        windowsHide: true
    });

    proc.stdout.on('data', (data) => {
        const lines = data.toString().trim().split('\n');
        lines.forEach(line => {
            if (line.trim()) {
                console.log(`\x1b[32m[PM2]\x1b[0m${color}[${name}]\x1b[0m ${line}`);
            }
        });
    });

    proc.stderr.on('data', (data) => {
        const lines = data.toString().trim().split('\n');
        lines.forEach(line => {
            if (line.trim()) {
                console.log(`\x1b[32m[PM2]\x1b[0m${color}[${name}]\x1b[0m ${line}`);
            }
        });
    });

    proc.on('error', (err) => {
        console.error(`\x1b[32m[PM2]\x1b[0m${color}[${name}]\x1b[0m Error: ${err.message}`);
    });

    proc.on('close', (code) => {
        console.log(`\x1b[32m[PM2]\x1b[0m${color}[${name}]\x1b[0m Exited with code ${code}`);
    });

    return proc;
}

// Pre-flight check: Kill any processes running on port 5000 or 8000
const { execSync } = require('child_process');
function clearPorts(ports) {
    ports.forEach(port => {
        try {
            const stdout = execSync(`netstat -ano | findstr :${port}`).toString();
            const lines = stdout.trim().split('\n');
            lines.forEach(line => {
                const parts = line.trim().split(/\s+/);
                const pid = parts[parts.length - 1];
                if (pid && !isNaN(pid) && pid !== '0') {
                    execSync(`taskkill /F /PID ${pid}`, { stdio: 'ignore' });
                }
            });
        } catch (e) {
            // No process using that port, proceed
        }
    });
}

console.log('🔄 Cleaning up existing processes on port 5000 and 8000...');
clearPorts([5000, 8000]);

// Start Backend
const backendProc = startProcess(
    'Backend',
    'node',
    ['src/app.js'],
    path.join(ROOT_DIR, 'backend'),
    colors.green
);

// Frontend is served by Cloudflare Pages - no local server needed
console.log(`${colors.blue}[Frontend]${colors.reset} Served by Cloudflare Pages (https://oes.io.vn)`);

// Start AI Service with venv Python
const aiPythonPath = path.join(ROOT_DIR, 'ai_services', '.venv', 'Scripts', 'python.exe');
const aiProc = startProcess(
    'AI',
    aiPythonPath,
    ['-m', 'uvicorn', 'app.main:app', '--host', '0.0.0.0', '--port', '8000'],
    path.join(ROOT_DIR, 'ai_services'),
    colors.magenta,
    { PYTHONIOENCODING: 'utf-8' }
);

// Start Cloudflare Tunnel to expose local services
const tunnelProc = startProcess(
    'Tunnel',
    'cloudflared',
    ['tunnel', 'run', 'oem-local'],
    ROOT_DIR,
    colors.cyan
);

// Handle Ctrl+C
process.on('SIGINT', () => {
    console.log('\nShutting down all services...');
    
    const { execSync } = require('child_process');
    try {
        if (backendProc.pid) execSync(`taskkill /F /T /PID ${backendProc.pid}`, { stdio: 'ignore' });
        if (aiProc.pid) execSync(`taskkill /F /T /PID ${aiProc.pid}`, { stdio: 'ignore' });
        if (tunnelProc.pid) execSync(`taskkill /F /T /PID ${tunnelProc.pid}`, { stdio: 'ignore' });
    } catch (e) {
        // Suppress errors if process already exited
    }

    process.exit();
});

console.log('\n========================================');
console.log('🎯 All services starting...');
console.log('========================================');
console.log('  Backend:  http://localhost:5000');
console.log('  AI:       http://localhost:8000');
console.log('  Tunnel:   Cloudflare Tunnel (oem-local)');
console.log('----------------------------------------');
console.log('  🌐 Public URLs (via Cloudflare):');
console.log('  Frontend: https://oes.io.vn');
console.log('  API:      https://api.oes.io.vn');
console.log('  AI:       https://ai.oes.io.vn');
console.log('========================================');
console.log('💡 Tip: Wait for "AI Model Loaded" message before testing AI grading');
console.log('========================================\n');
