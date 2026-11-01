const PROCESSING_STALE_AFTER_MS = 5 * 60 * 1000;

/**
 * Decide how a duplicate provider event may be handled.
 * An event is acknowledged only after its durable ledger says "processed".
 */
export function classifyProviderEventDuplicate(
  status: string,
  receivedAt: string | null | undefined,
  nowMs = Date.now(),
): "acknowledge" | "claim" | "recover" | "retry" {
  if (status === "processed") return "acknowledge";
  if (status === "failed") return "claim";
  if (status !== "processing") return "retry";

  const receivedAtMs = typeof receivedAt === "string" ? Date.parse(receivedAt) : Number.NaN;
  if (!Number.isFinite(receivedAtMs)) return "retry";
  if (nowMs - receivedAtMs >= PROCESSING_STALE_AFTER_MS) return "recover";
  return "retry";
}
