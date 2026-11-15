export async function sendPasswordRecovery(email: string, resetUrl: string) {
  const token = process.env.MAILTRAP_API_TOKEN;
  const sender = process.env.MAILTRAP_FROM_EMAIL;
  if (!token || !sender) throw new Error("Mailtrap não configurado.");
  const sandbox = process.env.MAILTRAP_SANDBOX_ID;
  if (sandbox && !/^\d+$/.test(sandbox))
    throw new Error("Sandbox Mailtrap inválido.");
  const endpoint = sandbox
    ? `https://sandbox.api.mailtrap.io/api/send/${sandbox}`
    : "https://send.api.mailtrap.io/api/send";
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    signal: AbortSignal.timeout(10000),
    body: JSON.stringify({
      from: { email: sender, name: "Personal Reader" },
      to: [{ email }],
      subject: "Redefina sua senha do Personal Reader",
      text: `Você pediu para redefinir sua senha. Abra este link em até 30 minutos:\n\n${resetUrl}\n\nSe não foi você, ignore esta mensagem. Sua senha permanece a mesma.`,
      category: "Password recovery",
    }),
  });
  if (!response.ok) throw new Error("Falha no envio pelo Mailtrap.");
}
