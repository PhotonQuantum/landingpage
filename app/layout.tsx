import "./globals.css";
import { SessionProvider } from "next-auth/react";
import { IBM_Plex_Sans } from 'next/font/google'

const ibm_plex = IBM_Plex_Sans({
  subsets: ["latin"],
  display: "swap",
  weight: ["100", "300", "400", "500", "600", "700"],
  style: ["normal", "italic"],
});

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      {/* THEME: you can switch to another variant by changing the class name below */}
      <body className={`ctp-latte dark:ctp-mocha bg-background font-light ${ibm_plex.className}`}>
        <div className="min-h-screen w-screen flex justify-center">
          <SessionProvider>
            {children}
          </SessionProvider>
        </div>
      </body>
    </html>
  );
}