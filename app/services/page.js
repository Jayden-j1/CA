export default function ServicesPage() {
    return (
        <main>
            <section className="relative w-full h-screen overflow-hidden">
                {/* Blue background (behind everything) */}
                <div className="absolute bg-blue-500 shadow-xl shadow-blue-800/30 w-full h-full -skew-y-12 -top-50 left-0 z-10 rounded-b-[100px]" />

                {/* Main content */}
                <div className="relative z-30 grid grid-cols-5 grid-rows-5 gap-4 p-8 text-white">
                    <div className="col-span-3 row-span-5 p-4 border-2">
                    <h1 className="text-8xl mb-12 font-bold">Services</h1>
                    <p className="font-semibold leading-8 text-lg">We offer a variety of packages which offer cultural awareness content focused specifically on the Nyanbul people of the     Bundjalung nation from Ballina/Bullinah.<br/>
                    Below you will find the pricing cards.
                    </p>
                    </div>
                    <div className="col-span-2 row-span-5 col-start-4 bg-black/40 p-4">Content Block 2</div>
                </div>
            </section>
        </main>
    );
}


// export default function ServicesPage() {
//     return (
//         <main>
//             <section className="relative">
             
//              {/* Background Colour 1 */}
//              <div
//               className="absolute bg-blue-500 w-full h-64 z-10 top-0 left-0"
//              ></div>

//             {/* Background Colour 2 */}
//             <div
//               className="absolute bg-red-600 w-full h-64 z-20 top-0 left-0"
//             ></div>

//                 <div className="grid grid-cols-5 grid-rows-5 gap-4">
//                     <div className="col-span-3 row-span-5">1</div>
//                     <div className="col-span-2 row-span-5 col-start-4">2</div>
//                 </div>
//             </section>
//         </main>
//     );
// }