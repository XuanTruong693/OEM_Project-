const { spawn } = require('child_process');
const path = require('path');

const pythonPath = path.join(__dirname, '.venv', 'Scripts', 'python.exe');
const aiProc = spawn(pythonPath, ['-m', 'uvicorn', 'app.main:app', '--host', '0.0.0.0', '--port', '8000'], {
    cwd: __dirname,
    shell: false,
    stdio: 'inherit',
    windowsHide: true
});

aiProc.on('close', (code) => {
    process.exit(code);
});
