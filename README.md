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

- **Timezone Support**:

  - Configure your local timezone for displaying contest times
  - Default support for Bangladesh time (Asia/Dhaka)
  - All times displayed in your configured timezone

- **Optimized Performance**:
  - Reduced API calls with smart caching
  - Fallback mechanisms for API failures
  - Detailed but concise logging

## Setup

### Prerequisites

- Node.js 16+
- Discord Bot Token
- Clist.by API credentials (for reliable contest data)

### Environment Variables

Create a `.env` file in the root directory with the following variables:

```
# Required Discord Bot Configuration
DISCORD_TOKEN=your_discord_bot_token
DISCORD_CHANNEL_ID=your_discord_channel_id

# Optional Discord Configuration
CONTEST_ROLE_ID=role_id_to_mention_for_contests

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

### Common Timezone Options

- `Asia/Dhaka` - Bangladesh
- `UTC` - Coordinated Universal Time
- `America/New_York` - US Eastern Time
- `Europe/London` - UK Time
- `Asia/Kolkata` - India
- `Asia/Tokyo` - Japan

## Troubleshooting

### AtCoder Contest Issues

If you're having trouble with AtCoder contests not showing up:

1. **Check Clist.by API Credentials**: Ensure your credentials are correct
2. **Resource ID**: The bot automatically detects the correct resource ID (typically 93)
3. **Fallback System**: The bot will automatically fall back to direct scraping if the API fails
4. **Rate Limiting**: If you see 429 errors, the bot is being rate-limited by Clist.by API

### API Health Check

Use the `!health` command to check the status of all contest APIs. This will help diagnose any issues with fetching contests.

## Contributing

Contributions are welcome! Feel free to open issues or submit pull requests.

## License

ISC
