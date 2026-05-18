import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';

export const categories = sqliteTable('categories', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull().unique(),
  icon: text('icon').notNull(),
  color: text('color').notNull(),
  sortOrder: integer('sort_order').notNull().default(0),
});

export const paymentMethods = sqliteTable('payment_methods', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull().unique(),
  icon: text('icon').notNull(),
  sortOrder: integer('sort_order').notNull().default(0),
});

export const expenses = sqliteTable('expenses', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  amount: real('amount').notNull(),
  categoryId: integer('category_id')
    .notNull()
    .references(() => categories.id),
  paymentMethodId: integer('payment_method_id')
    .notNull()
    .references(() => paymentMethods.id),
  date: text('date').notNull(),
  note: text('note'),
  attachmentPath: text('attachment_path'),
  recurringId: integer('recurring_id'),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
});

export const recurringRules = sqliteTable('recurring_rules', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  amount: real('amount').notNull(),
  categoryId: integer('category_id')
    .notNull()
    .references(() => categories.id),
  paymentMethodId: integer('payment_method_id')
    .notNull()
    .references(() => paymentMethods.id),
  frequency: text('frequency', {
    enum: ['daily', 'weekly', 'monthly', 'yearly'],
  }).notNull(),
  intervalCount: integer('interval_count').notNull().default(1),
  startDate: text('start_date').notNull(),
  endDate: text('end_date'),
  nextRunDate: text('next_run_date').notNull(),
  note: text('note'),
  active: integer('active', { mode: 'boolean' }).notNull().default(true),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
});

export const budgets = sqliteTable('budgets', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  categoryId: integer('category_id').references(() => categories.id),
  month: text('month').notNull(),
  amount: real('amount').notNull(),
});

export const settings = sqliteTable('settings', {
  key: text('key').primaryKey(),
  value: text('value'),
});

export type Category = typeof categories.$inferSelect;
export type PaymentMethod = typeof paymentMethods.$inferSelect;
export type Expense = typeof expenses.$inferSelect;
export type NewExpense = typeof expenses.$inferInsert;
export type RecurringRule = typeof recurringRules.$inferSelect;
export type NewRecurringRule = typeof recurringRules.$inferInsert;
export type Budget = typeof budgets.$inferSelect;
export type NewBudget = typeof budgets.$inferInsert;
