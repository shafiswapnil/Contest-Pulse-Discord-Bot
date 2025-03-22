module.exports = {
  // Build Configuration
  build: {
    // Dockerfile generation options
    dockerfile: {
      // Base image to use
      base: 'node:16-alpine',
      // Working directory inside the container
      workdir: '/app',
      // Files to copy into the container
      copy: ['package.json', 'package-lock.json', '.'],
      // Commands to run during build
      run: [
        'npm ci --only=production', 
        'npm prune --production'
      ],
      // Command to run when container starts
      cmd: ['npm', 'start']
    },
    // Optimize build size by excluding development files
    ignore: ['.git', 'node_modules', '.env', '*.log']
  },
  
  // Runtime Configuration
  runtime: {
    // Add health check for container
    healthcheck: {
      path: '/health',
      port: 3000,
      interval: '30s',
      timeout: '10s',
      retries: 3
    },
    // Environment variables necessary for production
    env: [
      'DISCORD_TOKEN',
      'DISCORD_CHANNEL_ID',
      'CONTEST_ROLE_ID',
      'CONTEST_DAYS_AHEAD',
      'CONTEST_CHECK_SCHEDULE',
      'PORT'
    ]
  }
}; 