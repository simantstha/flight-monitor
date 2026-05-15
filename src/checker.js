import { maybeAlert } from './alert.js';
import { logResult } from './logger.js';

const SERPAPI_KEY = process.env.SERPAPI_KEY;

const ROUTES = [
  { id: 'KTM-MSP', from: 'KTM', to: 'MSP' },
  { id: 'KTM-ORD', from: 'KTM', to: 'ORD' },
];

// Search dates — representative mid-month dates
const OUTBOUND_DATE = '2026-06-15';
const RETURN_DATE = '2026-09-15';
const MAX_LAYOVER_MINUTES = 240; // 4 hours

async function searchFlights(from, to) {
  const params = new URLSearchParams({
    engine: 'google_flights',
    departure_id: from,
    arrival_id: to,
    outbound_date: OUTBOUND_DATE,
    return_date: RETURN_DATE,
    currency: 'USD',
    hl: 'en',
    type: '1',         // round trip
    travel_class: '1', // economy
    adults: '2',
    stops: '2',        // 1 stop or fewer
    api_key: SERPAPI_KEY,
  });

  const res = await fetch(`https://serpapi.com/search.json?${params}`);
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`SerpApi ${res.status}: ${body}`);
  }
  return res.json();
}

function pickBest(data) {
  const all = [...(data.best_flights ?? []), ...(data.other_flights ?? [])];
  if (!all.length) return null;

  // Filter: all layovers must be under 4 hours
  const valid = all.filter((item) => {
    const layovers = item.layovers ?? [];
    return layovers.every((l) => l.duration <= MAX_LAYOVER_MINUTES);
  });

  if (!valid.length) return null;

  // Pick cheapest
  return valid.reduce((min, item) => (item.price < min.price ? item : min));
}

function formatRoute(flights) {
  const airports = flights.map((f) => f.departure_airport.id);
  airports.push(flights.at(-1).arrival_airport.id);
  return airports.join(' → ');
}

function buildKayakUrl(from, to) {
  return `https://www.kayak.com/flights/${from}-${to}/${OUTBOUND_DATE}/${RETURN_DATE}/2adults?sort=price_a&stops=1`;
}

async function checkRoute(route) {
  console.log(`\n[${new Date().toISOString()}] Checking ${route.id}...`);

  const data = await searchFlights(route.from, route.to);
  const best = pickBest(data);

  if (!best) {
    console.warn(`  No valid flights found for ${route.id} (all exceeded layover limit or no results).`);
    return;
  }

  const outboundFlights = best.flights.slice(0, best.flights.length / 2 | 0) || best.flights;
  const pricePerPerson = Math.round(best.price / 2);
  const maxLayover = Math.max(...(best.layovers ?? []).map((l) => l.duration)) / 60;
  const stops = (best.layovers ?? []).length;
  const airline = best.flights[0].airline;
  const outboundRoute = formatRoute(best.flights.slice(0, stops + 1));
  const returnRoute = `${route.to} → ... → ${route.from}`;

  console.log(`  Price/person: $${pricePerPerson} | Total: $${best.price} | Airline: ${airline} | Stops: ${stops}`);

  const result = {
    price_per_person_usd: pricePerPerson,
    total_for_2_usd: best.price,
    airline,
    outbound_route: outboundRoute,
    return_route: returnRoute,
    outbound_dates: OUTBOUND_DATE,
    return_dates: RETURN_DATE,
    max_layover_hours: Math.round(maxLayover * 10) / 10,
    stops,
    source: 'Google Flights (via SerpApi)',
    booking_url: buildKayakUrl(route.from, route.to),
    confidence: 'high',
  };

  const alertSent = await maybeAlert(route.id, result);
  if (alertSent) console.log(`  Alert sent!`);

  logResult({
    checked_at: new Date().toISOString(),
    route: route.id,
    price_per_person: pricePerPerson,
    total_for_2: best.price,
    airline,
    stops,
    max_layover_hours: result.max_layover_hours,
    alert_sent: alertSent,
    confidence: 'high',
  });
}

async function main() {
  if (!SERPAPI_KEY) {
    console.error('SERPAPI_KEY is not set.');
    process.exit(0);
  }

  for (const route of ROUTES) {
    try {
      await checkRoute(route);
    } catch (err) {
      console.error(`Error processing ${route.id}:`, err.message);
    }
  }
  console.log('\nDone.');
}

main().catch((err) => {
  console.error('Fatal error:', err.message);
  process.exit(0);
});
