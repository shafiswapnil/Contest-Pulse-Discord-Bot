#!/bin/bash

# Display banner
echo "=================================="
echo "  Discord Contest Notification Bot"
echo "=================================="
echo "Starting bot service..."

# Check if .env file exists
if [ ! -f .env ]; then
  echo "Warning: .env file not found. Make sure environment variables are set!"
fi

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
  echo "Error: Node.js is not installed. Please install Node.js to run this bot."
  exit 1
fi

# Check if npm packages are installed
if [ ! -d "node_modules" ]; then
  echo "Node modules not found. Installing dependencies..."
  npm install
fi

# Start the bot
echo "Launching bot..."
node index.js 