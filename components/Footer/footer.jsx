import Link from "next/link";

const footerLinks = [
  { name: "Privacy Policy", link: "#" },
  { name: "Terms of Service", link: "#" },
  { name: "Contact", link: "#" },
  { name: "Accessibility", link: "#" }
];

export default function Footer() {
  return (
    <footer className="bg-white border-t border-gray-200 shadow-sm mt-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0 md:space-x-8">
          <p className="text-gray-700 font-semibold text-center md:text-left">
            &copy; {new Date().getFullYear()} Nynangbul Cultural Awareness
          </p>

          <ul className="flex flex-col md:flex-row items-center gap-4 md:gap-8">
            {footerLinks.map((item, index) => (
              <li key={index}>
                <Link
                  href={item.link}
                  className="text-gray-700 hover:text-blue-600 hover:bg-gray-100 transition-colors font-semibold px-4 py-2 rounded focus:ring-2"
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
