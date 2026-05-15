import Anthropic from '@anthropic-ai/sdk';
import { maybeAlert } from './alert.js';
import { logResult } from './logger.js';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const ROUTES = [
  { id: 'KTM-MSP', dest: 'Minneapolis-Saint Paul MSP' },
  { id: 'KTM-ORD', dest: 'Chicago O\'Hare ORD' },
];

function buildPrompt(dest) {
  return `Search Google Flights, Kayak, Skyscanner, and Qatar Airways directly for the cheapest available round-trip economy flights from Kathmandu (KTM) to ${dest} for 2 passengers. Outbound: any date in June 2026. Return: any date in September 2026.
CRITICAL REQUIREMENT: maximum 1 layover each way, prefer layovers under 4 hours. These are elderly passengers who cannot handle long connections.
You MUST provide specific travel dates (e.g. "June 14, 2026"), not just month names.
You MUST find and include the actual URL where this fare can be booked or viewed — a direct link to Google Flights, Kayak, Skyscanner, or the airline site showing this itinerary. Do not return a generic homepage.
Return ONLY a JSON object with these exact fields, no other text:
{
  "price_per_person_usd": number,
  "total_for_2_usd": number,
  "airline": string,
  "outbound_route": string,
  "return_route": string,
  "outbound_dates": string (specific date e.g. "June 14, 2026"),
  "return_dates": string (specific date e.g. "September 5, 2026"),
  "max_layover_hours": number,
  "stops": number,
  "source": string,
  "booking_url": string,
  "confidence": "high" | "medium" | "low"
}`;
}

function extractJson(text) {
  // Try direct parse first
  try {
    return JSON.parse(text.trim());
  } catch {}

  // Extract JSON block from markdown or surrounding text
  const match = text.match(/\{[\s\S]*\}/);
  if (match) {
    try {
      return JSON.parse(match[0]);
    } catch {}
  }
  return null;
}

async function checkRoute(route) {
  console.log(`\n[${new Date().toISOString()}] Checking ${route.id}...`);

  let result = null;

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const response = await client.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        tools: [{ type: 'web_search_20250305', name: 'web_search' }],
        messages: [{ role: 'user', content: buildPrompt(route.dest) }],
      });

      // Collect all text content from the response
      const text = response.content
        .filter((b) => b.type === 'text')
        .map((b) => b.text)
        .join('\n');

      result = extractJson(text);
      if (result) break;

      console.warn(`Attempt ${attempt}: could not parse JSON from response. Retrying...`);
    } catch (err) {
      console.error(`Attempt ${attempt} API error for ${route.id}:`, err.message);
      if (attempt === 3) throw err;
    }
  }

  if (!result) {
    console.error(`Failed to get valid JSON for ${route.id} after 3 attempts.`);
    return;
  }

  console.log(`  Price/person: $${result.price_per_person_usd} | Airline: ${result.airline} | Stops: ${result.stops}`);

  const alertSent = await maybeAlert(route.id, result);
  if (alertSent) console.log(`  Alert sent!`);

  logResult({
    checked_at: new Date().toISOString(),
    route: route.id,
    price_per_person: result.price_per_person_usd,
    total_for_2: result.total_for_2_usd,
    airline: result.airline,
    stops: result.stops,
    max_layover_hours: result.max_layover_hours,
    alert_sent: alertSent,
    confidence: result.confidence,
  });
}

async function main() {
  for (const route of ROUTES) {
    try {
      await checkRoute(route);
    } catch (err) {
      console.error(`Error processing ${route.id}:`, err.message);
      // Exit 0 so GitHub Actions doesn't show red on transient failures
    }
  }
  console.log('\nDone.');
}

main().catch((err) => {
  console.error('Fatal error:', err.message);
  process.exit(0);
});
