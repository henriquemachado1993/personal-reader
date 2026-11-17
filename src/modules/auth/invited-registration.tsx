"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { LoginForm } from "./login-form";
import { Button } from "@/components/ui/controls";
export function InvitedRegistration() {
  const token = useRef<string | null>(null);
  const [invite, setInvite] = useState<{ email: string } | null>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (token.current === null) {
      token.current = location.hash.slice(1);
      history.replaceState(null, "", location.pathname);
    }
    if (!/^[a-f0-9]{64}$/.test(token.current)) {
      setError(
        "Abra o link completo que você recebeu. Se ele expirou ou já foi utilizado, peça um novo convite.",
      );
      return;
    }
    let active = true;
    setError("");
    void fetch("/api/auth/invitation", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: token.current }),
    })
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.error);
        if (active) setInvite(result);
      })
      .catch((error) => {
        if (active)
          setError(
            error instanceof TypeError
              ? "Não foi possível conectar. Verifique sua conexão e tente novamente."
              : error.message,
          );
      });
    return () => {
      active = false;
    };
  }, [attempt]);
  if (invite)
    return (
      <LoginForm
        firstRun={false}
        available
        inviteToken={token.current!}
        invitedEmail={invite.email}
      />
    );
  return (
    <div className="auth-form">
      <h1>Cadastro por convite</h1>
      {error ? (
        <>
          <p className="auth-error" role="alert">
            {error}
          </p>
          <Button
            type="button"
            className="button secondary"
            onClick={() => setAttempt((value) => value + 1)}
          >
            Verificar convite novamente
          </Button>
        </>
      ) : (
        <p role="status">Verificando seu convite…</p>
      )}
      <p className="auth-privacy">
        <Link href="/login" className="text-link">
          Já tenho uma conta
        </Link>
      </p>
    </div>
  );
}
