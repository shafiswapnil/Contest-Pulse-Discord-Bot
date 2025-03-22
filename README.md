# Contest Pulse | Discord Bot

A Discord bot that provides timely reminders for upcoming programming contests on Codeforces and AtCoder platforms.

## Features

- **Reliable Contest Tracking**: Fetches contests from multiple sources to ensure complete coverage:

  - Codeforces API (direct)
  - AtCoder via Clist.by API (ID 93) with fallback to direct scraping
  - Automatic resource ID detection for AtCoder contests

- **Smart Reminder System**:

  - Sends contest reminders at 1 day, 6 hours, and 30 minutes before each contest
  - Individual contest notifications for clarity
  - Skips reminders for contests less than 6 hours away in the `!today` command to reduce clutter

- **Commands**:

  - `!contests` - Shows all upcoming contests within the configured timeframe
  - `!today` - Shows contests happening today with time until start
  - `!tomorrow` - Shows contests happening tomorrow
  - `!setup-reminders` - Manually refreshes contest data and reschedules reminders
  - `!health` - Performs a health check on the contest APIs
  - `!help` - Shows a list of available commands

- **Timezone Support**:

  - Configure your local timezone for displaying contest times
  - Default support for Bangladesh time (Asia/Dhaka)
  - All times displayed in your configured timezone

- **Optimized Performance**:
  - Reduced API calls with smart caching
  - Fallback mechanisms for API failures
  - Detailed but concise logging

## How It Works

The bot fetches contest information from multiple sources and schedules automated reminders:

1. **Contest Fetch**:
   - Retrieves Codeforces data from the public Codeforces API
   - Fetches AtCoder contests using multiple methods:
     - Clist.by API (primary method, using resource ID 93)
     - Direct AtCoder website scraping (backup)
     - AtCoder Problems API (fallback)
2. **Reminder Scheduling**: Sets up scheduled reminders for each contest at specified intervals
3. **Targeted Notifications**: Sends individual contest announcements rather than cluttered lists
4. **Daily Refresh**: Updates contest information and reminders daily
5. **Timezone Support**: Displays all times in your configured timezone (e.g., Asia/Dhaka for Bangladesh)

## File Structure and Purpose

- `index.js` - Main entry point with Discord bot setup and command handling
- `services/contestService.js` - Contest data fetching from various platforms with multi-source fallback
- `services/reminderService.js` - Handles scheduling and sending timed reminders
- `utils/embedFormatter.js` - Formats contest data into Discord embedded messages with timezone support
- `utils/healthCheck.js` - Provides functions to check API connectivity

## Message Channels

The bot handles message destinations intelligently:

- **Scheduled Reminders**: All automatic reminders (1 day, 6 hours, 30 minutes before contests) and daily scheduled checks are sent to the channel specified by `DISCORD_CHANNEL_ID` in your .env file.
- **Command Responses**: When users run commands like `!contests`, `!today`, or `!tomorrow`, the responses are sent to the same channel where the command was issued. This allows users to use commands in any channel while keeping scheduled announcements centralized.

## Setup

### Creating a Discord Bot

