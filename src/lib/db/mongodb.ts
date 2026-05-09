// ============================================================================
// MongoDB Connection — Client-side / Offline-compatible wrapper
// ============================================================================
// Re-exports the main connectDB from @/lib/mongodb to keep a single source
// of truth. This file previously had its own connection logic; it now
// delegates to the canonical module so that build-time safety fixes are
// applied everywhere.
// ============================================================================

export { connectDB, default } from '@/lib/mongodb';
