import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env') });

import { buildApp } from './app';
import { startAppointmentReminderJob } from './jobs/appointmentReminders';

async function main() {
  const app = await buildApp();

  const port = Number(process.env.PORT) || 3000;
  const host = '0.0.0.0';

  await app.listen({ port, host });
  console.log(`Server running on http://${host}:${port}`);

  if (process.env.SMTP_HOST) {
    startAppointmentReminderJob();
    app.log.info('Appointment reminder job started');
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
