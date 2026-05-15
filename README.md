# Flight Price Monitor

Monitors KTM→MSP and KTM→ORD round-trip flight prices every 6 hours using Anthropic's web search. Sends Gmail alerts when prices drop below your threshold.

## Setup

### 1. Clone and install

```bash
git clone https://github.com/<you>/flight-monitor.git
cd flight-monitor
npm install
```

### 2. Configure environment

Copy `.env.example` to `.env` and fill in your values:

```bash
cp .env.example .env
```

| Variable | Description |
|---|---|
| `ANTHROPIC_API_KEY` | Your Anthropic API key |
| `EMAIL_FROM` | Gmail address to send alerts from |
| `EMAIL_TO` | Email address to receive alerts |
| `EMAIL_PASS` | Gmail App Password (see below) |
| `PRICE_THRESHOLD_USD` | Alert threshold per person in USD (default: 1500) |

### 3. Gmail App Password

1. Go to your Google Account → Security → 2-Step Verification (must be enabled)
2. At the bottom, click **App passwords**
3. Select app: **Mail**, device: **Other** → name it "flight-monitor"
4. Copy the 16-character password into `EMAIL_PASS`

### 4. Test locally

```bash
node src/checker.js
```

Check `data/history.json` for logged results.

## GitHub Actions (automated every 6 hours)

### Add repository secrets

In your GitHub repo → Settings → Secrets and variables → Actions → New repository secret:

- `ANTHROPIC_API_KEY`
- `EMAIL_FROM`
- `EMAIL_TO`
- `EMAIL_PASS`
- `PRICE_THRESHOLD_USD` (optional, defaults to 1500)

The workflow runs automatically at 00:00, 06:00, 12:00, and 18:00 UTC. You can also trigger it manually from the **Actions** tab → **Flight Price Monitor** → **Run workflow**.

## Reading history.json

Each entry in `data/history.json` contains:

```json
{
  "checked_at": "2026-06-01T06:00:00.000Z",
  "route": "KTM-MSP",
  "price_per_person": 1320,
  "total_for_2": 2640,
  "airline": "Qatar Airways",
  "stops": 1,
  "max_layover_hours": 2.5,
  "alert_sent": true,
  "confidence": "high"
}
```

History is committed back to the repo automatically after each GitHub Actions run so you have a full price history over time.

## Routes monitored

- **KTM→MSP**: Kathmandu → Minneapolis-Saint Paul (outbound June 2026, return September 2026)
- **KTM→ORD**: Kathmandu → Chicago O'Hare (outbound June 2026, return September 2026)

Maximum 1 layover each way, preferring connections under 4 hours.
