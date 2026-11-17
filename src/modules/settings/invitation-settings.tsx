"use client";
import { useEffect, useState } from "react";
import { Button, TextField } from "@/components/ui/controls";
import "./invitation-settings.css";
interface Invitation {
  id: string;
  email: string;
  expiresAt: string;
  usedAt: string | null;
  revokedAt: string | null;
}
export function InvitationSettings() {
  const [invitations, setInvitations] = useState<Invitation[] | null>(null);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [link, setLink] = useState<{ id: string; value: string } | null>(null);
  const [notice, setNotice] = useState("");
  const [allowed, setAllowed] = useState(false);
  async function refresh() {
    const response = await fetch("/api/admin/invitations", {
      cache: "no-store",
    });
    if (response.status === 403) {
      setAllowed(false);
      return;
    }
    setAllowed(true);
    if (!response.ok)
      throw new Error(
        "Não foi possível carregar os convites. Tente novamente.",
      );
    setInvitations((await response.json()).invitations);
  }
  useEffect(() => {
    let active = true;
    void fetch("/api/admin/invitations", { cache: "no-store" })
      .then(async (response) => {
        if (response.status === 403 || !active) return;
        setAllowed(true);
        if (!response.ok) throw new Error();
        const result = await response.json();
        if (active) setInvitations(result.invitations);
      })
      .catch(() => {
        if (active) {
          setAllowed(true);
          setError("Não foi possível carregar os convites. Tente novamente.");
        }
      });
    return () => {
      active = false;
    };
  }, []);
  if (!allowed) return null;
  return (
    <section
      className="preferences-section invitation-settings"
      aria-labelledby="invitations-heading"
    >
      <h2 id="invitations-heading">Convites</h2>
      <p>
        Convide alguém para criar uma conta com biblioteca própria. Cada link
        vale por 48 horas e pode ser usado uma vez, apenas pelo e-mail indicado.
      </p>
      <form
        onSubmit={async (event) => {
          event.preventDefault();
          if (busy) return;
          setBusy("create");
          setError("");
          setNotice("");
          setLink(null);
          try {
            const response = await fetch("/api/admin/invitations", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ email }),
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error);
            const url = new URL("/register", location.origin);
            url.hash = result.token;
            setLink({ id: result.invitation.id, value: url.toString() });
            setEmail("");
            await refresh();
          } catch (failure) {
            setError(
              failure instanceof TypeError
                ? "Verifique sua conexão e tente novamente."
                : failure instanceof Error
                  ? failure.message
                  : "Não foi possível gerar o convite.",
            );
          } finally {
            setBusy("");
          }
        }}
      >
        <label className="field-label">
          E-mail da pessoa convidada
          <TextField
            type="email"
            required
            maxLength={254}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="pessoa@exemplo.com"
          />
        </label>
        <Button className="button primary" disabled={!!busy}>
          {busy === "create" ? "Gerando convite…" : "Gerar convite"}
        </Button>
      </form>
      {link && (
        <div className="invitation-link">
          <label className="field-label">
            Link do convite
            <TextField
              value={link.value}
              readOnly
              onFocus={(event) => event.target.select()}
            />
          </label>
          <p>
            Copie e envie este link. Ele não é enviado por e-mail
            automaticamente. Gerar outro convite para o mesmo e-mail invalida o
            anterior.
          </p>
          <Button
            type="button"
            className="button secondary"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(link.value);
                setNotice("Link copiado.");
              } catch {
                setNotice("Selecione e copie o link no campo acima.");
              }
            }}
          >
            Copiar link
          </Button>
        </div>
      )}
      {error && (
        <p className="auth-error" role="alert">
          {error}
        </p>
      )}
      {invitations === null && error && (
        <Button
          type="button"
          className="button secondary"
          onClick={() => {
            setError("");
            void refresh().catch((failure) => setError(failure.message));
          }}
        >
          Tentar novamente
        </Button>
      )}
      <p role="status">{notice}</p>
      {invitations?.length === 0 && <p>Nenhum convite gerado.</p>}
      {!!invitations?.length && (
        <ul className="invitation-list">
          {invitations.map((invite) => {
            const status = invite.usedAt
              ? "Utilizado"
              : invite.revokedAt
                ? "Revogado"
                : new Date(invite.expiresAt) <= new Date()
                  ? "Expirado"
                  : "Pendente";
            return (
              <li key={invite.id}>
                <div>
                  <strong>{invite.email}</strong>
                  <span>
                    {status} · Validade:{" "}
                    {new Date(invite.expiresAt).toLocaleString("pt-BR")}
                  </span>
                </div>
                {status === "Pendente" && (
                  <Button
                    type="button"
                    className="button secondary"
                    disabled={!!busy}
                    onClick={async () => {
                      setBusy(invite.id);
                      setError("");
                      setNotice("");
                      try {
                        const response = await fetch("/api/admin/invitations", {
                          method: "DELETE",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ id: invite.id }),
                        });
                        if (!response.ok)
                          throw new Error(
                            "Não foi possível revogar o convite. Tente novamente.",
                          );
                        if (link?.id === invite.id) setLink(null);
                        await refresh();
                        setNotice("Convite revogado.");
                      } catch (failure) {
                        setError(
                          failure instanceof Error
                            ? failure.message
                            : "Não foi possível revogar o convite.",
                        );
                      } finally {
                        setBusy("");
                      }
                    }}
                  >
                    {busy === invite.id ? "Revogando…" : "Revogar"}
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
