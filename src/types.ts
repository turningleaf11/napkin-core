// Shared types that don't belong to a single calculation module or
// component, and that a shell's own persistence layer needs too (so it can
// shape its saved-deal records to match what these components expect).

export interface BrokerFeedbackData {
  dscr?: string;
  seller?: string;
}
