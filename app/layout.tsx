import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "NECA Employers' Excellence Awards",
  description: "Applicant, Secretariat, and Jury portal for the NECA Employers' Excellence Awards",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
