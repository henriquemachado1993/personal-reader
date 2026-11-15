import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "Personal Reader · Sua biblioteca, seu ritmo",
  description: "Um lugar para ler, anotar e guardar suas ideias.",
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
