# Discord Codeforces & AtCoder Contest Bot

A Discord bot that fetches upcoming contest information from Codeforces and AtCoder APIs and sends announcements to a designated Discord channel.

## Features

- Fetches upcoming contests from Codeforces and AtCoder
- Sends formatted announcements to a designated Discord channel with beautiful embeds
- Filters contests to show only those happening within the next 7 days (configurable)
- Scheduled daily checks for new contests (configurable)
- Manual checking via commands
- Optimized for Railway deployment with Railpack
- Health monitoring for all connected services

## File Structure and Purpose

- `index.js` - The main entry point of the application that initializes the Discord bot, schedules contest checks, and handles commands
- `services/contestService.js` - Contains functions to fetch and process contest data from Codeforces and AtCoder APIs
- `utils/embedFormatter.js` - Formats contest data into Discord embedded messages
- `utils/healthCheck.js` - Provides functions to check the health of various API connections
- `.env` - Contains environment variables (create this from `.env.example`)
- `railpack.config.js` - Configuration for Railpack and Railway deployment
- `start.sh` - Bash script to start the bot locally

## Setup

### Creating a Discord Bot

1. Go to the [Discord Developer Portal](https://discord.com/developers/applications)
2. Click "New Application" and give your bot a name
3. Go to the "Bot" tab in the left sidebar
4. Click "Add Bot" and confirm

#### Customizing Bot Name and Avatar

1. In the "Bot" tab, you can change the bot's username at any time
2. To set or change the bot's avatar, click on the bot's image icon and upload a new image
   - Recommended avatar size is 512x512 pixels
   - Supported formats: PNG, JPG, or GIF
3. Click "Save Changes" to apply your modifications

#### Getting Bot Token

1. In the "Bot" tab, under the "Token" section, click "Reset Token" and copy the new token (this is your `DISCORD_TOKEN`)
2. This token is like a password and should be kept secure

#### Required Bot Settings

1. Under "Privileged Gateway Intents", enable:
   - **SERVER MEMBERS INTENT** - Allows the bot to track members
   - **MESSAGE CONTENT INTENT** - Required to read command messages
2. These intents are **required** for the bot to function properly
3. Save changes after enabling these settings

### Inviting the Bot to Your Server

1. Go to the "OAuth2" > "URL Generator" tab in the Discord Developer Portal
2. For **Scopes**, select:
   - `bot` (required)
   - `applications.commands` (for slash commands in the future)
3. For **Bot Permissions**, select:
   - Read Messages/View Channels
   - Send Messages
   - Embed Links
   - Mention Everyone (if you want to mention roles)
4. Copy the generated URL at the bottom of the page
5. Open this URL in your web browser
6. Select the server where you want to add the bot from the dropdown menu
   - Note: You need "Manage Server" permission on that server
7. Click "Authorize" and complete any verification prompts
8. You should see a confirmation that the bot was added to your server
9. The bot will appear in your server's member list, but will be offline until you run the bot application

### Getting Your Discord Channel ID

1. Open Discord and go to Settings > Advanced
2. Enable "Developer Mode"
3. Right-click on the channel where you want contest announcements and click "Copy ID"
4. This is your `DISCORD_CHANNEL_ID`

### Setting Up a Contest Role (Optional)

1. Create a role in your Discord server (e.g., "Contest Notifications")
2. Right-click on the role with Developer Mode enabled and click "Copy ID"
3. This is your `CONTEST_ROLE_ID`

### Local Development

1. Clone the repository

```bash
git clone https://github.com/yourusername/discord-codeforces-bot.git
cd discord-codeforces-bot
```

2. Install dependencies

```bash
npm install
```

3. Copy the example environment file

```bash
cp .env.example .env
```

4. Edit the `.env` file with your Discord token, channel ID, and other optional settings

5. Start the bot in development mode

```bash
npm run dev
```

### Railway Deployment (Step by Step)

1. **Create a GitHub Repository**

   - Push your code to GitHub
   - Make sure to add `.env` to `.gitignore` to avoid exposing your tokens

2. **Sign Up for Railway**

   - Go to [Railway](https://railway.app/) and sign up using your GitHub account

3. **Create a New Project**

   - Click "New Project" in the Railway dashboard
   - Select "Deploy from GitHub repo"
   - Find and select your bot repository

4. **Add Environment Variables**

   - In your project, go to the "Variables" tab
   - Add the following variables based on your `.env.example` file:

     **Required Variables:**

     - `DISCORD_TOKEN` - Your Discord bot token (obtained from Discord Developer Portal)
     - `DISCORD_CHANNEL_ID` - The ID of the channel where contest announcements will be sent

     **Optional Variables:**

     - `CONTEST_ROLE_ID` - ID of the role to mention when announcing contests
     - `CONTEST_DAYS_AHEAD` - Number of days to look ahead for contests (default: 7)
     - `CONTEST_CHECK_SCHEDULE` - Cron expression for when to check contests (default: '0 12 \* \* \*', daily at 12:00 UTC)
     - `LOG_LEVEL` - Logging level: debug, info, warn, or error (default: info)

     **API Authentication (if needed in the future):**

     - `CODEFORCES_API_KEY` - Your Codeforces API key
     - `CODEFORCES_API_SECRET` - Your Codeforces API secret
     - `ATCODER_API_KEY` - Your AtCoder API key

     **Server Configuration:**

     - `PORT` - Port for the health check server (default: 3000)

5. **Configure Deployment Settings**

   - Railway will detect your Node.js application automatically
   - The project uses Railpack for optimized Docker deployment
   - No additional configuration is needed as the `railpack.config.js` file handles this

6. **Deploy Your Bot**

   - Railway will automatically deploy your bot
   - You can view logs in the "Deployments" tab

7. **Cron Jobs on Railway**

   - Railway **DOES** support cron jobs through the application's internal scheduling
   - This bot uses `node-schedule` to run its cron jobs internally
   - You don't need to set up a separate cron service with Railway
   - The bot's scheduled tasks will run automatically based on the `CONTEST_CHECK_SCHEDULE` environment variable

8. **Ensure the Bot Stays Active**
   - Railway keeps your service running automatically
   - The health check endpoint ensures your bot is monitored
   - Railway automatically restarts failed services

## Configuration Options

You can configure the bot by setting the following environment variables:

| Variable                 | Description                                    | Default                           |
| ------------------------ | ---------------------------------------------- | --------------------------------- |
| `DISCORD_TOKEN`          | Your Discord bot token (required)              | -                                 |
| `DISCORD_CHANNEL_ID`     | The channel ID for announcements (required)    | -                                 |
| `CONTEST_ROLE_ID`        | Role ID to mention for contest announcements   | -                                 |
| `CONTEST_DAYS_AHEAD`     | Number of days to look ahead for contests      | 7                                 |
| `CONTEST_CHECK_SCHEDULE` | Cron schedule expression for checking contests | `0 12 * * *` (daily at 12:00 UTC) |
| `CODEFORCES_API_KEY`     | Codeforces API key (optional)                  | -                                 |
| `CODEFORCES_API_SECRET`  | Codeforces API secret (optional)               | -                                 |
| `ATCODER_API_KEY`        | AtCoder API key (optional)                     | -                                 |
| `LOG_LEVEL`              | Logging level (debug, info, warn, error)       | info                              |
| `PORT`                   | Port for the health check server               | 3000                              |

## Usage

### Bot Commands

- `!contests` - Manually check for upcoming contests
- `!health` - Check the bot's connection status to various services
- `!help` - Show a list of available commands

### Scheduled Announcements

The bot automatically checks for upcoming contests based on the configured schedule and sends announcements for contests happening within the configured time period.

### Health Monitoring

The bot includes a built-in health monitoring system that checks:

- Connection to Discord API
- Connection to Codeforces API
- Connection to AtCoder API

To check the health of your bot:

1. Use the `!health` command in Discord
2. For Railway deployments, visit your service URL + `/health` endpoint

## API Notes

- The public Codeforces API currently doesn't require authentication, but the bot supports API keys if they're needed in the future
- The AtCoder API used is an unofficial API that doesn't require authentication
- If either service changes their API requirements, update the respective keys in your environment variables

## License

ISC
