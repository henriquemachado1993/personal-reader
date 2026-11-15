"use client";
import { MantineProvider, createTheme } from "@mantine/core";
import { useMediaQuery } from "@mantine/hooks";
import { useEffect } from "react";
import { useLibrary } from "@/modules/library/store";

const theme = createTheme({
  // Mantine rem values assume 16px; the incumbent application uses a 14px root.
  scale: 16 / 14,
  primaryColor: "dark",
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  headings: { fontFamily: 'Georgia, "Times New Roman", serif' },
  defaultRadius: "md",
  fontSizes: { xs: "12px", sm: "13px", md: "14px", lg: "16px", xl: "19px" },
  radius: { xs: "7px", sm: "12px", md: "15px", lg: "24px", xl: "32px" },
  components: {
    Button: { defaultProps: { size: "md", radius: "lg" } },
    ActionIcon: { defaultProps: { size: 44, variant: "subtle", radius: "sm" } },
    Input: { defaultProps: { size: "md", radius: "xs" } },
    NativeSelect: { defaultProps: { size: "md", radius: "xs" } },
    Textarea: { defaultProps: { size: "md", radius: "xs" } },
    Modal: {
      defaultProps: {
        centered: true,
        radius: "md",
        padding: "lg",
        overlayProps: { backgroundOpacity: 0.4 },
        transitionProps: { duration: 160 },
      },
    },
    Menu: {
      defaultProps: {
        radius: "md",
        shadow: "md",
        offset: 8,
        withinPortal: true,
      },
    },
  },
});

export function InterfaceProvider({ children }: { children: React.ReactNode }) {
  const preference = useLibrary((s) => s.preferences.theme);
  const darkSystem = useMediaQuery("(prefers-color-scheme: dark)", false);
  const scheme =
    preference === "system" ? (darkSystem ? "dark" : "light") : preference;
  useEffect(() => {
    document.documentElement.dataset.theme = scheme;
  }, [scheme]);
  return (
    <MantineProvider
      theme={theme}
      forceColorScheme={scheme}
      deduplicateCssVariables={false}
    >
      {children}
    </MantineProvider>
  );
}
