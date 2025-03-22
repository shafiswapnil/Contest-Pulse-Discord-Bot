# Discord Codeforces & AtCoder Contest Bot

A Discord bot that provides timely reminders for upcoming Codeforces and AtCoder programming contests.

## Features

- **Timely Contest Reminders**: Automatically sends reminders at 1 day, 6 hours, and 30 minutes before each contest
- **Individual Contest Notifications**: Each contest gets its own message with formatted details, avoiding cluttered lists
- **Customizable Commands**: Check for contests today, tomorrow, or get a full list
- **Smart Filtering**: Only sends reminders for contests that are at least 6 hours away when checking today's contests
- **Multiple Data Sources**: Uses both Codeforces API and Clist.by for reliable contest information
- **Localized Time Display**: Shows contest times in your preferred timezone (e.g., Bangladesh time)
- **Optimized for Railway Deployment**: Includes health checks and monitoring
- **Automatic Scheduling**: Refreshes contest information daily

## Bot Commands

- `!contests` - Show a list of all upcoming contests
- `!today` - Check if there are any contests happening today
- `!tomorrow` - Check if there are any contests scheduled for tomorrow
- `!setup-reminders` - Manually set up contest reminders
- `!health` - Check the bot's connection status to various services
- `!help` - Show a list of available commands

## How It Works

The bot fetches contest information from multiple sources and schedules automated reminders:

1. **Contest Fetch**: Retrieves data from Codeforces API and Clist.by (for AtCoder)
2. **Reminder Scheduling**: Sets up scheduled reminders for each contest at specified intervals
3. **Targeted Notifications**: Sends individual contest announcements rather than cluttered lists
4. **Daily Refresh**: Updates contest information and reminders daily
5. **Timezone Support**: Displays all times in your configured timezone (e.g., Asia/Dhaka for Bangladesh)

## Reminder System

Instead of sending one large message with all contests, the bot sends:

- **1 Day Before**: A reminder for each contest happening tomorrow
- **6 Hours Before**: A reminder as the contest approaches soon
- **30 Minutes Before**: A final reminder just before the contest starts

Each reminder includes:

- Contest name and platform (Codeforces or AtCoder)
- Date and time information in your local timezone
- Link to the contest page

## File Structure and Purpose

- `index.js` - Main entry point with Discord bot setup and command handling
- `services/contestService.js` - Contest data fetching from various platforms
- `services/reminderService.js` - Handles scheduling and sending timed reminders
- `utils/embedFormatter.js` - Formats contest data into Discord embedded messages with timezone support
- `utils/healthCheck.js` - Provides functions to check API connectivity

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
