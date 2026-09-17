import { integer, jsonb, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

/**
 * Gedeelde machinegalerij: leerlingen kunnen een machine uit de Ontdekzone
 * delen, zodat klasgenoten ze kunnen laden en onderzoeken.
 */
export const sharedMachines = pgTable("shared_machines", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  author: text("author").notNull().default(""),
  construction: jsonb("construction").notNull(),
  componentCount: integer("component_count").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type SharedMachine = typeof sharedMachines.$inferSelect;
