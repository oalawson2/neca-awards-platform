import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { AuditLogEntry } from "@/types/domain";

export async function getAuditLog(): Promise<AuditLogEntry[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("audit_log")
    .select("id, created_at, action, after_value")
    .order("created_at", { ascending: false });
  if (error || !data) return [];

  return data.map((row) => {
    const context = row.after_value as { actor_name?: string; target?: string } | null;
    return {
      id: row.id,
      timestamp: row.created_at.slice(0, 16),
      actorName: context?.actor_name ?? "Unknown",
      action: row.action,
      target: context?.target ?? "",
    };
  });
}

/**
 * audit_log has no INSERT policy for authenticated users at all (service-
 * role only, by design — see NECA_Supabase_Schema_Reference.md) — writes
 * go through lib/supabase/admin.ts's service-role client.
 *
 * Kept the existing human-readable (actorName, action, target) string
 * signature rather than threading real actor_id/entity_type/entity_id
 * UUIDs through all 33 call sites across 13 action modules: many call
 * this with a display name only (no profile id in scope) or a literal
 * "System"/"Secretariat" actor that isn't a real user at all. The
 * structured columns (actor_id, entity_type, entity_id) exist in the
 * schema and are left null here rather than guessed; the human-readable
 * context is preserved in after_value jsonb so the audit trail stays
 * genuinely queryable, just not maximally normalized. Revisit if/when a
 * real per-action actor id and entity reference are worth threading
 * through every call site.
 *
 * Now async (writes require a network round trip) — every call site
 * updated to `await` it as part of this change.
 */
export async function logAction(actorName: string, action: string, target: string): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin.from("audit_log").insert({
    action,
    entity_type: "generic",
    after_value: { actor_name: actorName, target },
  });
  if (error) {
    console.error("[audit_log] insert failed:", error.message);
  }
}
