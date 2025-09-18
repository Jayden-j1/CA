'use client'; // Required if using hooks

import { useState } from "react";
import Link from "next/link";

function Navbar({ navigation }) {
  const [isOpen, setIsOpen] = useState(false);

  const defaultNavigation = [
    { name: 'Home', href: '/' },
    { name: 'About', href: '/about' },
    { name: 'Services', href: '/services' },
    { name: 'Map', href: '/map' },
    { name: 'Contact', href: '/contact' },
    { name: 'Login', href: '/login' }
  ];

  const navItems = navigation || defaultNavigation;

  return (
    <header>
      <nav className="relative bg-blue-blue-600 border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-center justify-between min-h-16 py-2">
            <div className="flex items-center flex-shrink-0 py-2">
              <span className="text-lg lg:text-xl font-bold text-gray-800 whitespace-nowrap">
                Nynangbul Cultural Awareness
              </span>
            </div>

            <div className="hidden lg:flex space-x-6 items-center">
              {navItems.map((item) => (
                <Link
                  key={item.name}
                  href={item.href}
                  className="text-gray-700 hover:text-white hover:bg-blue-500 transition-colors font-bold px-4 py-2 rounded focus:ring-2"
                >
                  {item.name}
                </Link>
              ))}
            </div>

            <div className="flex items-center lg:hidden ml-auto">
              <button
                onClick={() => setIsOpen(!isOpen)}
                className="p-3 rounded-md text-gray-700 hover:text-blue-600 hover:bg-gray-100 focus:outline-none focus:ring-2"
                aria-label="Toggle Menu"
              >
                {isOpen ? (
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                ) : (
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                )}
              </button>
            </div>
          </div>
        </div>
            
            {/* Mobile Navigation Menu */}
            {isOpen && (
              <div className="absolute z-50 w-full lg:hidden px-4 pb-4 space-y-1 bg-white shadow">
                {navItems.map((item) => (
                  <Link
                    key={item.name}
                    href={item.href}
                    onClick={() => setIsOpen(false)}
                    className="block text-gray-700 hover:text-blue-600 hover:bg-gray-100 transition-colors py-3 px-4 rounded font-bold"
                  >
                    {item.name}
                  </Link>
                ))}
              </div>
            )}
      </nav>
    </header>
  );
}

export default Navbar;
