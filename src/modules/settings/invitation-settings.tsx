"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Check, Copy } from "lucide-react";
import { Button, TextField } from "@/components/ui/controls";
import { InvitationList } from "./invitation-list";
import type { Invitation } from "./invitation-status";
import "./invitation-settings.css";

export function InvitationSettings() {
  const [invitations, setInvitations] = useState<Invitation[] | null>(null);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [loadError, setLoadError] = useState("");
  const [link, setLink] = useState<{
    id: string;
    email: string;
    value: string;
  } | null>(null);
  const [notice, setNotice] = useState("");
  const [allowed, setAllowed] = useState(false);
  const linkInput = useRef<HTMLInputElement>(null);

  async function refresh() {
    setLoadError("");
    try {
      const response = await fetch("/api/admin/invitations", {
        cache: "no-store",
      });
      if (response.status === 403) {
        setAllowed(false);
        return;
      }
      if (!response.ok) throw new Error();
      setInvitations((await response.json()).invitations);
    } catch {
      setLoadError("Não foi possível atualizar a lista de convites.");
    }
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
          setLoadError("Não foi possível carregar os convites.");
        }
      });
    return () => {
      active = false;
    };
  }, []);

  async function generateInvitation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy("create");
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/admin/invitations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(result.error || "Não foi possível gerar o convite.");
      const url = new URL("/register", location.origin);
      url.hash = result.token;
      setLink({
        id: result.invitation.id,
        email: result.invitation.email,
        value: url.toString(),
      });
      setEmail("");
      await refresh();
    } catch (failure) {
      setError(
        failure instanceof TypeError
          ? "Verifique sua conexão e tente novamente."
          : failure instanceof SyntaxError
            ? "Não foi possível gerar o convite. Tente novamente."
            : failure instanceof Error
              ? failure.message
              : "Não foi possível gerar o convite.",
      );
    } finally {
      setBusy("");
    }
  }

  async function revokeInvitation(invite: Invitation) {
    if (busy) return;
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
        throw new Error("Não foi possível revogar o convite. Tente novamente.");
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
  }

  if (!allowed) return null;
  return (
    <section
      className="preferences-section invitation-settings"
      aria-labelledby="invitations-heading"
    >
      <h2 id="invitations-heading">Convites</h2>
      <p className="invitation-intro">
        Convide alguém para criar uma biblioteca própria.
      </p>
      <form
        className="invitation-form"
        onSubmit={generateInvitation}
        aria-busy={busy === "create"}
      >
        <label className="field-label">
          E-mail da pessoa convidada
          <TextField
            type="email"
            autoComplete="email"
            inputMode="email"
            required
            maxLength={254}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="pessoa@exemplo.com"
            aria-describedby="invitation-email-help"
          />
        </label>
        <Button className="button primary" disabled={!!busy || !email.trim()}>
          {busy === "create" ? "Gerando convite…" : "Gerar convite"}
        </Button>
      </form>
      <p id="invitation-email-help" className="invitation-help">
        Válido por 48 horas e um único cadastro, apenas para esse e-mail. Um
        novo convite para o mesmo e-mail substitui o anterior.
      </p>
      {error && (
        <p className="auth-error" role="alert">
          {error}
        </p>
      )}
      {link && (
        <div className="invitation-link">
          <p className="invitation-link-recipient">
            Convite para <span>{link.email}</span>
          </p>
          <div className="invitation-copy-row">
            <label className="field-label">
              Link do convite
              <TextField
                ref={linkInput}
                value={link.value}
                readOnly
                onFocus={(event) => event.target.select()}
              />
            </label>
            <Button
              type="button"
              className="button secondary"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(link.value);
                  setNotice("Link copiado.");
                } catch {
                  linkInput.current?.focus();
                  linkInput.current?.select();
                  setNotice("Selecione e copie o link no campo acima.");
                }
              }}
            >
              {notice === "Link copiado." ? (
                <Check size={16} aria-hidden="true" />
              ) : (
                <Copy size={16} aria-hidden="true" />
              )}
              {notice === "Link copiado." ? "Copiado" : "Copiar link"}
            </Button>
          </div>
          <p className="invitation-help">
            Copie e envie à pessoa convidada. O link não é enviado por e-mail
            automaticamente.
          </p>
        </div>
      )}
      {notice && (
        <p className="invitation-notice" role="status">
          {notice}
        </p>
      )}
      {loadError && (
        <div className="invitation-load-error">
          <p role="alert">{loadError}</p>
          <Button
            type="button"
            className="button secondary"
            disabled={!!busy}
            onClick={() => void refresh()}
          >
            Tentar novamente
          </Button>
        </div>
      )}
      {invitations === null && !loadError && (
        <p className="invitation-empty" role="status">
          Carregando convites…
        </p>
      )}
      {invitations && (
        <InvitationList
          invitations={invitations}
          busy={busy}
          onRevoke={(invite) => void revokeInvitation(invite)}
        />
      )}
    </section>
  );
}
