import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import "./globals.css";

const geist = Geist({ variable: "--font-geist", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Bazar Casual | Gestão financeira",
  description: "Controle simples de vendas, despesas e cobranças do Bazar Casual.",
  manifest: "/manifest.webmanifest",
  applicationName: "Bazar Casual",
  appleWebApp: { capable: true, title: "Bazar Casual", statusBarStyle: "default" },
  icons: { icon: "/icon", apple: "/apple-icon" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#f4146f",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" className={geist.variable}>
      <body>{children}</body>
    </html>
  );
}
