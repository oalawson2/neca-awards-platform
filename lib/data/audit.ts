import { store, generateId } from "@/lib/mock/store";
import type { AuditLogEntry } from "@/types/domain";

export async function getAuditLog(): Promise<AuditLogEntry[]> {
  return [...store.auditLog].sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1));
}

/** Internal helper — not a Server Action. Called by mutating actions in other lib/data modules. */
export function logAction(actorName: string, action: string, target: string) {
  store.auditLog.push({
    id: generateId("audit"),
    timestamp: new Date().toISOString().slice(0, 16),
    actorName,
    action,
    target,
  });
}
