const { exec } = require('child_process');

let activeConnections = 0;
let currentScale = 1;

function pm2Autoscaler(req, res, next) {
    activeConnections++;
    updateScale(activeConnections);

    res.on('finish', () => {
        activeConnections = Math.max(0, activeConnections - 1);
        updateScale(activeConnections);
    });

    next();
}

function updateScale(connections) {
    let targetScale = 1;

    if (connections >= 5000) {
        targetScale = 4; // Add more workers
    } else if (connections >= 1000) {
        targetScale = 3;
    } else if (connections >= 300) {
        targetScale = 2;
    } else {
        targetScale = 1;
    }

    if (targetScale !== currentScale) {
        currentScale = targetScale;
        console.log(`📡 Active connections: ${connections}. Autoscaling workers to: ${targetScale}`);
        exec(`pm2 scale oem-backend ${targetScale}`, (err, stdout, stderr) => {
            if (err) {
                console.warn('⚠️ PM2 scaling requires PM2 global CLI:', err.message);
            } else {
                console.log(`🚀 Dynamically scaled oem-backend to ${targetScale} instances.`);
            }
        });
    }
}

module.exports = pm2Autoscaler;
