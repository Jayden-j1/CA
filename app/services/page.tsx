'use client';
import TopofPageContent from '../../components/topPage/topOfPageStyle';
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
      <section className="mt-40">
        <section id="pricing" className="w-full bg-gradient-to-b from-blue-700 to-blue-300 py-16 px-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 max-w-7xl mx-auto">
            {[1, 2, 3, 4].map((_, index) => (
              <div
                key={index}
                className="flex flex-col justify-between items-center gap-6 bg-blue-700 text-white rounded-xl p-8 shadow-xl transition-transform duration-300 hover:scale-105"
              >
                <h3 className="text-2xl font-extrabold tracking-wide">Type</h3>
                <h4 className="text-xl font-bold tracking-wider">$0.00</h4>
                <a
                  href="/signup" //  redirect to signup page
                  className="px-6 py-3 bg-green-500 text-white font-semibold rounded-full hover:bg-green-400 transition-colors duration-300"
                >
                  Get Started
                </a>
                <ul className="list-disc pl-5 space-y-2 text-sm font-medium">
                  <li>Service offered</li>
                  <li>Service offered</li>
                  <li>Service offered</li>
                  <li>Service offered</li>
                </ul>
              </div>
            ))}
          </div>
        </section>
      </section>
    </main>
  );
}









// import TopofPageContent from "../../components/topPage/topOfPageStyle";

// export default function ServicesPage() {
//     return (
//       <>
//       <main className="m-0 p-0">
//         <TopofPageContent 
//           HeadingOneTitle="Services"
//           paragraphContent="We offer a cultural awareness course content packages focused specifically on the Nyanbul people of the Bundjalung    nation from Ballina/Bullinah."
//           linkOne="Prices Below"
//           href="#pricing"
//         />

//           {/* Pricing Cards */}
//             <section className="mt-40">
                
//                 {/* Pricing Cards */}
//           <section id="pricing" className="w-full bg-gradient-to-b from-blue-700 to-blue-300 py-16 px-4">
//             <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 max-w-7xl mx-auto">
              
//               {/* Pricing Card */}
//               {[1, 2, 3, 4].map((_, index) => (
//                 <div
//                   key={index}
//                   className="flex flex-col justify-between items-center gap-6 bg-blue-700 text-white rounded-xl p-8 shadow-xl transition-transform duration-300 hover:scale-105"
//                 >
//                   <h3 className="text-2xl font-extrabold tracking-wide">Type</h3>
//                   <h4 className="text-xl font-bold tracking-wider">$0.00</h4>
//                   <a
//                     href="#"
//                     className="px-6 py-3 bg-green-500 text-white font-semibold rounded-full hover:bg-green-400 transition-colors duration-300"
//                   >
//                     Get Started
//                   </a>
//                   <ul className="list-disc pl-5 space-y-2 text-sm font-medium">
//                     <li>Service offered</li>
//                     <li>Service offered</li>
//                     <li>Service offered</li>
//                     <li>Service offered</li>
//                   </ul>
//                 </div>
//               ))}
          
//             </div>
//           </section>
          
//             </section>
//       </main>
//       </>
//     );
// }
