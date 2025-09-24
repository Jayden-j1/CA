import Link from "next/link";

// ---------------------------
// 1. Define Type for Links
// ---------------------------

// Each footer link must have a name (string) and a link (string URL).
interface FooterLink {
  name: string;
  link: string;
}

// Strongly typed array of links
const footerLinks: FooterLink[] = [
  { name: "Privacy Policy", link: "#" },
  { name: "Terms of Service", link: "#" },
  { name: "Contact", link: "#" },
  { name: "Accessibility", link: "#" },
];

// ---------------------------
// 2. Functional Component
// ---------------------------

export default function Footer() {
  return (
    <footer className="bg-white border-t border-gray-200 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0 md:space-x-8">
          {/* Copyright */}
          <p className="text-gray-700 font-semibold text-center py-10 m-0">
            &copy; {new Date().getFullYear()} Nynangbul Cultural Awareness
          </p>

          {/* Navigation Links */}
          <ul className="flex flex-col md:flex-row items-center gap-4 md:gap-8">
            {footerLinks.map((item, index) => (
              <li key={index}>
                <Link
                  href={item.link}
                  className="text-gray-700 hover:text-white hover:bg-blue-500 transition-colors font-bold px-4 py-2 rounded focus:ring-2"
                >
                  {item.name}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </footer>
  );
}











