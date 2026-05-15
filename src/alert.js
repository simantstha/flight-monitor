import nodemailer from 'nodemailer';

const THRESHOLD_MSP = Number(process.env.PRICE_THRESHOLD_MSP_USD ?? 1400);
const THRESHOLD_ORD = Number(process.env.PRICE_THRESHOLD_ORD_USD ?? 1100);

export async function maybeAlert(route, result) {
  const threshold = route === 'KTM-MSP' ? THRESHOLD_MSP : THRESHOLD_ORD;
  if (result.price_per_person_usd > threshold) return false;

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_FROM,
      pass: process.env.EMAIL_PASS,
    },
  });

  const dest = route === 'KTM-MSP' ? 'MSP' : 'ORD';
  await transporter.sendMail({
    from: process.env.EMAIL_FROM,
    to: process.env.EMAIL_TO,
    subject: `✈️ PRICE ALERT: KTM→${dest} at $${result.price_per_person_usd}/person — book now!`,
    html: `
      <h2>Flight Price Alert 🎉</h2>
      <table style="border-collapse:collapse;font-family:sans-serif">
        <tr><td><b>Route</b></td><td>${route}</td></tr>
        <tr><td><b>Price/person</b></td><td>$${result.price_per_person_usd}</td></tr>
        <tr><td><b>Total for 2</b></td><td>$${result.total_for_2_usd}</td></tr>
        <tr><td><b>Airline</b></td><td>${result.airline}</td></tr>
        <tr><td><b>Outbound</b></td><td>${result.outbound_route} (${result.outbound_dates})</td></tr>
        <tr><td><b>Return</b></td><td>${result.return_route} (${result.return_dates})</td></tr>
        <tr><td><b>Stops</b></td><td>${result.stops} (max layover ${result.max_layover_hours}h)</td></tr>
        <tr><td><b>Source</b></td><td>${result.source}</td></tr>
        <tr><td><b>Confidence</b></td><td>${result.confidence}</td></tr>
      </table>
      ${result.booking_url ? `<p style="margin-top:16px"><a href="${result.booking_url}" style="background:#1a73e8;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:bold;font-family:sans-serif">Book this flight →</a></p>` : ''}
    `,
  });

  return true;
}