1. Go to the [Discord Developer Portal](https://discord.com/developers/applications)
2. Click "New Application" and give your bot a name
3. Go to the "Bot" tab in the left sidebar
4. Click "Add Bot" and confirm
5. Under "Privileged Gateway Intents", enable:
   - **SERVER MEMBERS INTENT**
   - **MESSAGE CONTENT INTENT**
6. Save changes

### Getting Clist.by API Credentials (For AtCoder Contests)

1. Go to [Clist.by](https://clist.by/) and create an account
2. After signing in, go to your profile page
3. Note your API key and username for your `.env` file

### Inviting the Bot to Your Server

1. Go to the "OAuth2" > "URL Generator" tab in the Discord Developer Portal
2. Select `bot` and `applications.commands` scopes
3. Select necessary permissions (Read Messages, Send Messages, Embed Links, etc.)
4. Copy and open the generated URL
5. Select your server and authorize the bot

### Environment Variables

Create a `.env` file in the root directory with the following variables:

```
# Required Discord Bot Configuration
DISCORD_TOKEN=your_discord_bot_token
DISCORD_CHANNEL_ID=your_discord_channel_id

# Optional Discord Configuration
CONTEST_ROLE_ID=role_id_to_mention_for_contests
ADMIN_ROLE_ID=your_admin_role_id

# Clist.by API Credentials (required for reliable AtCoder contest data)
CLIST_USERNAME=your_clist_username
CLIST_API_KEY=your_clist_api_key

# Optional Contest Notification Settings
CONTEST_DAYS_AHEAD=7
CONTEST_CHECK_SCHEDULE=0 12 * * *

# Timezone Configuration (Bangladesh time by default)
TIMEZONE=Asia/Dhaka

# Optional Log Level
LOG_LEVEL=info

# Server Configuration (for health check endpoint)
PORT=3000
```

### Local Development

```bash
git clone https://github.com/yourusername/discord-codeforces-bot.git
cd discord-codeforces-bot
npm install
cp .env.example .env
# Edit .env with your credentials
npm run dev
```

### Railway Deployment

1. Push your code to GitHub
2. Create a new project on [Railway](https://railway.app/)
3. Connect to your GitHub repository
4. Add the required environment variables
5. Railway will automatically deploy your bot

## Configuration Options

| Variable                 | Description                                                                                      | Default         | Required |
| ------------------------ | ------------------------------------------------------------------------------------------------ | --------------- | -------- |
| `DISCORD_TOKEN`          | Discord bot token                                                                                | -               | Yes      |
| `DISCORD_CHANNEL_ID`     | Channel ID for scheduled reminders (command responses go to the channel where commands are used) | -               | Yes      |
| `CLIST_USERNAME`         | Clist.by username                                                                                | -               | Yes\*    |
| `CLIST_API_KEY`          | Clist.by API key                                                                                 | -               | Yes\*    |
| `TIMEZONE`               | Timezone for displaying dates and times                                                          | UTC             | No       |
| `CONTEST_ROLE_ID`        | Role ID to mention for contest announcements                                                     | -               | No       |
| `ADMIN_ROLE_ID`          | Role ID that can use administrative commands                                                     | -               | No       |
| `CONTEST_DAYS_AHEAD`     | Number of days to look ahead for contests                                                        | 7               | No       |
| `CONTEST_CHECK_SCHEDULE` | Cron schedule for checking contests                                                              | '0 12 \* \* \*' | No       |
| `PORT`                   | Port for the health check server                                                                 | 3000            | No       |

\*Required for reliable AtCoder contest information. The bot will fall back to direct scraping if not provided.

## Timezone Configuration

For Bangladesh time, use `TIMEZONE=Asia/Dhaka` in your .env file. This will display all dates and times in Bangladesh Standard Time (UTC+6).

### Common Timezone Options

- `Asia/Dhaka` - Bangladesh
- `UTC` - Coordinated Universal Time
- `America/New_York` - US Eastern Time
- `Europe/London` - UK Time
- `Asia/Kolkata` - India
- `Asia/Tokyo` - Japan
- `America/Los_Angeles` - US Pacific

## Admin Role Setup

To restrict administrative commands to specific users:

1. Create a role in your Discord server (e.g., "Contest Bot Admin")
2. Right-click on the role and select "Copy ID" (make sure Developer Mode is enabled in Discord settings)
3. Add the role ID to your `.env` file as `ADMIN_ROLE_ID`
4. Assign this role to users who should have administrative access to the bot

Users with this role will be able to use commands like:

- `!setup-reminders` - Manually set up contest reminders
- `!refresh-contests` - Force refresh contest data
- `!status` - View detailed bot status

## Bot Behavior

### What Happens When You First Run the Bot

When you first start the bot, the following sequence of events occurs:

1. **Initial Connection**: The bot connects to Discord and logs in with your credentials.
2. **Health Check Server**: A health check HTTP server starts on port 3000 (or the next available port if 3000 is busy).
3. **Daily Contest Check Schedule**: The bot sets up a daily schedule to check for new contests, typically at 12:00 UTC (configurable via `CONTEST_CHECK_SCHEDULE`).
4. **Initial Contest Fetch**: The bot immediately fetches upcoming contests from:
   - Codeforces API (public, no authentication needed)
   - AtCoder contests via multiple sources (Clist.by, direct website, AtCoder Problems API)
5. **Reminder Scheduling**: For each upcoming contest found, the bot schedules reminder messages at:
   - 1 day before the contest
   - 6 hours before the contest
   - 30 minutes before the contest

The bot logs all these activities to the console so you can verify it's working correctly.

### Ongoing Bot Behavior

Once running, the bot operates on these schedules:

1. **Daily Contest Refresh**: Every day at the scheduled time (default: 12:00 UTC), the bot will:

   - Fetch the latest contest information
   - Schedule new reminders for any newly discovered contests
   - The refresh ensures you always have the most up-to-date contest information

2. **Automated Reminders**: When a scheduled reminder time is reached, the bot will:

   - Send a message to your configured Discord channel
   - Tag the contest role if you configured one with `CONTEST_ROLE_ID`
   - Include formatted contest information with correct time in your timezone

3. **On-Demand Commands**: You can also interact with the bot using commands:
   - `!contests` - Shows all upcoming contests in the next 7 days
   - `!today` - Shows contests happening today
   - `!tomorrow` - Shows contests happening tomorrow
   - `!setup-reminders` - Manually set up contest reminders
   - `!health` - Check the bot's connection status to various APIs
   - `!help` - Shows available commands

### What to Expect

- **First Messages**: After starting the bot, you won't receive any messages immediately unless there's a contest happening soon (within the next day).
- **Regular Reminders**: As contest times approach, you'll receive reminder messages at the scheduled intervals in your configured announcement channel.
- **Command Responses**: When users run commands like `!contests`, the responses will appear in the same channel where the command was issued.
- **Message Format**: Each reminder is a separate Discord embed containing:
  - Contest name and platform
  - Date and time (in your configured timezone)
  - Link to the contest page
  - Color coding (blue for day notifications, yellow for hours, red for minutes)

All times shown by the bot will be in your configured timezone (set via the `TIMEZONE` environment variable, e.g., `Asia/Dhaka` for Bangladesh time).

## Troubleshooting

### General Issues

If you don't see any messages:

1. Check if there are upcoming contests within 7 days (or your configured `CONTEST_DAYS_AHEAD` value)
2. Verify your `DISCORD_CHANNEL_ID` is set correctly for scheduled reminders
3. For command responses, ensure you're looking in the channel where you typed the command
4. Use `!health` command to check API connections
5. Check your console logs for any errors

### AtCoder Contest Issues

If you're having trouble with AtCoder contests not showing up:

1. **Check Clist.by API Credentials**: Ensure your credentials are correct
2. **Resource ID**: The bot automatically detects the correct resource ID (typically 93)
3. **Fallback System**: The bot will automatically fall back to direct scraping if the API fails
4. **Rate Limiting**: If you see 429 errors, the bot is being rate-limited by Clist.by API
5. Check if there are any upcoming AtCoder contests on the [AtCoder website](https://atcoder.jp/contests/)
6. Verify your internet connection can reach atcoder.jp

### API Health Check

Use the `!health` command to check the status of all contest APIs. This will help diagnose any issues with fetching contests.

## Contributing

Contributions are welcome! Feel free to open issues or submit pull requests.

## License

[AGPLv3](LICENSE)
