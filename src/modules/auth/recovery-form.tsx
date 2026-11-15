"use client";
import { Button, TextField } from "@/components/ui/controls";
import { useEffect, useState } from "react";
import Link from "next/link";

export function RecoveryForm({ reset = false }: { reset?: boolean }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [token, setToken] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [finished, setFinished] = useState(false);
  const [invalidLink, setInvalidLink] = useState(false);
  useEffect(() => {
    if (reset) {
      setToken(location.hash.slice(1));
      setInvalidLink(!/^[a-f0-9]{64}$/.test(location.hash.slice(1)));
      history.replaceState(null, "", location.pathname);
    }
  }, [reset]);
  return (
    <main
      className="login-page"
      style={{ display: "grid", gridTemplateColumns: "1fr" }}
    >
      <section className="login-form-section">
        <form
          onSubmit={async (event) => {
            event.preventDefault();
            setBusy(true);
            setMessage("");
            try {
              const response = await fetch(
                reset ? "/api/auth/reset-password" : "/api/auth/recovery",
                {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify(reset ? { token, password } : { email }),
                },
              );
              const result = await response.json();
              if (!response.ok) {
                if (reset && response.status === 400) setInvalidLink(true);
                throw new Error(result.error);
              }
              setFinished(true);
              setPassword("");
              setMessage(
                reset
                  ? "Senha atualizada. Entre com sua nova senha."
                  : result.message,
              );
            } catch (error) {
              setMessage(
                error instanceof Error
                  ? error.message
                  : "Não foi possível concluir. Tente novamente.",
              );
            } finally {
              setBusy(false);
            }
          }}
        >
          <h1>{reset ? "Escolha sua nova senha" : "Recupere seu acesso"}</h1>
          <p>
            {reset
              ? "Use uma senha de pelo menos 10 caracteres."
              : "Enviaremos um link para o e-mail da sua conta."}
          </p>
          {invalidLink && (
            <div role="alert">
              <p>Este link de recuperação está ausente, inválido ou expirou.</p>
              <Link href="/forgot-password" className="button primary">
                Solicitar outro link
              </Link>
            </div>
          )}
          {!finished &&
            !invalidLink &&
            (reset ? (
              <label className="field-label">
                Nova senha
                <TextField
                  className="input"
                  type="password"
                  autoComplete="new-password"
                  minLength={10}
                  maxLength={128}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </label>
            ) : (
              <label className="field-label">
                E-mail
                <TextField
                  className="input"
                  type="email"
                  autoComplete="email"
                  maxLength={254}
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </label>
            ))}
          {message && <p role={finished ? "status" : "alert"}>{message}</p>}
          {!finished && !invalidLink && (
            <Button
              className="button primary login-submit"
              disabled={busy || (reset && !token)}
            >
              {busy
                ? "Aguarde…"
                : reset
                  ? "Salvar nova senha"
                  : "Enviar link de recuperação"}
            </Button>
          )}
          <Link className="text-link" href="/login">
            Voltar para entrar
          </Link>
        </form>
      </section>
    </main>
  );
}
