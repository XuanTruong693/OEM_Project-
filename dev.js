/**
 * Development mode - Run all services on localhost
 * Usage: npm run dev
 */
const { spawn } = require('child_process');
const path = require('path');

const ROOT_DIR = __dirname;

// Color codes for console output
const colors = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    yellow: '\x1b[33m',
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

// Start Backend (development mode with nodemon if available, otherwise node)
const backendProc = startProcess(
    'Backend',
    'npm',
    ['run', 'dev'],
    path.join(ROOT_DIR, 'backend'),
    colors.green
);

// Start Frontend (Vite dev server on port 4000)
const frontendProc = startProcess(
    'Frontend',
    'npm',
    ['run', 'dev', '--', '--port', '4000'],
    path.join(ROOT_DIR, 'frontend'),
    colors.blue
);

// Start AI Service with venv Python
// Use cmd /c with full absolute path to avoid path resolution issues
const aiPythonPath = path.join(ROOT_DIR, 'ai_services', '.venv', 'Scripts', 'python.exe');
const aiProc = startProcess(
    'AI',
    'cmd',
    ['/c', `"${aiPythonPath}" -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload`],
    path.join(ROOT_DIR, 'ai_services'),
    colors.magenta,
    { PYTHONIOENCODING: 'utf-8' }
);

// Handle Ctrl+C
process.on('SIGINT', () => {
    console.log('\nShutting down all services...');
    backendProc.kill();
    frontendProc.kill();
    aiProc.kill();
    process.exit();
});

console.log('\n==========================================');
console.log('🚀 DEVELOPMENT MODE - All on localhost');
console.log('==========================================');
console.log('  Backend:   http://localhost:5000');
console.log('  Frontend:  http://localhost:4000');
console.log('  AI:        http://localhost:8000');
console.log('------------------------------------------');
console.log('  API Docs:  http://localhost:8000/docs');
console.log('==========================================');
console.log('💡 Press Ctrl+C to stop all services');
console.log('==========================================\n');
