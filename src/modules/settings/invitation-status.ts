export interface Invitation {
  id: string;
  email: string;
  expiresAt: string;
  usedAt: string | null;
  revokedAt: string | null;
}

export function invitationStatus(invitation: Invitation, now = Date.now()) {
  if (invitation.usedAt) return "Utilizado";
  if (invitation.revokedAt) return "Revogado";
  return new Date(invitation.expiresAt).getTime() <= now
    ? "Expirado"
    : "Pendente";
}
