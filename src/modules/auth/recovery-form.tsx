"use client";
import { Button, TextField } from "@/components/ui/controls";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";

export function RecoveryForm({ reset = false }: { reset?: boolean }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [token, setToken] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [finished, setFinished] = useState(false);
  const [invalidLink, setInvalidLink] = useState(false);
  const tokenRead = useRef(false);
  useEffect(() => {
    if (reset && !tokenRead.current) {
      // Strict Mode repeats effects after the fragment has already been removed.
      tokenRead.current = true;
      setToken(location.hash.slice(1));
      setInvalidLink(!/^[a-f0-9]{64}$/.test(location.hash.slice(1)));
      history.replaceState(null, "", location.pathname);
    }
  }, [reset]);
  return (
    <form
      className="auth-form"
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
            error instanceof TypeError || error instanceof SyntaxError
              ? "Não foi possível conectar. Verifique sua conexão e tente novamente."
              : error instanceof Error
                ? error.message
                : "Não foi possível concluir. Tente novamente.",
          );
        } finally {
          setBusy(false);
        }
      }}
    >
      <h1>
        {finished
          ? reset
            ? "Senha atualizada"
            : "Confira seu e-mail"
          : invalidLink
            ? "Solicite um novo link"
            : reset
              ? "Crie uma nova senha"
              : "Recupere seu acesso"}
      </h1>
      {!finished && !invalidLink && (
        <p className="auth-intro">
          {reset
            ? "A nova senha substituirá a senha atual da sua conta."
            : "Informe o e-mail da sua conta para solicitar um link de redefinição de senha."}
        </p>
      )}
      {invalidLink && (
        <div className="auth-error" role="alert">
          <p>
            Não foi possível usar este link. Solicite um novo e abra o link
            recebido por e-mail.
          </p>
          <Link
            href="/forgot-password"
            className="button primary auth-retry-link"
          >
            Solicitar novo link
          </Link>
        </div>
      )}
      {!finished &&
        !invalidLink &&
        (reset ? (
          <label className="field-label">
            <span id="reset-password-label">Nova senha</span>
            <TextField
              className="input"
              type="password"
              autoComplete="new-password"
              aria-labelledby="reset-password-label"
              aria-describedby="reset-password-requirements"
              minLength={10}
              maxLength={128}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <small className="auth-field-help" id="reset-password-requirements">
              Use de 10 a 128 caracteres.
            </small>
          </label>
        ) : (
          <label className="field-label">
            E-mail
            <TextField
              className="input"
              type="email"
              placeholder="voce@exemplo.com"
              autoComplete="email"
              maxLength={254}
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
        ))}
      {message && !invalidLink && (
        <p
          className={finished ? "auth-message" : "auth-error"}
          role={finished ? "status" : "alert"}
        >
          {message}
          {finished && !reset && " Confira também a pasta de spam."}
        </p>
      )}
      {!finished && !invalidLink && (
        <Button
          className="button primary login-submit"
          disabled={busy || (reset && !token)}
        >
          {busy
            ? reset
              ? "Salvando nova senha…"
              : "Solicitando link…"
            : reset
              ? "Salvar nova senha"
              : "Enviar link de recuperação"}
        </Button>
      )}
      <Link className="text-link" href="/login">
        Voltar ao login
      </Link>
    </form>
  );
}
