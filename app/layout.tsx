import "./globals.css";
import { IBM_Plex_Sans } from 'next/font/google'
import LocalFont from 'next/font/local'

const ibm_plex = IBM_Plex_Sans({
  subsets: ["latin"],
  display: "swap",
  weight: ["100", "300", "400", "500", "600", "700"],
  style: ["normal", "italic"],
  variable: "--font-ibm-plex"
});

const ibm_plex_sc = LocalFont({
  src: "./fonts/IBMPlexSansSC-Regular.woff2",
  variable: "--font-ibm-plex-sc"
})

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      {/* THEME: you can switch to another variant by changing the class name below */}
      <body className={`${ibm_plex.variable} ${ibm_plex_sc.variable} ctp-latte dark:ctp-mocha bg-background font-normal font-sans`}>
        <div className="min-h-screen w-screen flex justify-center">
          {children}
        </div>
      </body>
    </html>
  );
}