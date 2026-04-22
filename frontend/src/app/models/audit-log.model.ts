export interface AuditLog {
  auditId: number;
  user: {
    id: number;
    name: string;
    username: string;
    email: string;
    role: string;
  } | null;
  action: string;
  resource: string;
  timestamp: string;
  metadata: string | null;
}
