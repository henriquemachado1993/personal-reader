"use client";
import { Button, TextField } from "@/components/ui/controls";
import { useState } from "react";
import { signIn } from "next-auth/react";
import { BookOpen, ArrowRight, Eye, EyeOff } from "lucide-react";
import { IconButton } from "@/components/ui";
import Link from "next/link";
export function LoginForm({
  firstRun,
  available,
}: {
  firstRun: boolean;
  available: boolean;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      if (firstRun) {
        const response = await fetch("/api/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, email, password }),
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error);
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
        error instanceof Error
          ? error.message
          : "Não foi possível entrar. Tente novamente.",
      );
      setBusy(false);
    }
  };
  return (
    <main className="login-page">
      <section className="login-story">
        <div className="login-brand">
          <BookOpen size={26} strokeWidth={1.5} />
          <span>Personal Reader</span>
        </div>
        <div className="login-story-content">
          <h1>
            O próximo capítulo
            <br />é seu.
          </h1>
          <p>
            Seus livros, suas ideias e o prazer de voltar
            <br />
            àquela página. Tudo no mesmo lugar.
          </p>
          <div className="login-books">
            <img src="/covers/dom-casmurro.svg" alt="Capa de Dom Casmurro" />
            <img src="/covers/meditacoes.svg" alt="Capa de Meditações" />
            <img
              src="/covers/desassossego.svg"
              alt="Capa de Livro do desassossego"
            />
          </div>
        </div>
        <span className="login-story-footer">
          Um espaço para ler. Um tempo para você.
        </span>
      </section>
      <section className="login-form-section">
        <form onSubmit={submit}>
          <BookOpen className="login-form-mark" size={31} strokeWidth={1.3} />
          <h2>
            {firstRun ? "Sua biblioteca começa aqui" : "Bom ter você por aqui"}
          </h2>
          <p>
            {firstRun
              ? "Crie sua conta pessoal e abra espaço para novas leituras."
              : "Entre para continuar de onde parou."}
          </p>
          {!available && (
            <div className="login-error" role="alert">
              A conexão com sua biblioteca ainda não está pronta. Verifique a
              configuração do banco e execute as migrações antes de entrar.
            </div>
          )}
          {firstRun && (
            <label className="field-label">
              Como podemos chamar você?
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
            Senha
            <div className="password-input">
              <TextField
                className="input"
                name="password"
                type={visible ? "text" : "password"}
                autoComplete={firstRun ? "new-password" : "current-password"}
                placeholder={
                  firstRun ? "Pelo menos 10 caracteres" : "Sua senha"
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
          </label>
          {error && (
            <div className="login-error" role="alert">
              {error}
            </div>
          )}
          <Button
            type="submit"
            className="button primary login-submit"
            disabled={busy || !available}
          >
            {busy
              ? "Preparando sua leitura…"
              : firstRun
                ? "Criar minha biblioteca"
                : "Entrar na minha biblioteca"}
            <ArrowRight size={17} />
          </Button>
          <p className="login-privacy">
            {!firstRun && (
              <Link href="/forgot-password" className="text-link">
                Esqueci minha senha
              </Link>
            )}
            <br />
            Uma biblioteca pessoal, com acesso só seu.
          </p>
        </form>
      </section>
    </main>
  );
}
