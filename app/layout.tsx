import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Navbar from '@/components/Header/header';
import Footer from '@/components/Footer/footer';


export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <Navbar /> {/* Now shown on every page */}
        {children}
        <Footer /> {/* Now shown on every page */}
      </body>
    </html>
  );
}
