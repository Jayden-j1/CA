'use client';

import {
  APIProvider,
  Map,
  AdvancedMarker,
  Pin,
  InfoWindow,
} from '@vis.gl/react-google-maps';
import { useState } from 'react';
import { Polygon } from './polygon'; // Your custom Polygon component

const center = { lat: -28.8628, lng: 153.5658 }; // Ballina

// Longitude and Latitude for Clan Boundary
const clanBoundaryCoords = [
  { lat: -28.72, lng: 153.529 },
  { lat: -28.7988, lng: 153.400 },
  { lat: -28.8167, lng: 153.400 },
  { lat: -28.8167, lng: 153.4 },
  { lat: -29.05, lng: 153.4 },
  { lat: -29.05, lng: 153.62 },
  { lat: -28.72, lng: 153.62 },
  { lat: -28.72, lng: 153.529 },
];

export default function GoogleMapComponent() {
  const [infoOpen, setInfoOpen] = useState(true);
  const [showBoundary, setShowBoundary] = useState(false);
  const [useTraditionalName, setUseTraditionalName] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const town = {
    name: 'Ballina',
    traditionalName: 'Bullinah',
    position: center,
  };

  const toggleBoundary = () => {
    setShowBoundary((prev) => !prev);
    setMenuOpen(false);
  };

  const toggleName = () => {
    setUseTraditionalName((prev) => !prev);
    setInfoOpen(true);
    setMenuOpen(false);
  };

  return (
    <APIProvider apiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}>
      {/* Flex container to center the map */}
      <div className="flex justify-center items-center min-h-[calc(100vh-64px)] px-4">
        {/* Map container with responsive, constrained sizing */}
        <div
          className="
            relative
            w-full
            max-w-6xl
            h-[60vh]
            sm:h-[65vh]
            md:h-[70vh]
            lg:h-[75vh]
            xl:h-[80vh]
            rounded-lg
            shadow-lg
            overflow-hidden
            transition-all duration-500 ease-in-out
          "
        >
          <Map
            defaultCenter={center}
            defaultZoom={11}
            mapId={process.env.NEXT_PUBLIC_MAP_ID}
            className="w-full h-full"
          >
            <AdvancedMarker position={town.position} onClick={() => setInfoOpen(true)}>
              <Pin background="gray" borderColor="green" glyphColor="purple" />
            </AdvancedMarker>

            {infoOpen && (
              <InfoWindow position={town.position} onCloseClick={() => setInfoOpen(false)}>
                <p>{useTraditionalName ? town.traditionalName : town.name}</p>
              </InfoWindow>
            )}

            {showBoundary && (
              <Polygon
                paths={clanBoundaryCoords}
                strokeColor="#004d00"
                strokeOpacity={0.8}
                strokeWeight={2}
                fillColor="#008000"
                fillOpacity={0.3}
              />
            )}
          </Map>

          {/* Controls (absolute inside the map container) */}
          <div className="absolute top-28 right-4 z-20 flex flex-col items-end">
            {/* Collapsible menu for small screens */}
            <div
              className={`md:hidden flex flex-col gap-2 mb-2 transition-all duration-300 ease-in-out overflow-hidden
              ${menuOpen ? 'max-h-40 opacity-100' : 'max-h-0 opacity-0'}
            `}
              style={{ width: '160px' }} // <-- Reduced width from 180px to 160px
            >
              <button
                onClick={toggleBoundary}
                className="w-full bg-green-700 text-white px-3 py-1.5 rounded hover:bg-green-800 transition whitespace-normal text-sm text-center break-words"
              >
                {showBoundary ? 'Hide Clan Boundary' : 'Show Clan Boundary'}
              </button>
              <button
                onClick={toggleName}
                className="w-full bg-blue-700 text-white px-3 py-1.5 rounded hover:bg-blue-800 transition whitespace-normal text-sm text-center break-words"
              >
                {useTraditionalName ? 'Show Current Name' : 'Show Traditional Name'}
              </button>
            </div>

            {/* Visible buttons for medium+ screens */}
            <div className="hidden md:flex flex-col gap-3 w-auto min-w-[180px] bg-white bg-opacity-90 p-4 rounded-lg shadow-md">
              <button
                onClick={toggleBoundary}
                className="bg-green-700 text-white px-5 py-2 rounded hover:bg-green-800 transition whitespace-nowrap text-center"
              >
                {showBoundary ? 'Hide Clan Boundary' : 'Show Clan Boundary'}
              </button>
              <button
                onClick={toggleName}
                className="bg-blue-700 text-white px-5 py-2 rounded hover:bg-blue-800 transition whitespace-nowrap text-center"
              >
                {useTraditionalName ? 'Show Current Name' : 'Show Traditional Name'}
              </button>
            </div>

            {/* Toggle button for small screens */}
            <button
              onClick={() => setMenuOpen((prev) => !prev)}
              aria-label={menuOpen ? 'Close Menu' : 'Open Menu'}
              className="md:hidden w-12 h-12 rounded-full bg-green-700 hover:bg-green-800 text-white shadow-lg flex items-center justify-center transition focus:outline-none focus:ring-2 focus:ring-green-400"
            >
              {menuOpen ? (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-7 w-7"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-7 w-7"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>
    </APIProvider>
  );
}



// 'use client';

// import {
//   APIProvider,
//   Map,
//   AdvancedMarker,
//   Pin,
//   InfoWindow,
// } from '@vis.gl/react-google-maps';
// import { useState } from 'react';
// import { Polygon } from './polygon'; // Your custom Polygon component

// const center = { lat: -28.8628, lng: 153.5658 }; // Ballina

// // Longitude and Latitude for Clan Boundary
// const clanBoundaryCoords = [
//   { lat: -28.72, lng: 153.529 },
//   { lat: -28.7988, lng: 153.400 },
//   { lat: -28.8167, lng: 153.400 },
//   { lat: -28.8167, lng: 153.4 },
//   { lat: -29.05, lng: 153.4 },
//   { lat: -29.05, lng: 153.62 },
//   { lat: -28.72, lng: 153.62 },
//   { lat: -28.72, lng: 153.529 },
// ];

// export default function GoogleMapComponent() {
//   const [infoOpen, setInfoOpen] = useState(true);
//   const [showBoundary, setShowBoundary] = useState(false);
//   const [useTraditionalName, setUseTraditionalName] = useState(false);
//   const [menuOpen, setMenuOpen] = useState(false);

//   const town = {
//     name: 'Ballina',
//     traditionalName: 'Bullinah',
//     position: center,
//   };

//   const toggleBoundary = () => {
//     setShowBoundary((prev) => !prev);
//     setMenuOpen(false);
//   };

//   const toggleName = () => {
//     setUseTraditionalName((prev) => !prev);
//     setInfoOpen(true);
//     setMenuOpen(false);
//   };

//   return (
//     <APIProvider apiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}>
//       {/* Flex container to center the map */}
//       <div className="flex justify-center items-center min-h-[calc(100vh-64px)] px-4">
//         {/* Map container with responsive, constrained sizing */}
//         <div
//           className="
//             relative
//             w-full
//             max-w-6xl
//             h-[60vh]
//             sm:h-[65vh]
//             md:h-[70vh]
//             lg:h-[75vh]
//             xl:h-[80vh]
//             rounded-lg
//             shadow-lg
//             overflow-hidden
//             transition-all duration-500 ease-in-out
//           "
//         >
//           <Map
//             defaultCenter={center}
//             defaultZoom={11}
//             mapId={process.env.NEXT_PUBLIC_MAP_ID}
//             className="w-full h-full"
//           >
//             <AdvancedMarker position={town.position} onClick={() => setInfoOpen(true)}>
//               <Pin background="gray" borderColor="green" glyphColor="purple" />
//             </AdvancedMarker>

//             {infoOpen && (
//               <InfoWindow position={town.position} onCloseClick={() => setInfoOpen(false)}>
//                 <p>{useTraditionalName ? town.traditionalName : town.name}</p>
//               </InfoWindow>
//             )}

//             {showBoundary && (
//               <Polygon
//                 paths={clanBoundaryCoords}
//                 strokeColor="#004d00"
//                 strokeOpacity={0.8}
//                 strokeWeight={2}
//                 fillColor="#008000"
//                 fillOpacity={0.3}
//               />
//             )}
//           </Map>

//           {/* Controls (absolute inside the map container) */}
//           <div className="absolute top-28 right-4 z-20 flex flex-col items-end">
//             {/* Collapsible menu for small screens */}
//             <div
//               className={`md:hidden flex flex-col gap-3 mb-2 transition-all duration-300 ease-in-out overflow-hidden
//               ${menuOpen ? 'max-h-40 opacity-100' : 'max-h-0 opacity-0'}
//             `}
//               style={{ width: '180px' }}
//             >
//               <button
//                 onClick={toggleBoundary}
//                 className="w-full bg-green-700 text-white px-5 py-2 rounded hover:bg-green-800 transition whitespace-nowrap text-center"
//               >
//                 {showBoundary ? 'Hide Clan Boundary' : 'Show Clan Boundary'}
//               </button>
//               <button
//                 onClick={toggleName}
//                 className="w-full bg-blue-700 text-white px-5 py-2 rounded hover:bg-blue-800 transition whitespace-nowrap text-center"
//               >
//                 {useTraditionalName ? 'Show Current Name' : 'Show Traditional Name'}
//               </button>
//             </div>

//             {/* Visible buttons for medium+ screens */}
//             <div className="hidden md:flex flex-col gap-3 w-auto min-w-[180px] bg-white bg-opacity-90 p-4 rounded-lg shadow-md">
//               <button
//                 onClick={toggleBoundary}
//                 className="bg-green-700 text-white px-5 py-2 rounded hover:bg-green-800 transition whitespace-nowrap text-center"
//               >
//                 {showBoundary ? 'Hide Clan Boundary' : 'Show Clan Boundary'}
//               </button>
//               <button
//                 onClick={toggleName}
//                 className="bg-blue-700 text-white px-5 py-2 rounded hover:bg-blue-800 transition whitespace-nowrap text-center"
//               >
//                 {useTraditionalName ? 'Show Current Name' : 'Show Traditional Name'}
//               </button>
//             </div>

//             {/* Toggle button for small screens */}
//             <button
//               onClick={() => setMenuOpen((prev) => !prev)}
//               aria-label={menuOpen ? 'Close Menu' : 'Open Menu'}
//               className="md:hidden w-14 h-14 rounded-full bg-green-700 hover:bg-green-800 text-white shadow-lg flex items-center justify-center transition focus:outline-none focus:ring-2 focus:ring-green-400"
//             >
//               {menuOpen ? (
//                 <svg
//                   xmlns="http://www.w3.org/2000/svg"
//                   className="h-7 w-7"
//                   fill="none"
//                   viewBox="0 0 24 24"
//                   stroke="currentColor"
//                 >
//                   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
//                 </svg>
//               ) : (
//                 <svg
//                   xmlns="http://www.w3.org/2000/svg"
//                   className="h-7 w-7"
//                   fill="none"
//                   viewBox="0 0 24 24"
//                   stroke="currentColor"
//                 >
//                   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
//                 </svg>
//               )}
//             </button>
//           </div>
//         </div>
//       </div>
//     </APIProvider>
//   );
// }
