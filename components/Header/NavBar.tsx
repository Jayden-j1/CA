'use client';

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

// ---------------------------
// 1. Type definitions
// ---------------------------
type NavItem = {
  name: string;
  href: string;
};

interface NavbarProps {
  navigation?: NavItem[];
}

// ---------------------------
// 2. Navbar Component
// ---------------------------
const Navbar: React.FC<NavbarProps> = ({ navigation }) => {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const pathname = usePathname(); // highlight current page

  const defaultNavigation: NavItem[] = [
    { name: "Home", href: "/" },
    { name: "About", href: "/about" },
    { name: "Services", href: "/services" },
    { name: "Map", href: "/map" },
    { name: "Contact", href: "/contact" },
    { name: "Login", href: "/login" },
  ];

  const navItems = navigation || defaultNavigation;

  return (
    <header>
      <nav className="relative bg-white border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-center justify-between min-h-16 py-2">
            
            {/* Branding / Logo */}
            <div className="flex items-center flex-shrink-0 py-2">
              <span className="text-lg lg:text-xl font-bold text-gray-800 whitespace-nowrap">
                Nynangbul Cultural Awareness
              </span>
            </div>

            {/* Desktop Navigation */}
            <div className="hidden lg:flex space-x-6 items-center">
              {navItems.map((item) => (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`px-4 py-2 font-bold rounded transition-colors duration-200 ${
                    pathname === item.href
                      ? "bg-blue-500 text-white"
                      : "text-gray-700 hover:text-white hover:bg-blue-500"
                  }`}
                >
                  {item.name}
                </Link>
              ))}
            </div>

            {/* Mobile menu button */}
            <div className="flex items-center lg:hidden ml-auto">
              <button
                onClick={() => setIsOpen(!isOpen)}
                className="p-3 rounded-md text-gray-700 hover:text-blue-600 hover:bg-gray-100 focus:outline-none focus:ring-2"
                aria-label="Toggle Menu"
              >
                {isOpen ? (
                  <svg
                    className="w-6 h-6"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                ) : (
                  <svg
                    className="w-6 h-6"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 6h16M4 12h16M4 18h16"
                    />
                  </svg>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Menu */}
        {isOpen && (
          <div className="absolute z-50 w-full lg:hidden px-4 pb-4 space-y-1 bg-white shadow">
            {navItems.map((item) => (
              <div key={item.name} onClick={() => setIsOpen(false)}>
                <Link
                  href={item.href}
                  className={`block py-3 px-4 rounded font-bold transition-colors duration-200 ${
                    pathname === item.href
                      ? "bg-blue-500 text-white"
                      : "text-gray-700 hover:text-blue-600 hover:bg-gray-100"
                  }`}
                >
                  {item.name}
                </Link>
              </div>
            ))}
          </div>
        )}
      </nav>
    </header>
  );
};

// ---------------------------
// 3. Export
// ---------------------------
export default Navbar;













// 'use client'; // Required in Next.js for components using hooks or client-side interactivity

// import { useState } from "react";
// import Link from "next/link";

// // ---------------------------
// // 1. Define TypeScript types
// // ---------------------------

// // Each navigation item must follow this shape (object with `name` and `href`).
// // By defining this, we ensure that only valid objects are passed into the component.
// type NavItem = {
//   name: string; // The text label shown in the menu
//   href: string; // The URL the item links to
// };

// // Props expected by the Navbar component
// // - navigation is optional, if not provided we fall back to a default menu.
// interface NavbarProps {
//   navigation?: NavItem[];
// }

// // ---------------------------
// // 2. Functional Component
// // ---------------------------

// // The component is explicitly typed with `React.FC` (Functional Component)
// // This improves readability and ensures strong typing of props.
// const Navbar: React.FC<NavbarProps> = ({ navigation }) => {
//   // State to control whether the mobile menu is open or closed
//   const [isOpen, setIsOpen] = useState<boolean>(false);

//   // Default navigation menu (used if no `navigation` prop is passed)
//   const defaultNavigation: NavItem[] = [
//     { name: "Home", href: "/" },
//     { name: "About", href: "/about" },
//     { name: "Services", href: "/services" },
//     { name: "Map", href: "/map" },
//     { name: "Contact", href: "/contact" },
//     { name: "Login", href: "/login" },
//   ];

//   // If `navigation` prop is provided, use it. Otherwise, use defaults.
//   const navItems: NavItem[] = navigation || defaultNavigation;

//   // ---------------------------
//   // 3. Render JSX
//   // ---------------------------
//   return (
//     <header>
//       <nav className="relative bg-white border-gray-200 shadow-sm">
//         <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
//           <div className="flex flex-wrap items-center justify-between min-h-16 py-2">
            
//             {/* Branding / Logo */}
//             <div className="flex items-center flex-shrink-0 py-2">
//               <span className="text-lg lg:text-xl font-bold text-gray-800 whitespace-nowrap">
//                 Nynangbul Cultural Awareness
//               </span>
//             </div>

//             {/* Desktop Navigation (visible on large screens and above) */}
//             <div className="hidden lg:flex space-x-6 items-center">
//               {navItems.map((item: NavItem) => (
//                 <Link
//                   key={item.name}
//                   href={item.href}
//                   className="text-gray-700 hover:text-white hover:bg-blue-500 transition-colors font-bold px-4 py-2 rounded focus:ring-2"
//                 >
//                   {item.name}
//                 </Link>
//               ))}
//             </div>

//             {/* Mobile menu button (hamburger / close icon) */}
//             <div className="flex items-center lg:hidden ml-auto">
//               <button
//                 onClick={() => setIsOpen(!isOpen)} // Toggle menu open/close
//                 className="p-3 rounded-md text-gray-700 hover:text-blue-600 hover:bg-gray-100 focus:outline-none focus:ring-2"
//                 aria-label="Toggle Menu"
//               >
//                 {isOpen ? (
//                   // Close icon (X)
//                   <svg
//                     className="w-6 h-6"
//                     fill="none"
//                     stroke="currentColor"
//                     viewBox="0 0 24 24"
//                   >
//                     <path
//                       strokeLinecap="round"
//                       strokeLinejoin="round"
//                       strokeWidth={2}
//                       d="M6 18L18 6M6 6l12 12"
//                     />
//                   </svg>
//                 ) : (
//                   // Hamburger icon (3 lines)
//                   <svg
//                     className="w-6 h-6"
//                     fill="none"
//                     stroke="currentColor"
//                     viewBox="0 0 24 24"
//                   >
//                     <path
//                       strokeLinecap="round"
//                       strokeLinejoin="round"
//                       strokeWidth={2}
//                       d="M4 6h16M4 12h16M4 18h16"
//                     />
//                   </svg>
//                 )}
//               </button>
//             </div>
//           </div>
//         </div>

//         {/* Mobile Navigation Menu (only visible if menu is open) */}
//         {isOpen && (
//           <div className="absolute z-50 w-full lg:hidden px-4 pb-4 space-y-1 bg-white shadow">
//             {navItems.map((item: NavItem) => (
//               <Link
//                 key={item.name}
//                 href={item.href}
//                 // When a menu item is clicked, close the mobile menu
//                 onClick={() => setIsOpen(false)}
//                 className="block text-gray-700 hover:text-blue-600 hover:bg-gray-100 transition-colors py-3 px-4 rounded font-bold"
//               >
//                 {item.name}
//               </Link>
//             ))}
//           </div>
//         )}
//       </nav>
//     </header>
//   );
// };

// // ---------------------------
// // 4. Export
// // ---------------------------
// export default Navbar;

