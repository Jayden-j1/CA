'use client';

import React from 'react';

// Define the shape of a single pricing card's data using a TypeScript interface.
// This helps with type safety and autocompletion.
interface PricingCardProps {
  name: string;       // The title/name of the pricing package
  price: string;      // The price label for the package (e.g. "$0.00")
  services: string[]; // A list of services or features included in this package
}

// Functional React component for the Pricing Card Section.
// This component manages its own internal data (pricingCards) and renders them.
const PricingCardSection: React.FC = () => {
  // 🧾 Static array of pricing card data defined inside the component.
  // You can expand or modify this array to add more cards or change details.
  const pricingCards: PricingCardProps[] = [
    {
      name: 'Individual Package',
      price: '$0.00',
      services: [
        'Overview of Nyanbul culture',
        'Basic terminology',
        'Cultural etiquette',
        'Local area significance',
      ],
    },
    {
      name: 'Business Package',
      price: '$99.00',
      services: [
        'Deep dive into language',
        'Elder interviews',
        'Workshop resources',
        'Interactive content',
      ],
    },
  ];

  return (
    // Outer container section with margin top for spacing from previous content
    <section className="mt-40">
      {/* Inner section with an ID "pricing" to enable anchor linking and smooth scroll */}
      <section
        id="pricing"
        className="w-full bg-gradient-to-b from-blue-700 to-blue-300 py-16 px-4"
      >
        {/* Grid container to layout pricing cards responsively:
            - 1 column on small screens
            - 2 columns on small to medium screens
            - 4 columns on large screens
            Also limits max width and centers horizontally */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-8 max-w-7xl mx-auto">
          {/* Loop over each pricing card and destructure its properties for easy use */}
          {pricingCards.map(({ name, price, services }, index) => (
            <div
              key={index} // React key for list item identity
              className="flex flex-col justify-between items-center gap-6 bg-blue-700 text-white rounded-xl p-8 shadow-xl transition-transform duration-300 hover:scale-105"
            >
              {/* Package Name/Title */}
              <h3 className="text-2xl font-extrabold tracking-wide text-center">{name}</h3>

              {/* Package Price */}
              <h4 className="text-xl font-bold tracking-wider">{price}</h4>

              {/* Call to Action button linking to signup page */}
              <a
                href="/signup"
                className="px-6 py-3 bg-green-500 text-white font-semibold rounded-full hover:bg-green-400 transition-colors duration-300"
              >
                Get Started
              </a>

              {/* List of services offered in this package */}
              <ul className="list-disc pl-5 space-y-2 text-sm font-medium">
                {/* Map each service string to a <li> element with unique key */}
                {services.map((service, idx) => (
                  <li key={idx}>{service}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>
    </section>
  );
};

// Export the component as default to be imported and used in other parts of your app
export default PricingCardSection;
