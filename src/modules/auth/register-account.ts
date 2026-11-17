import { hash } from "bcryptjs";
import { database } from "@/infrastructure/database/client";
import { invitationHash, invitationIsActive } from "./invitations";

export class RegistrationError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}
export async function registerAccount(
  input: {
    name: string;
    email: string;
    password: string;
    inviteToken?: string;
  },
  db = database(),
) {
  const tokenHash = input.inviteToken
    ? invitationHash(input.inviteToken)
    : null;
  const installation = await db.installation.findUnique({
    where: { id: "owner" },
  });
  if (installation) {
    const invite = tokenHash
      ? await db.registrationInvite.findUnique({ where: { tokenHash } })
      : null;
    if (!invitationIsActive(invite) || invite!.email !== input.email)
      throw new RegistrationError(
        "O cadastro exige um convite válido para este e-mail. Peça um novo link ao administrador.",
        403,
      );
  } else if (tokenHash)
    throw new RegistrationError(
      "Convite inválido. Peça um novo link ao administrador.",
      403,
    );
  const passwordHash = await hash(input.password, 12);
  await db.$transaction(async (tx) => {
    // Both bootstrap and invite creation use this lock; concurrent signups cannot open registration.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${"reader-registration"}))`;
    const owner = await tx.installation.findUnique({ where: { id: "owner" } });
    if (owner) {
      if (!tokenHash)
        throw new RegistrationError(
          "O cadastro está disponível apenas por convite.",
          403,
        );
      const consumed = await tx.registrationInvite.updateMany({
        where: {
          tokenHash,
          email: input.email,
          usedAt: null,
          revokedAt: null,
          expiresAt: { gt: new Date() },
        },
        data: { usedAt: new Date() },
      });
      if (consumed.count !== 1)
        throw new RegistrationError(
          "Este convite expirou, foi revogado ou já foi utilizado. Peça um novo link.",
          403,
        );
    } else if (tokenHash) throw new RegistrationError("Convite inválido.", 403);
    if (await tx.user.findUnique({ where: { email: input.email } }))
      throw new RegistrationError(
        "Este e-mail já tem uma conta. Entre ou recupere sua senha.",
        409,
      );
    const user = await tx.user.create({
      data: { email: input.email, name: input.name, passwordHash },
    });
    if (!owner)
      await tx.installation.create({ data: { id: "owner", ownerId: user.id } });
  });
}
