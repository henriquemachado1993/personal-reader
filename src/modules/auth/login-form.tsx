"use client";
import { Button, TextField } from "@/components/ui/controls";
import { useState } from "react";
import { signIn } from "next-auth/react";
import { ArrowRight, Eye, EyeOff } from "lucide-react";
import { IconButton } from "@/components/ui";
import Link from "next/link";
export function LoginForm({
  firstRun,
  available,
  inviteToken,
  invitedEmail,
}: {
  firstRun: boolean;
  available: boolean;
  inviteToken?: string;
  invitedEmail?: string;
}) {
  const [email, setEmail] = useState(invitedEmail ?? "");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [accountCreated, setAccountCreated] = useState(false);
  const creatingAccount = (firstRun || !!inviteToken) && !accountCreated;
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      if (creatingAccount) {
        const response = await fetch("/api/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, email, password, inviteToken }),
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error);
        setAccountCreated(true);
      }
      const result = await signIn("credentials", {
        email: email.trim().toLowerCase(),
        password,
        redirect: false,
        redirectTo: "/library",
      });
      if (result?.error)
        throw new Error(
          "Não foi possível entrar. Confira seu e-mail e senha. Após muitas tentativas, aguarde 15 minutos.",
        );
      window.location.assign("/library");
    } catch (error) {
      setError(
        error instanceof TypeError || error instanceof SyntaxError
          ? "Não foi possível conectar. Verifique sua conexão e tente novamente."
          : error instanceof Error
            ? error.message
            : "Não foi possível entrar. Tente novamente.",
      );
      setBusy(false);
    }
  };
  return (
    <form className="auth-form" onSubmit={submit}>
      <h1>
        {creatingAccount
          ? "Sua biblioteca começa aqui"
          : "Entre na sua biblioteca"}
      </h1>
      <p className="auth-intro">
        {invitedEmail
          ? "Crie sua conta para acessar sua própria biblioteca. O e-mail já está vinculado ao convite."
          : creatingAccount
            ? "Escolha o e-mail e a senha de acesso à sua biblioteca."
            : "Entre para continuar de onde parou."}
      </p>
      {!available && (
        <div className="auth-error" role="alert">
          Não foi possível conectar à sua biblioteca. Recarregue a página para
          tentar novamente.
        </div>
      )}
      {creatingAccount && (
        <label className="field-label">
          Seu nome
          <TextField
            className="input"
            name="name"
            autoComplete="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            minLength={2}
            maxLength={80}
            required
          />
        </label>
      )}
      <label className="field-label">
        E-mail
        <TextField
          className="input"
          name="email"
          readOnly={!!invitedEmail}
          type="email"
          placeholder="voce@exemplo.com"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          maxLength={254}
        />
      </label>
      <label className="field-label">
        <span id="login-password-label">Senha</span>
        <div className="password-input">
          <TextField
            className="input"
            name="password"
            aria-labelledby="login-password-label"
            type={visible ? "text" : "password"}
            autoComplete={creatingAccount ? "new-password" : "current-password"}
            placeholder={creatingAccount ? "Crie uma senha" : "Sua senha"}
            aria-describedby={
              creatingAccount ? "password-requirements" : undefined
            }
            minLength={10}
            maxLength={128}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <IconButton
            label={visible ? "Ocultar senha" : "Mostrar senha"}
            onClick={() => setVisible(!visible)}
          >
            {visible ? <EyeOff size={17} /> : <Eye size={17} />}
          </IconButton>
        </div>
        {creatingAccount && (
          <small className="auth-field-help" id="password-requirements">
            Use de 10 a 128 caracteres.
          </small>
        )}
      </label>
      {error && (
        <div className="auth-error" role="alert">
          {error}
        </div>
      )}
      <Button
        type="submit"
        className="button primary login-submit"
        disabled={busy || !available}
      >
        {busy
          ? creatingAccount
            ? "Criando sua conta…"
            : "Entrando…"
          : creatingAccount
            ? "Criar conta"
            : "Entrar"}
        <ArrowRight size={17} />
      </Button>
      {!creatingAccount && (
        <p className="auth-privacy">
          <Link href="/forgot-password" className="text-link">
            Esqueci minha senha
          </Link>
        </p>
      )}
    </form>
  );
}
