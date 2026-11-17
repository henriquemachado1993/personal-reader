import type { Metadata, Viewport } from "next";
import "./globals.css";
import "@mantine/dates/styles.css";
import "@/components/ui/controls.css";
import "@/components/ui/resilience.css";
import "@/components/ui/workspace-refinements.css";
import "@/components/ui/app-viewport.css";
import "@/components/ui/typography.css";
import { InterfaceProvider } from "@/components/ui/provider";
export const metadata: Metadata = {
  title: "Le-Books · Sua biblioteca, seu ritmo",
  description: "Um lugar para ler, anotar e guardar suas ideias.",
  applicationName: "Le-Books",
  appleWebApp: {
    capable: true,
    title: "Le-Books",
    statusBarStyle: "default",
  },
  icons: { apple: "/icons/apple-touch-icon.png" },
  formatDetection: { telephone: false },
  // Next emits the standard mobile-web-app-capable tag; older iOS still uses this alias.
  other: { "apple-mobile-web-app-capable": "yes" },
};
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  minimumScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  interactiveWidget: "resizes-content",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#1c1c1c" },
  ],
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body>
        <InterfaceProvider>{children}</InterfaceProvider>
      </body>
    </html>
  );
}
