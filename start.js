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
    console.log(`${color}[${name}]${colors.reset} Starting...`);

    const proc = spawn(command, args, {
        cwd,
        shell: true,
        stdio: 'pipe',
        env: { ...process.env, ...customEnv },
    });

    proc.stdout.on('data', (data) => {
        const lines = data.toString().trim().split('\n');
        lines.forEach(line => {
            if (line.trim()) {
                console.log(`${color}[${name}]${colors.reset} ${line}`);
            }
        });
    });

    proc.stderr.on('data', (data) => {
        const lines = data.toString().trim().split('\n');
        lines.forEach(line => {
            if (line.trim()) {
                console.log(`${color}[${name}]${colors.reset} ${line}`);
            }
        });
    });

    proc.on('error', (err) => {
        console.error(`${color}[${name}]${colors.reset} Error: ${err.message}`);
    });

    proc.on('close', (code) => {
        console.log(`${color}[${name}]${colors.reset} Exited with code ${code}`);
    });

    return proc;
}

// Start Backend
const backendProc = startProcess(
    'Backend',
    'npm',
    ['start'],
    path.join(ROOT_DIR, 'backend'),
    colors.green
);

// Frontend is served by Cloudflare Pages - no local server needed
console.log(`${colors.blue}[Frontend]${colors.reset} Served by Cloudflare Pages (https://oem.io.vn)`);

// Start AI Service with venv Python
const pythonPath = path.join(ROOT_DIR, 'ai_services', '.venv', 'Scripts', 'python.exe');
const aiProc = startProcess(
    'AI',
    'cmd',
    ['/c', `"${pythonPath}" -m uvicorn app.main:app --host 0.0.0.0 --port 8000`],
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
    backendProc.kill();
    aiProc.kill();
    tunnelProc.kill();
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
console.log('  Frontend: https://oem.io.vn');
console.log('  API:      https://api.oem.io.vn');
console.log('  AI:       https://ai.oem.io.vn');
console.log('========================================');
console.log('💡 Tip: Wait for "AI Model Loaded" message before testing AI grading');
console.log('========================================\n');

