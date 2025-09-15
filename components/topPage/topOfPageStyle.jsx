import Image from "next/image";

export default function TopofPageContent( {HeadingOneTitle, paragraphContent, linkOne} ) {
    return (
        <>
            <section className="relative w-full py-16 md:py-24 overflow-hidden">
             
              {/* Blue background */}
              <div className="absolute inset-0 bg-blue-500 shadow-xl shadow-blue-800/30 -skew-y-6 z-10 rounded-b-[60px]" />
          
              {/* Main content */}
              <div className="relative z-30 flex flex-col md:flex-row items-center justify-between gap-8 px-6 md:px-12 text-white max-w-7xl mx-auto">
                
              {/* Left Text Block */}
                <div className="w-full md:w-3/5">
                  <h1 className="text-4xl sm:text-6xl md:text-7xl lg:text-8xl font-bold mb-6 md:mb-12 text-left">
                    {HeadingOneTitle}
                  </h1>
                  <p className="text-sm sm:text-base md:text-lg font-medium leading-relaxed mb-10">
                    {paragraphContent}
                  </p>
                          <a
                    href="#pricing"
                    className="px-6 py-3 bg-green-500 text-white font-semibold rounded-full hover:bg-green-400 transition-colors duration-300"
                    >
                    {linkOne}
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
        </>
    );
}

//  <main className="m-0 p-0">
//   <section className="relative w-full py-16 md:py-24 overflow-hidden">
//     {/* Blue background */}
//     <div className="absolute inset-0 bg-blue-500 shadow-xl shadow-blue-800/30 -skew-y-6 z-10 rounded-b-[60px]" />

//     {/* Main content */}
//     <div className="relative z-30 flex flex-col md:flex-row items-center justify-between gap-8 px-6 md:px-12 text-white max-w-7xl mx-auto">
      
//       {/* Left Text Block */}
//       <div className="w-full md:w-3/5">
//         <h1 className="text-4xl sm:text-6xl md:text-7xl lg:text-8xl font-bold mb-6 md:mb-12 text-left">
//           Services
//         </h1>
//         <p className="text-sm sm:text-base md:text-lg font-medium leading-relaxed mb-10">
//           We offer a cultural awareness course content packages focused specifically on the Nyanbul people of the Bundjalung nation from Ballina/Bullinah.
//         </p>
//                 <a
//           href="#pricing"
//           className="px-6 py-3 bg-green-500 text-white font-semibold rounded-full hover:bg-green-400 transition-colors duration-300"
//         >
//           Pricing Below
//         </a>
//       </div>
