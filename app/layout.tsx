import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { cookies } from "next/headers";
import { ActiveThemeProvider } from "@abe-techlab/abe-techlab-design-system/react";
import { AppearanceProvider, type AppearanceMode } from "@/components/appearance-provider";
import { DEFAULT_DESIGN_THEME, isDesignThemeId } from "@/lib/design-system";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "ABEmail — Business email for teams",
    template: "%s | ABEmail",
  },
  description:
    "ABEmail is ABE TechLab's business email workspace for organizations and their teams.",
  applicationName: "ABEmail",
  robots: {
    index: false,
    follow: false,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  colorScheme: "light dark",
  themeColor: "#101713",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  const cookieStore = await cookies();
  const savedTheme = cookieStore.get("active_theme")?.value;
  const initialTheme = isDesignThemeId(savedTheme) ? savedTheme : DEFAULT_DESIGN_THEME;
  const savedMode = cookieStore.get("appearance_mode")?.value;
  const initialMode: AppearanceMode =
    savedMode === "dark" || savedMode === "system" || savedMode === "light"
      ? savedMode
      : "light";

  return (
    <html
      lang="en"
      data-theme={initialTheme}
      className={initialMode === "dark" ? "dark" : undefined}
    >
      <body>
        <ActiveThemeProvider initialTheme={initialTheme} storage="cookie">
          <AppearanceProvider initialMode={initialMode}>{children}</AppearanceProvider>
        </ActiveThemeProvider>
      </body>
    </html>
  );
}
