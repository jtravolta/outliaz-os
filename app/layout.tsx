import type { Metadata } from "next";
import { ToastProvider } from "@/components/ui/toast";
import { ShellPreferencesProvider } from "@/components/shell-preferences";
import { TooltipProvider } from "@/components/ui/tooltip";
import { preferenceScript } from "@/lib/ui-preferences";
import "@fontsource/ibm-plex-sans/latin-400.css";
import "@fontsource/ibm-plex-sans/latin-500.css";
import "@fontsource/ibm-plex-sans/latin-600.css";
import "@fontsource/ibm-plex-sans/latin-700.css";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Outliaz OS", template: "%s · Outliaz OS" },
  description: "Your personal prospect research and outreach workspace.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className="dark"
      data-theme="dark"
      data-sidebar="expanded"
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: preferenceScript }} />
      </head>
      <body>
        <ShellPreferencesProvider>
          <TooltipProvider>
            <ToastProvider>{children}</ToastProvider>
          </TooltipProvider>
        </ShellPreferencesProvider>
      </body>
    </html>
  );
}
