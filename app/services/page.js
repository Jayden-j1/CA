import Image from "next/image";

export default function ServicesPage() {
    return (
<main className="m-0 p-0">
  <section className="relative w-full py-16 md:py-24 overflow-hidden">
    {/* Blue background */}
    <div className="absolute inset-0 bg-blue-500 shadow-xl shadow-blue-800/30 -skew-y-6 z-10 rounded-b-[60px]" />

    {/* Main content */}
    <div className="relative z-30 flex flex-col md:flex-row items-center justify-between gap-8 px-6 md:px-12 text-white max-w-7xl mx-auto">
      
      {/* Left Text Block */}
      <div className="w-full md:w-3/5">
        <h1 className="text-4xl sm:text-6xl md:text-7xl lg:text-8xl font-bold mb-6 md:mb-12 text-left">
          Services
        </h1>
        <p className="text-sm sm:text-base md:text-lg font-medium leading-relaxed mb-10">
          We offer a cultural awareness course content packages focused specifically on the Nyanbul people of the Bundjalung nation from Ballina/Bullinah.
        </p>
                <a
          href="#pricing"
          className="px-6 py-3 bg-green-500 text-white font-semibold rounded-full hover:bg-green-400 transition-colors duration-300"
        >
          Pricing Below
        </a>
      </div>

      {/* Right Content Block */}
      <div className="hidden md:block md:w-2/5 p-4 rounded-lg shadow-md relative h-52">
        <Image 
            src="/images/country.jpeg"
            alt="Image of an Aborginal Australian dot painting, primary colour used is blue."
            fill
            className="absolute object-cover rounded-lg shadow-2xl"
        />
      </div>
    </div>
  </section>

  {/* Pricing Cards */}
  <section className="mt-40">
        {/* Pricing Cards */}
<section id="pricing" className="w-full bg-gradient-to-b from-blue-700 to-blue-300 py-16 px-4">
  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 max-w-7xl mx-auto">
    
    {/* Pricing Card */}
    {[1, 2, 3, 4].map((_, index) => (
      <div
        key={index}
        className="flex flex-col justify-between items-center gap-6 bg-blue-700 text-white rounded-xl p-8 shadow-xl transition-transform duration-300 hover:scale-105"
      >
        <h3 className="text-2xl font-extrabold tracking-wide">Type</h3>
        <h4 className="text-xl font-bold tracking-wider">$0.00</h4>
        <a
          href="#"
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

    // <div className="flex flex-col justify-center items-center w-full border-2 gap-8">
    
    // {/* Pricing Card 1 */}
    // <div className="flex flex-col justify-center items-center gap-4 bg-blue-700">
    //     <h3 className="font-extrabold text-white">Type</h3>
    //     <h4 className="font-bold text-white">$0.00</h4>
    //     <a href="#" className="px-8 py-4 bg-green-500 text-white font-bold rounded-4xl hover:bg-green-400"
    //     >
    //     Get Started
    //     </a>
    //     <ul className="list-disc">
    //         <li className="font-bold text-white">Service offered</li>
    //         <li className="font-bold text-white">Service offered</li>
    //         <li className="font-bold text-white">Service offered</li>
    //         <li className="font-bold text-white">Service offered</li>
    //     </ul>
    // </div>

    // {/* Pricing Card 2 */}
    // <div className="flex flex-col justify-center items-center gap-4 bg-blue-700">
    //     <h3 className="font-extrabold text-white">Type</h3>
    //     <h4 className="font-bold text-white">$0.00</h4>
    //     <a href="#" className="px-8 py-4 bg-green-500 text-white font-bold rounded-4xl hover:bg-green-400"
    //     >
    //     Get Started
    //     </a>
    //     <ul className="list-disc">
    //         <li className="font-bold text-white">Service offered</li>
    //         <li className="font-bold text-white">Service offered</li>
    //         <li className="font-bold text-white">Service offered</li>
    //         <li className="font-bold text-white">Service offered</li>
    //     </ul>
    // </div>

    // {/* Pricing Card 3 */}
    // <div className="flex flex-col justify-center items-center gap-4 bg-blue-700">
    //     <h3 className="font-extrabold text-white">Type</h3>
    //     <h4 className="font-bold text-white">$0.00</h4>
    //     <a href="#" className="px-8 py-4 bg-green-500 text-white font-bold rounded-4xl hover:bg-green-400"
    //     >
    //     Get Started
    //     </a>
    //     <ul className="list-disc">
    //         <li className="font-bold text-white">Service offered</li>
    //         <li className="font-bold text-white">Service offered</li>
    //         <li className="font-bold text-white">Service offered</li>
    //         <li className="font-bold text-white">Service offered</li>
    //     </ul>
    // </div>

    // {/* Pricing Card 4 */}
    // <div className="flex flex-col justify-center items-center gap-4 bg-blue-700">
    //     <h3 className="font-extrabold text-white">Type</h3>
    //     <h4 className="font-bold text-white">$0.00</h4>
    //     <a href="#" className="px-8 py-4 bg-green-500 text-white font-bold rounded-4xl hover:bg-green-400"
    //     >
    //     Get Started
    //     </a>
    //     <ul className="list-disc">
    //         <li className="font-bold text-white">Service offered</li>
    //         <li className="font-bold text-white">Service offered</li>
    //         <li className="font-bold text-white">Service offered</li>
    //         <li className="font-bold text-white">Service offered</li>
    //     </ul>
    // </div>
    // </div> 