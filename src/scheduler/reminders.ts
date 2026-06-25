import cron from 'node-cron';
import { GarageConfig, findService } from '../config/garage';
import { Channel } from '../channel/channel';
import { Store } from '../store/store';
import { formatDateTimeNL } from '../util/format';

export interface ReminderDeps {
  store: Store;
  channel: Channel;
  config: GarageConfig;
}

/** Hoeveel uur vóór de afspraak we een herinnering sturen. */
const REMINDER_WINDOW_HOURS = 24;

/**
 * Start de herinneringen-planner. Loopt elk kwartier en stuurt klanten een
 * vriendelijke WhatsApp-herinnering als hun afspraak binnen 24 uur valt.
 */
export function startReminderScheduler(deps: ReminderDeps): void {
  const tick = () => runReminders(deps);
  // Elk kwartier controleren.
  cron.schedule('*/15 * * * *', tick);
  // En kort na het opstarten één keer, zodat je het meteen ziet werken.
  setTimeout(tick, 5_000);
  console.log('⏰ Herinneringen-planner actief (controle elk kwartier).');
}

async function runReminders(deps: ReminderDeps): Promise<void> {
  const now = Date.now();
  const horizon = now + REMINDER_WINDOW_HOURS * 60 * 60_000;

  for (const appt of deps.store.bookedAppointments()) {
    if (appt.reminderSent) continue;
    const start = new Date(appt.start).getTime();
    if (start <= now || start > horizon) continue;

    const serviceName = findService(deps.config, appt.serviceId)?.name ?? appt.serviceId;
    const text =
      `Hoi${appt.customer.name ? ' ' + appt.customer.name : ''}! 👋 Kleine herinnering: ` +
      `je hebt morgen een afspraak bij ${deps.config.name} voor ${serviceName} op ` +
      `${formatDateTimeNL(appt.start)}. Tot dan! Wil je verzetten of annuleren? Stuur gerust een bericht.`;

    try {
      await deps.channel.send(appt.customer.phone, text);
      deps.store.updateAppointment(appt.id, { reminderSent: true });
    } catch (err) {
      console.error('[reminders] versturen mislukt:', err);
    }
  }
}
