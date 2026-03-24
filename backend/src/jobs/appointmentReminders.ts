import { and, gte, isNull, lte, eq } from 'drizzle-orm';
import { db } from '../db';
import { appointments } from '../db/schema';
import { sendEmail } from '../utils/email';

const INTERVAL_MS = 15 * 60 * 1000; // 15 minutes

async function runReminderCheck() {
  const now = new Date();
  const windowStart = new Date(now.getTime() + 23 * 60 * 60 * 1000);
  const windowEnd = new Date(now.getTime() + 25 * 60 * 60 * 1000);

  const upcoming = await db.query.appointments.findMany({
    where: and(
      gte(appointments.startTime, windowStart),
      lte(appointments.startTime, windowEnd),
      isNull(appointments.reminderSentAt),
    ),
    with: {
      customer: { columns: { id: true, firstName: true, lastName: true, email: true } },
    },
  });

  for (const appt of upcoming) {
    if (!appt.customer?.email) continue;

    const customerName = [appt.customer.firstName, appt.customer.lastName].filter(Boolean).join(' ');
    const startFormatted = appt.startTime.toLocaleString('de-AT', {
      dateStyle: 'full',
      timeStyle: 'short',
      timeZone: 'Europe/Vienna',
    });

    try {
      await sendEmail({
        to: appt.customer.email,
        subject: `Erinnerung: Ihr Termin morgen — ${appt.title}`,
        html: `
          <p>Guten Tag ${customerName},</p>
          <p>wir möchten Sie an Ihren Termin erinnern:</p>
          <p><strong>${appt.title}</strong><br>${startFormatted}</p>
          ${appt.description ? `<p>${appt.description}</p>` : ''}
          <p>Bei Fragen stehen wir Ihnen gerne zur Verfügung.</p>
        `,
      });

      await db
        .update(appointments)
        .set({ reminderSentAt: new Date() })
        .where(eq(appointments.id, appt.id));
    } catch (err) {
      console.error(`Failed to send reminder for appointment ${appt.id}:`, err);
    }
  }
}

export function startAppointmentReminderJob() {
  setInterval(() => {
    runReminderCheck().catch((err) => {
      console.error('Appointment reminder job failed:', err);
    });
  }, INTERVAL_MS);
}
