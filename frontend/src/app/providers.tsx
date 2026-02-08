"use client";

import { ApplicationsProvider } from "./applications-context";
import { ThemeProvider } from "./theme-context";

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <ApplicationsProvider>{children}</ApplicationsProvider>
    </ThemeProvider>
  );
}
