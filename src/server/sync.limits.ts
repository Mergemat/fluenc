// Kept apart from the contract so devices can read it without loading zod.
/** The most changes one sync request carries; a longer queue goes out in several. */
export const MAX_SYNC_OPERATIONS = 200;
