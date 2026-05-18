import { addDays, addMonths, addWeeks, addYears, parseISO, isAfter, format } from 'date-fns';
import { eq } from 'drizzle-orm';
import { getDb, schema } from '@/db';
import { notifyRecurringMaterialized } from './notifications';

function advance(dateStr: string, frequency: string, interval: number): string {
  const d = parseISO(dateStr);
  let next: Date;
  switch (frequency) {
    case 'daily':
      next = addDays(d, interval);
      break;
    case 'weekly':
      next = addWeeks(d, interval);
      break;
    case 'monthly':
      next = addMonths(d, interval);
      break;
    case 'yearly':
      next = addYears(d, interval);
      break;
    default:
      next = addMonths(d, 1);
  }
  return format(next, 'yyyy-MM-dd');
}

export async function materializeRecurring(): Promise<number> {
  const db = getDb();
  const today = format(new Date(), 'yyyy-MM-dd');
  const todayDate = parseISO(today);

  const rules = await db
    .select()
    .from(schema.recurringRules)
    .where(eq(schema.recurringRules.active, true));

  let inserted = 0;

  for (const rule of rules) {
    let nextRun = rule.nextRunDate;
    while (parseISO(nextRun) <= todayDate) {
      if (rule.endDate && isAfter(parseISO(nextRun), parseISO(rule.endDate))) {
        break;
      }
      const now = new Date();
      await db.insert(schema.expenses).values({
        amount: rule.amount,
        categoryId: rule.categoryId,
        paymentMethodId: rule.paymentMethodId,
        date: nextRun,
        note: rule.note ?? null,
        attachmentPath: null,
        recurringId: rule.id,
        createdAt: now,
        updatedAt: now,
      });
      inserted += 1;
      nextRun = advance(nextRun, rule.frequency, rule.intervalCount);
    }

    if (nextRun !== rule.nextRunDate) {
      const updates: Partial<typeof rule> = { nextRunDate: nextRun };
      if (rule.endDate && isAfter(parseISO(nextRun), parseISO(rule.endDate))) {
        updates.active = false;
      }
      await db
        .update(schema.recurringRules)
        .set(updates as never)
        .where(eq(schema.recurringRules.id, rule.id));
    }
  }

  if (inserted > 0) {
    await notifyRecurringMaterialized(inserted).catch(() => undefined);
  }

  return inserted;
}

export function nextRunFromStart(
  startDate: string,
  frequency: 'daily' | 'weekly' | 'monthly' | 'yearly',
  interval: number
): string {
  const today = parseISO(format(new Date(), 'yyyy-MM-dd'));
  let cur = startDate;
  while (parseISO(cur) < today) {
    cur = advance(cur, frequency, interval);
  }
  return cur;
}
