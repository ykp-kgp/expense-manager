import { and, desc, eq, gte, lte, sql } from 'drizzle-orm';
import { format, parseISO, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { getDb, getRawDb, schema } from '@/db';
import type { NewExpense, Expense, NewBudget, NewRecurringRule } from '@/db/schema';

export type ExpenseWithRefs = Expense & {
  categoryName: string;
  categoryIcon: string;
  categoryColor: string;
  paymentMethodName: string;
  paymentMethodIcon: string;
};

export async function listCategories() {
  const db = getDb();
  return db.select().from(schema.categories).orderBy(schema.categories.sortOrder);
}

export async function listPaymentMethods() {
  const db = getDb();
  return db.select().from(schema.paymentMethods).orderBy(schema.paymentMethods.sortOrder);
}

export async function createExpense(input: NewExpense) {
  const db = getDb();
  return db.insert(schema.expenses).values(input);
}

export async function updateExpense(id: number, input: Partial<NewExpense>) {
  const db = getDb();
  return db.update(schema.expenses).set(input).where(eq(schema.expenses.id, id));
}

export async function deleteExpense(id: number) {
  const db = getDb();
  return db.delete(schema.expenses).where(eq(schema.expenses.id, id));
}

export async function getExpense(id: number): Promise<Expense | null> {
  const db = getDb();
  const rows = await db.select().from(schema.expenses).where(eq(schema.expenses.id, id)).limit(1);
  return rows[0] ?? null;
}

export type ExpenseFilter = {
  startDate?: string;
  endDate?: string;
  categoryId?: number;
  paymentMethodId?: number;
  search?: string;
  limit?: number;
};

export async function listExpenses(filter: ExpenseFilter = {}): Promise<ExpenseWithRefs[]> {
  const sqlite = getRawDb();
  const where: string[] = [];
  const params: any[] = [];
  if (filter.startDate) {
    where.push('e.date >= ?');
    params.push(filter.startDate);
  }
  if (filter.endDate) {
    where.push('e.date <= ?');
    params.push(filter.endDate);
  }
  if (filter.categoryId) {
    where.push('e.category_id = ?');
    params.push(filter.categoryId);
  }
  if (filter.paymentMethodId) {
    where.push('e.payment_method_id = ?');
    params.push(filter.paymentMethodId);
  }
  if (filter.search) {
    where.push('(e.note LIKE ? OR CAST(e.amount AS TEXT) LIKE ?)');
    const q = `%${filter.search}%`;
    params.push(q, q);
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const limitSql = filter.limit ? `LIMIT ${filter.limit}` : '';
  const rows = await sqlite.getAllAsync<any>(
    `SELECT e.*,
            c.name AS categoryName, c.icon AS categoryIcon, c.color AS categoryColor,
            p.name AS paymentMethodName, p.icon AS paymentMethodIcon
     FROM expenses e
     JOIN categories c ON c.id = e.category_id
     JOIN payment_methods p ON p.id = e.payment_method_id
     ${whereSql}
     ORDER BY e.date DESC, e.id DESC
     ${limitSql}`,
    params
  );
  return rows.map((r) => ({
    id: r.id,
    amount: r.amount,
    categoryId: r.category_id,
    paymentMethodId: r.payment_method_id,
    date: r.date,
    note: r.note,
    attachmentPath: r.attachment_path,
    recurringId: r.recurring_id,
    createdAt: new Date(r.created_at),
    updatedAt: new Date(r.updated_at),
    categoryName: r.categoryName,
    categoryIcon: r.categoryIcon,
    categoryColor: r.categoryColor,
    paymentMethodName: r.paymentMethodName,
    paymentMethodIcon: r.paymentMethodIcon,
  }));
}

export async function monthTotal(month: Date | string = new Date()): Promise<number> {
  const m = typeof month === 'string' ? parseISO(month + '-01') : month;
  const start = format(startOfMonth(m), 'yyyy-MM-dd');
  const end = format(endOfMonth(m), 'yyyy-MM-dd');
  const sqlite = getRawDb();
  const row = await sqlite.getFirstAsync<{ total: number | null }>(
    'SELECT SUM(amount) AS total FROM expenses WHERE date >= ? AND date <= ?',
    [start, end]
  );
  return row?.total ?? 0;
}

export async function previousMonthTotal(): Promise<number> {
  return monthTotal(subMonths(new Date(), 1));
}

export type CategoryTotal = {
  categoryId: number;
  name: string;
  color: string;
  icon: string;
  total: number;
};

export async function totalsByCategoryForMonth(
  month: Date | string = new Date()
): Promise<CategoryTotal[]> {
  const m = typeof month === 'string' ? parseISO(month + '-01') : month;
  const start = format(startOfMonth(m), 'yyyy-MM-dd');
  const end = format(endOfMonth(m), 'yyyy-MM-dd');
  const sqlite = getRawDb();
  const rows = await sqlite.getAllAsync<any>(
    `SELECT c.id AS categoryId, c.name AS name, c.color AS color, c.icon AS icon,
            COALESCE(SUM(e.amount), 0) AS total
     FROM categories c
     LEFT JOIN expenses e ON e.category_id = c.id AND e.date >= ? AND e.date <= ?
     GROUP BY c.id
     ORDER BY total DESC, c.sort_order ASC`,
    [start, end]
  );
  return rows.map((r) => ({
    categoryId: r.categoryId,
    name: r.name,
    color: r.color,
    icon: r.icon,
    total: r.total ?? 0,
  }));
}

export async function totalsForLastNMonths(
  n: number
): Promise<Array<{ month: string; total: number }>> {
  const sqlite = getRawDb();
  const result: Array<{ month: string; total: number }> = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = subMonths(new Date(), i);
    const start = format(startOfMonth(d), 'yyyy-MM-dd');
    const end = format(endOfMonth(d), 'yyyy-MM-dd');
    const row = await sqlite.getFirstAsync<{ total: number | null }>(
      'SELECT SUM(amount) AS total FROM expenses WHERE date >= ? AND date <= ?',
      [start, end]
    );
    result.push({ month: format(d, 'MMM'), total: row?.total ?? 0 });
  }
  return result;
}

// ===== Budgets =====

export async function listBudgetsForMonth(month: string) {
  const db = getDb();
  return db.select().from(schema.budgets).where(eq(schema.budgets.month, month));
}

export async function upsertBudget(input: NewBudget) {
  const sqlite = getRawDb();
  const catKey = input.categoryId ?? null;
  await sqlite.runAsync(
    `INSERT INTO budgets (category_id, month, amount) VALUES (?, ?, ?)
     ON CONFLICT(IFNULL(category_id, -1), month)
     DO UPDATE SET amount = excluded.amount`,
    [catKey, input.month, input.amount]
  );
}

export async function deleteBudget(id: number) {
  const db = getDb();
  return db.delete(schema.budgets).where(eq(schema.budgets.id, id));
}

export type BudgetProgress = {
  id: number;
  categoryId: number | null;
  categoryName: string | null;
  categoryColor: string | null;
  categoryIcon: string | null;
  amount: number;
  spent: number;
};

export async function budgetProgressForMonth(month: string): Promise<BudgetProgress[]> {
  const sqlite = getRawDb();
  const start = month + '-01';
  const m = parseISO(start);
  const end = format(endOfMonth(m), 'yyyy-MM-dd');
  const rows = await sqlite.getAllAsync<any>(
    `SELECT b.id, b.category_id AS categoryId, b.amount,
            c.name AS categoryName, c.color AS categoryColor, c.icon AS categoryIcon,
            COALESCE((
              SELECT SUM(e.amount) FROM expenses e
              WHERE e.date >= ? AND e.date <= ?
                AND (b.category_id IS NULL OR e.category_id = b.category_id)
            ), 0) AS spent
     FROM budgets b
     LEFT JOIN categories c ON c.id = b.category_id
     WHERE b.month = ?
     ORDER BY (b.category_id IS NULL) DESC, c.sort_order ASC`,
    [start, end, month]
  );
  return rows.map((r) => ({
    id: r.id,
    categoryId: r.categoryId,
    categoryName: r.categoryName,
    categoryColor: r.categoryColor,
    categoryIcon: r.categoryIcon,
    amount: r.amount,
    spent: r.spent,
  }));
}

// ===== Recurring =====

export async function listRecurringRules() {
  const sqlite = getRawDb();
  const rows = await sqlite.getAllAsync<any>(
    `SELECT r.*, c.name AS categoryName, c.icon AS categoryIcon, c.color AS categoryColor,
            p.name AS paymentMethodName
     FROM recurring_rules r
     JOIN categories c ON c.id = r.category_id
     JOIN payment_methods p ON p.id = r.payment_method_id
     ORDER BY r.active DESC, r.next_run_date ASC`
  );
  return rows;
}

export async function createRecurringRule(input: NewRecurringRule) {
  const db = getDb();
  return db.insert(schema.recurringRules).values(input);
}

export async function updateRecurringRule(id: number, input: Partial<NewRecurringRule>) {
  const db = getDb();
  return db
    .update(schema.recurringRules)
    .set(input)
    .where(eq(schema.recurringRules.id, id));
}

export async function deleteRecurringRule(id: number) {
  const db = getDb();
  return db.delete(schema.recurringRules).where(eq(schema.recurringRules.id, id));
}
