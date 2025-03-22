# Discord Codeforces & AtCoder Contest Bot

A Discord bot that provides timely reminders for upcoming Codeforces and AtCoder programming contests.

## Features

- **Timely Contest Reminders**: Automatically sends reminders at 1 day, 6 hours, and 30 minutes before each contest
- **Individual Contest Notifications**: Each contest gets its own message with formatted details, avoiding cluttered lists
- **Customizable Commands**: Check for contests today, tomorrow, or get a full list
- **Smart Filtering**: Only sends reminders for contests that are at least 6 hours away when checking today's contests
- **Multiple Data Sources**: Uses Codeforces API and multiple sources for AtCoder (Clist.by, direct website scraping, and AtCoder Problems API)
- **Localized Time Display**: Shows contest times in your preferred timezone (e.g., Bangladesh time)
- **Optimized for Railway Deployment**: Includes health checks and monitoring with automatic port selection
- **Automatic Scheduling**: Refreshes contest information daily
- **Resilient Architecture**: Multiple fallback methods for fetching contest data

## Bot Commands

- `!contests` - Show a list of all upcoming contests (next 7 days by default)
- `!today` - Check if there are any contests happening today
- `!tomorrow` - Check if there are any contests scheduled for tomorrow
- `!atcoder` - Show upcoming AtCoder contests specifically (looking ahead 60 days)
- `!setup-reminders` - Manually set up contest reminders
- `!health` - Check the bot's connection status to various services
- `!help` - Show a list of available commands

## How It Works

The bot fetches contest information from multiple sources and schedules automated reminders:

1. **Contest Fetch**:
   - Retrieves Codeforces data from the public Codeforces API
   - Fetches AtCoder contests using multiple methods:
     - Clist.by API (primary method)
     - Direct AtCoder website scraping (backup)
     - AtCoder Problems API (fallback)
2. **Smart Timeframes**: Looks up to 45 days ahead for AtCoder contests while keeping the default 7-day window for Codeforces
3. **Reminder Scheduling**: Sets up scheduled reminders for each contest at specified intervals
4. **Targeted Notifications**: Sends individual contest announcements rather than cluttered lists
5. **Daily Refresh**: Updates contest information and reminders daily
6. **Timezone Support**: Displays all times in your configured timezone (e.g., Asia/Dhaka for Bangladesh)

## File Structure and Purpose

- `index.js` - Main entry point with Discord bot setup and command handling
- `services/contestService.js` - Contest data fetching from various platforms with multi-source fallback
- `services/reminderService.js` - Handles scheduling and sending timed reminders
- `utils/embedFormatter.js` - Formats contest data into Discord embedded messages with timezone support
- `utils/healthCheck.js` - Provides functions to check API connectivity

## Health Check and Port Management

The bot includes an HTTP server for health checks that:

- Starts on port 3000 by default
- Automatically finds the next available port if 3000 is busy
- Provides `/health` endpoint to check API connections
- Reports the status of Discord, Codeforces, and AtCoder connections

## Reminder System

Instead of sending one large message with all contests, the bot sends:

- **1 Day Before**: A reminder for each contest happening tomorrow
- **6 Hours Before**: A reminder as the contest approaches soon
- **30 Minutes Before**: A final reminder just before the contest starts

Each reminder includes:

- Contest name and platform (Codeforces or AtCoder)
- Date and time information in your local timezone
- Link to the contest page

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

### Setting Up Environment Variables

Copy the `.env.example` file to `.env` and fill in:

```
DISCORD_TOKEN=your_bot_token
DISCORD_CHANNEL_ID=your_announcement_channel_id
CLIST_USERNAME=your_clist_username
CLIST_API_KEY=your_clist_api_key
TIMEZONE=Asia/Dhaka  # For Bangladesh time
CONTEST_ROLE_ID=optional_role_to_mention  # Optional
CONTEST_CHECK_SCHEDULE=0 12 * * *  # Daily at 12:00 UTC (cron format)
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

| Variable                 | Description                                  | Default         | Required |
| ------------------------ | -------------------------------------------- | --------------- | -------- |
| `DISCORD_TOKEN`          | Discord bot token                            | -               | Yes      |
| `DISCORD_CHANNEL_ID`     | Channel ID for contest announcements         | -               | Yes      |
| `CLIST_USERNAME`         | Clist.by username                            | -               | Yes\*    |
| `CLIST_API_KEY`          | Clist.by API key                             | -               | Yes\*    |
| `TIMEZONE`               | Timezone for displaying dates and times      | UTC             | No       |
| `CONTEST_ROLE_ID`        | Role ID to mention for contest announcements | -               | No       |
| `CONTEST_DAYS_AHEAD`     | Number of days to look ahead for contests    | 7               | No       |
| `CONTEST_CHECK_SCHEDULE` | Cron schedule for checking contests          | '0 12 \* \* \*' | No       |
| `PORT`                   | Port for the health check server             | 3000            | No       |

\*Required for reliable AtCoder contest information. The bot will fall back to AtCoder Problems API if not provided.

## API Notes

- **Codeforces API**: The bot uses the public Codeforces API which doesn't require authentication. API keys in the configuration are included for future compatibility but are not currently used.

- **AtCoder Data Sources**: The bot uses three methods to fetch AtCoder contests, in order of priority:

  1. **Clist.by API**: Requires credentials and provides comprehensive contest data
  2. **Direct AtCoder Website**: Falls back to scraping the AtCoder website if Clist.by fails
  3. **AtCoder Problems API**: Used as a last resort if other methods fail

- **Extended Timeframe for AtCoder**: The bot looks up to 45 days ahead for AtCoder contests while respecting the standard timeframe (default: 7 days) for display and notifications.

## Timezone Configuration

For Bangladesh time, use `TIMEZONE=Asia/Dhaka` in your .env file. This will display all dates and times in Bangladesh Standard Time (UTC+6).

Common timezone options:

- `Asia/Dhaka` - Bangladesh
- `Asia/Kolkata` - India
- `Asia/Tokyo` - Japan
- `Europe/London` - UK
- `America/New_York` - US Eastern
- `America/Los_Angeles` - US Pacific

## License

ISC

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
   - `!atcoder` - Shows upcoming AtCoder contests looking ahead 60 days
   - `!setup-reminders` - Manually set up contest reminders
   - `!health` - Check the bot's connection status to various APIs
   - `!help` - Shows available commands

### What to Expect

- **First Messages**: After starting the bot, you won't receive any messages immediately unless there's a contest happening soon (within the next day).
- **Regular Reminders**: As contest times approach, you'll receive reminder messages at the scheduled intervals.
- **Message Format**: Each reminder is a separate Discord embed containing:
  - Contest name and platform
  - Date and time (in your configured timezone)
  - Link to the contest page
  - Color coding (blue for day notifications, yellow for hours, red for minutes)

All times shown by the bot will be in your configured timezone (set via the `TIMEZONE` environment variable, e.g., `Asia/Dhaka` for Bangladesh time).

### Troubleshooting

If you don't see any messages:

1. Check if there are upcoming contests within 7 days (or your configured `CONTEST_DAYS_AHEAD` value)
2. Verify your `DISCORD_CHANNEL_ID` is set correctly
3. Use `!health` command to check API connections
4. Check your console logs for any errors

If you don't see AtCoder contests:

1. Try the `!atcoder` command which looks ahead 60 days specifically for AtCoder contests
2. Ensure your Clist.by credentials are correct in the .env file
3. Check if there are any upcoming AtCoder contests on the [AtCoder website](https://atcoder.jp/contests/)
4. Verify your internet connection can reach atcoder.jp
