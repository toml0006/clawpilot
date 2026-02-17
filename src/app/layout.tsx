import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "@/components/Providers";
import { AppSidebar } from "@/components/AppSidebar";

export const metadata: Metadata = {
  title: "ClawPilot",
  description: "AI-powered task automation dashboard",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased min-h-screen bg-page text-ink font-body">
        <Providers>
          <AppSidebar />
          <main className="ml-56 py-6 pr-6 pl-8">{children}</main>
        </Providers>
      </body>
    </html>
  );
}
