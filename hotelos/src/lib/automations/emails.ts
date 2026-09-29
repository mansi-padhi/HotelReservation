import type { Folio, FolioItem, Hotel, ReservationView } from '../types'
import { inr, prettyDate } from '../utils'

const shell = (hotel: Hotel, title: string, body: string) => `
<div style="background:#f4f6f5;padding:32px 12px;font-family:Inter,Segoe UI,Arial,sans-serif;color:#0d1117">
  <table role="presentation" width="100%" style="max-width:560px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;border:1px solid #e5e9e7">
    <tr><td style="background:#0d1117;padding:22px 28px;color:#fff">
      <div style="font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:#3ed160">${hotel.name}</div>
      <div style="font-size:22px;font-weight:700;margin-top:6px">${title}</div>
    </td></tr>
    <tr><td style="padding:26px 28px;font-size:15px;line-height:1.6">${body}</td></tr>
    <tr><td style="padding:16px 28px;background:#f8faf9;color:#6b7280;font-size:12px">${hotel.address} · ${hotel.phone} · ${hotel.email}</td></tr>
  </table>
</div>`

const row = (k: string, v: string) =>
  `<tr><td style="padding:6px 0;color:#6b7280">${k}</td><td style="padding:6px 0;text-align:right;font-weight:600">${v}</td></tr>`

export function bookingEmailHTML(res: ReservationView, hotel: Hotel, checkinUrl: string) {
  return shell(
    hotel,
    'Your booking is confirmed',
    `<p>Hi ${res.guest.name.split(' ')[0]},</p>
     <p>We can't wait to host you. Here are your booking details:</p>
     <table width="100%" style="border-collapse:collapse;margin:14px 0">
       ${row('Booking', res.code)}
       ${row('Check-in', prettyDate(res.check_in, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }))}
       ${row('Check-out', prettyDate(res.check_out, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }))}
       ${row('Room', `${res.room.type} · ${res.room.number}`)}
       ${row('Guests', `${res.adults} adult${res.adults > 1 ? 's' : ''}${res.children ? `, ${res.children} child` : ''}`)}
       ${row('Total', inr(res.grand_total))}
     </table>
     <p style="margin:22px 0"><a href="${checkinUrl}" style="background:#3ed160;color:#06260f;text-decoration:none;padding:12px 20px;border-radius:10px;font-weight:700;display:inline-block">Skip the front desk — check in online</a></p>
     <p style="color:#6b7280;font-size:13px">Upload your ID, sign and pay in 2 minutes. Your room key will be waiting.</p>`,
  )
}

export function checkinEmailHTML(res: ReservationView, hotel: Hotel, links: { account: string; invoiceHint?: string }) {
  const long = { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' } as const
  return shell(
    hotel,
    `You’re checked in — welcome, ${res.guest.name.split(' ')[0]}!`,
    `<div style="text-align:center;margin:4px 0 22px">
       <div style="display:inline-block;background:#0d1117;color:#fff;border-radius:16px;padding:18px 34px">
         <div style="font-size:11px;letter-spacing:.2em;text-transform:uppercase;color:#3ed160">Your room</div>
         <div style="font-size:44px;font-weight:700;line-height:1.1;margin-top:4px">${res.room.number}</div>
         <div style="font-size:12px;color:#9ca3af">${res.room.type} · floor ${res.room.floor}</div>
       </div>
     </div>
     <table width="100%" style="border-collapse:collapse;margin:6px 0 14px">
       ${row('Booking', res.code)}
       ${row('Checked in', new Date(res.checked_in_at ?? Date.now()).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' }))}
       ${row('Check-out', `${prettyDate(res.check_out, long)} · by 11:00`)}
       ${row('Nights', String(res.total_nights))}
       ${row('Guests', `${res.adults} adult${res.adults > 1 ? 's' : ''}${res.children ? `, ${res.children} child` : ''}`)}
       ${row('Total', inr(res.grand_total))}
       ${row('Balance due', res.balance_due > 0 ? inr(res.balance_due) : 'Fully paid ✓')}
     </table>
     <table width="100%" style="border-collapse:collapse;background:#f4f6f5;border-radius:12px;margin:10px 0 18px">
       <tr><td style="padding:14px 16px;font-size:14px;line-height:1.8">
         📶 <b>Wi-Fi:</b> Hotelator-Guest · password <b>goa${res.room.number}</b><br>
         🍳 <b>Breakfast:</b> 7:00–10:30, Palm Café<br>
         🏊 <b>Pool:</b> 7:00–21:00 · 🍽 <b>Room service:</b> 24/7, dial 101<br>
         📞 <b>Front desk:</b> dial 0 or ${hotel.phone}
       </td></tr>
     </table>
     ${res.special_requests ? `<p style="font-size:14px">📝 We’ve noted your request: <i>${res.special_requests}</i></p>` : ''}
     <p style="font-size:14px">Need towels, food or a fix? Just reply to this email or WhatsApp us — we’re on it.</p>
     <p style="margin-top:18px;font-size:13px;color:#6b7280">Your booking and invoice are always in <a href="${links.account}" style="color:#16963c">your account</a>.</p>`,
  )
}

export function welcomeEmailHTML(guest: { name: string }, hotel: Hotel, links: { account: string; book: string }) {
  const perk = (icon: string, t: string, s: string) =>
    `<tr><td style="padding:8px 12px 8px 0;font-size:20px;vertical-align:top">${icon}</td><td style="padding:8px 0"><b>${t}</b><br><span style="color:#6b7280;font-size:13px">${s}</span></td></tr>`
  return shell(
    hotel,
    `Welcome to ${hotel.name}, ${guest.name.split(' ')[0]}!`,
    `<p>Your account is ready. Here’s what membership gets you:</p>
     <table style="border-collapse:collapse;margin:10px 0 18px">
       ${perk('💚', '10% off direct bookings', 'Always the best rate when you book on our website.')}
       ${perk('⚡', 'Two-minute online check-in', 'Upload your ID and sign before you arrive — skip the desk.')}
       ${perk('💬', 'WhatsApp concierge', 'Towels, food, a fix — just message us during your stay.')}
     </table>
     <p style="margin:22px 0"><a href="${links.book}" style="background:#3ed160;color:#06260f;text-decoration:none;padding:12px 20px;border-radius:10px;font-weight:700;display:inline-block">Plan your stay</a></p>
     <p style="color:#6b7280;font-size:13px">Your bookings, check-in links and invoices live in <a href="${links.account}" style="color:#16963c">your account</a>.</p>`,
  )
}

export function invoiceEmailHTML(res: ReservationView, hotel: Hotel, folio: Folio, items: FolioItem[], invoiceUrl: string) {
  return shell(
    hotel,
    'Thank you for staying with us',
    `<p>Hi ${res.guest.name.split(' ')[0]}, it was a pleasure having you.</p>
     <table width="100%" style="border-collapse:collapse;margin:14px 0">
       ${items.map((i) => row(i.description, inr(i.total_price))).join('')}
       ${row('Taxes', inr(folio.tax_total))}
       ${row('Total', inr(folio.grand_total))}
       ${row('Paid', inr(folio.paid_amount))}
     </table>
     <p><a href="${invoiceUrl}" style="color:#16963c;font-weight:700">View / download your invoice →</a></p>
     <p style="margin-top:18px">Loved your stay? <a href="${hotel.google_review_url}" style="color:#16963c;font-weight:700">Leave us a review ⭐</a></p>`,
  )
}
