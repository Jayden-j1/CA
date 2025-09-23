'use client';

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { publicNavigation, NavItem } from "@/config/navigation"; // centralized config

interface NavbarProps {
  navigation?: NavItem[];
}

const Navbar: React.FC<NavbarProps> = ({ navigation }) => {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const pathname = usePathname();

  const navItems = navigation || publicNavigation;

  return (
    <header>
      <nav className="relative bg-white border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center min-h-16 py-2">
            
            {/* Branding / Logo */}
            <div className="flex items-center flex-shrink-0">
              <span className="text-lg lg:text-xl font-bold text-gray-800 whitespace-nowrap">
                Nynangbul Cultural Awareness
              </span>
            </div>

            {/* --- Desktop Navigation (hidden on small screens) --- */}
            <div className="hidden lg:flex flex-1 items-center">
              {/* Left-aligned links */}
              <div className="flex space-x-6">
                {navItems
                  .filter((item) => item.name !== "Login/Signup") // everything except Login/Signup
                  .map((item) => (
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

              {/* Push Login/Signup to the right */}
              <div className="ml-auto">
                {navItems
                  .filter((item) => item.name === "Login/Signup")
                  .map((item) => (
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
            </div>

            {/* --- Mobile Menu Button (visible on small screens) --- */}
            <div className="lg:hidden flex items-center ml-auto">
              <button
                onClick={() => setIsOpen(!isOpen)}
                className="p-3 rounded-md text-gray-700 hover:text-blue-600 hover:bg-gray-100 focus:outline-none focus:ring-2"
                aria-label="Toggle Menu"
              >
                {isOpen ? (
                  // Close icon
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
                  // Hamburger icon
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

        {/* --- Mobile Menu Dropdown (when toggled open) --- */}
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

export default Navbar;









// 'use client';

// import { useState } from "react";
// import Link from "next/link";
// import { usePathname } from "next/navigation";
// import { publicNavigation, NavItem } from "@/config/navigation"; //  centralised config

// interface NavbarProps {
//   navigation?: NavItem[];
// }

// const Navbar: React.FC<NavbarProps> = ({ navigation }) => {
//   const [isOpen, setIsOpen] = useState<boolean>(false);
//   const pathname = usePathname();

//   const navItems = navigation || publicNavigation;

//   return (
//     <header>
//       <nav className="relative bg-white border-gray-200 shadow-sm">
//         {/* ... existing markup unchanged ... */}
//         <div className="hidden lg:flex space-x-6 items-center">
//           {navItems.map((item) => (
//             <Link
//               key={item.name}
//               href={item.href}
//               className={`px-4 py-2 font-bold rounded transition-colors duration-200 ${
//                 pathname === item.href
//                   ? "bg-blue-500 text-white"
//                   : "text-gray-700 hover:text-white hover:bg-blue-500"
//               }`}
//             >
//               {item.name}
//             </Link>
//           ))}
//         </div>

//         {/* Mobile menu also uses navItems */}
//         {isOpen && (
//           <div className="absolute z-50 w-full lg:hidden px-4 pb-4 space-y-1 bg-white shadow">
//             {navItems.map((item) => (
//               <div key={item.name} onClick={() => setIsOpen(false)}>
//                 <Link
//                   href={item.href}
//                   className={`block py-3 px-4 rounded font-bold transition-colors duration-200 ${
//                     pathname === item.href
//                       ? "bg-blue-500 text-white"
//                       : "text-gray-700 hover:text-blue-600 hover:bg-gray-100"
//                   }`}
//                 >
//                   {item.name}
//                 </Link>
//               </div>
//             ))}
//           </div>
//         )}
//       </nav>
//     </header>
//   );
// };

// export default Navbar;
