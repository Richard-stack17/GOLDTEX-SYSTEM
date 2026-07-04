/** Daily POS ticket numbers are short integers strictly below this ceiling. */
export const MAX_DAILY_TICKET_NUM = 999;

export type TicketNumSource = {
  document_number: string;
  internal_ticket_number?: number | null;
};

export const isStarsoftDocument = (doc: string) => /^B\d{3}-/.test(doc);

const isValidDailyTicketNum = (num: number) =>
  !isNaN(num) && num > 0 && num <= MAX_DAILY_TICKET_NUM;

/** Reads the native DB column — single source of truth for the daily short number. */
export function parseInternalTicketNum(ticket: TicketNumSource): number | null {
  const num = ticket.internal_ticket_number;
  if (num == null || !isValidDailyTicketNum(num)) return null;
  return num;
}

/** PRÓXIMO # = max(internal_ticket_number today, 0) + 1 */
export function computeNextDailyTicketNumber(
  tickets: Pick<TicketNumSource, "internal_ticket_number">[],
): number {
  const validNums = tickets
    .map((t) => t.internal_ticket_number)
    .filter((n): n is number => n != null && isValidDailyTicketNum(n));

  return Math.max(...validNums, 0) + 1;
}

/** Card / list title: short daily number or clean placeholder. */
export function formatTicketHash(ticketNum: number | null): string {
  return ticketNum !== null ? `#${ticketNum}` : "# -";
}

export const starsoftDocNumFromTicket = (
  ticket: TicketNumSource & { status?: string },
): string | null => {
  if (ticket.status !== "COMPLETED" || !isStarsoftDocument(ticket.document_number)) return null;
  const parts = ticket.document_number.split("-");
  return parts[parts.length - 1] ?? null;
};
