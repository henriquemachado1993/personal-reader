import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/controls";
import { invitationStatus, type Invitation } from "./invitation-status";

export function InvitationList({
  invitations,
  busy,
  onRevoke,
}: {
  invitations: Invitation[];
  busy: string;
  onRevoke: (invitation: Invitation) => void;
}) {
  const pending = invitations.filter(
    (invite) => invitationStatus(invite) === "Pendente",
  );
  const history = invitations.filter(
    (invite) => invitationStatus(invite) !== "Pendente",
  );
  const rows = (items: Invitation[]) => (
    <ul className="invitation-list">
      {items.map((invite) => {
        const status = invitationStatus(invite);
        const date = invite.usedAt ?? invite.revokedAt ?? invite.expiresAt;
        const dateLabel =
          status === "Pendente"
            ? "Expira em"
            : status === "Expirado"
              ? "Expirou em"
              : "Em";
        return (
          <li key={invite.id}>
            <div className="invitation-recipient">
              <span className="invitation-email">{invite.email}</span>
              <span className="invitation-date">
                {dateLabel}{" "}
                <time dateTime={date}>
                  {new Date(date).toLocaleString("pt-BR", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </time>
              </span>
            </div>
            {status === "Pendente" ? (
              <Button
                type="button"
                className="button secondary"
                disabled={!!busy}
                aria-label={`Revogar convite para ${invite.email}`}
                onClick={() => onRevoke(invite)}
              >
                {busy === invite.id ? "Revogando…" : "Revogar"}
              </Button>
            ) : (
              <span className="invitation-state">{status}</span>
            )}
          </li>
        );
      })}
    </ul>
  );
  return (
    <div className="invitation-management">
      <h3>
        Convites pendentes{" "}
        <span className="invitation-count">{pending.length}</span>
      </h3>
      {pending.length ? (
        rows(pending)
      ) : (
        <p className="invitation-empty">Nenhum convite pendente.</p>
      )}
      {history.length > 0 && (
        <details className="invitation-history">
          <summary>
            Histórico de convites{" "}
            <span className="invitation-count">{history.length}</span>
            <ChevronDown size={16} aria-hidden="true" />
          </summary>
          {rows(history)}
        </details>
      )}
    </div>
  );
}
