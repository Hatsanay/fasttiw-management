import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { Toaster } from "sonner";
import "./globals.css";

const kanit = localFont({
  src: "../font/Kanit-Regular.ttf",
  variable: "--font-kanit",
});

export const metadata: Metadata = {
  title: "Fasttiw Admin",
  // ค่าเดิมเป็น description ของ template ตั้งต้น ("Project status tracking...") ซึ่งไม่เกี่ยวข้องกับระบบนี้เลย
  description: "ระบบหลังบ้านจัดการชุดข้อสอบ สิทธิ์การเข้าถึง และคำสั่งซื้อของ Fasttiw",
  robots: { index: false, follow: false }, // หลังบ้านไม่ควรอยู่บนผลค้นหา
};

// สีแถบ browser บนมือถือ — น้ำเงินแบรนด์เดียวกับฝั่งลูกค้า (brand kit ล็อคไว้ #2B5CE6)
export const viewport: Viewport = {
  themeColor: "#2B5CE6",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="th" className={`${kanit.variable} h-full antialiased overflow-x-hidden`}>
      <body className={`${kanit.className} min-h-full flex flex-col overflow-x-hidden`}>
        {children}
        <Toaster position="top-right" richColors />
      </body>
    </html>
  );
}
