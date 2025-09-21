import { ReactNode } from "react";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Navbar from '@/components/Header/NavBar';
import Footer from '@/components/Footer/footer';

// Explicitly type the props
interface RootLayoutProps {
  children: ReactNode; // Covers any valid JSX content
}

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="en">
      <body>
        <Navbar /> {/* Displayed on every page */}
        {children} {/* Page content */}
        <Footer /> {/* Displayed on every page */}
      </body>
    </html>
  );
}
