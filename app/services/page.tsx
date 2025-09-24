'use client';
import TopofPageContent from '../../components/topPage/topOfPageStyle';
import PricingCardSection from '@/components/pricingCards/pricingCards';
import { MouseEvent } from 'react';

export default function ServicesPage() {
  const handleScrollToPricing = (e: MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    const pricingSection = document.querySelector<HTMLDivElement>('#pricing');
    pricingSection?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <main className="m-0 p-0">
      <TopofPageContent
        HeadingOneTitle="Services"
        paragraphContent="We offer cultural awareness course packages focused on the Nyanbul people of the Bundjalung nation from Ballina/Bullinah."
        linkOne="Prices Below"
        href="#pricing"
        onClick={handleScrollToPricing}
      />

      {/* Pricing Cards */}
      <PricingCardSection />
    </main>
  );
}


