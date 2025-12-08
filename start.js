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
};

function startProcess(name, command, args, cwd, color) {
    console.log(`${color}[${name}]${colors.reset} Starting...`);

    const proc = spawn(command, args, {
        cwd,
        shell: true,
        stdio: 'pipe',
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

// Start Frontend
const frontendProc = startProcess(
    'Frontend',
    'npm',
    ['start'],
    path.join(ROOT_DIR, 'frontend'),
    colors.blue
);

// Start AI Service with venv Python (inside ai_services folder)
const pythonPath = path.join(ROOT_DIR, 'ai_services', '.venv', 'Scripts', 'python.exe');
console.log(`${colors.magenta}[AI] 🚀 Starting AI Service...${colors.reset}`);
console.log(`${colors.magenta}[AI] ⏳ Loading AI Model (this may take 20-30 seconds)...${colors.reset}`);

const aiProc = startProcess(
    'AI',
    `"${pythonPath}"`,  // Wrap in quotes to handle spaces in path
    ['-m', 'uvicorn', 'app.main:app', '--host', '0.0.0.0', '--port', '8000'],
    path.join(ROOT_DIR, 'ai_services'),
    colors.magenta
);

// Handle Ctrl+C
process.on('SIGINT', () => {
    console.log('\nShutting down all services...');
    backendProc.kill();
    frontendProc.kill();
    aiProc.kill();
    process.exit();
});

console.log('\n========================================');
console.log('🎯 All services starting...');
console.log('========================================');
console.log('  Backend:  http://localhost:5000');
console.log('  Frontend: http://localhost:4000');
console.log('  AI:       http://localhost:8000');
console.log('========================================');
console.log('💡 Tip: Wait for "AI Model Loaded" message before testing AI grading');
console.log('========================================\n');
