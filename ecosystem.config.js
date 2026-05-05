module.exports = {
  apps: [
    {
      name: "oem-backend",
      script: "src/app.js",
      cwd: "backend",
      instances: 1,
      exec_mode: "cluster",
      watch: false,
      max_memory_restart: "4G",
      env: {
        NODE_ENV: "production",
      },
      env_development: {
        NODE_ENV: "development",
      },
    },
    {
      name: "oem-ai",
      script: "start_ai.js",
      cwd: "ai_services",
      watch: false,
      max_memory_restart: "4G",
      env: {
        PYTHONIOENCODING: "utf-8"
      }
    }
  ],
};

