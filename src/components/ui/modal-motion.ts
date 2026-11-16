import type { MantineTransition } from "@mantine/core";

// A small depth change draws focus to the dialog without moving it across the page.
export const modalTransition: MantineTransition = {
  in: { opacity: 1, transform: "scale(1)" },
  out: { opacity: 0, transform: "scale(0.97)" },
  common: { transformOrigin: "center" },
  transitionProperty: "opacity, transform",
};
