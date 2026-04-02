import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

import { Sidebar, Header } from "@/components/Layout/SaaSLayout";
import { FirebaseAnalytics } from "@/components/FirebaseAnalytics";
import { AuthGate } from "@/components/Auth/AuthGate";
import { WorkflowStateSync } from "@/components/Auth/WorkflowStateSync";

export const metadata: Metadata = {
  title: "AutoHire24/7",
  description: "Zero-intervention job application engine",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      data-theme="dark"
      className={`${geistSans.variable} ${geistMono.variable} antialiased h-full`}
    >
      <body className="min-h-full flex flex-col">
        <AuthGate>
          <WorkflowStateSync />
          <div className="flex h-screen overflow-hidden premium-shell">
            {/* Sidebar */}
            <Sidebar />
            
            {/* Main Content Area */}
            <div className="flex-1 flex flex-col relative overflow-hidden">
              <Header />
              <main className="flex-1 overflow-y-auto no-scrollbar scroll-fade-y px-3 pb-2 md:px-5 md:pb-4">
                {children}
              </main>
            </div>
          </div>
        </AuthGate>
        <FirebaseAnalytics />
      </body>
    </html>
  );
}
