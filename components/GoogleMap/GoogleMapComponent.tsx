"use client";

import { useState } from "react";
import {
  APIProvider,
  Map,
  AdvancedMarker,
  Pin,
  InfoWindow,
} from "@vis.gl/react-google-maps";
import { Polygon } from "./polygon";

// ------------------------------
// Types + Constants
// ------------------------------
interface LatLng {
  lat: number;
  lng: number;
}

const center: LatLng = { lat: -28.8628, lng: 153.5658 }; // Ballina

const clanBoundaryCoords: LatLng[] = [
  { lat: -28.72, lng: 153.529 },
  { lat: -28.7988, lng: 153.4 },
  { lat: -29.05, lng: 153.4 },
  { lat: -29.05, lng: 153.62 },
  { lat: -28.72, lng: 153.62 },
  { lat: -28.72, lng: 153.529 },
];

export default function GoogleMapComponent() {
  // ------------------------------
  // Local state (UI toggles)
  // ------------------------------
  const [infoOpen, setInfoOpen] = useState(true);
  const [showBoundary, setShowBoundary] = useState(false);
  const [useTraditionalName, setUseTraditionalName] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const town = {
    name: "Ballina",
    traditionalName: "Bullinah",
    position: center,
  };

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (!apiKey) throw new Error("Missing NEXT_PUBLIC_GOOGLE_MAPS_API_KEY");

  // ------------------------------
  // Render
  // ------------------------------
  return (
    <APIProvider apiKey={apiKey}>
      {/* ✅ Single wrapper: full width, fixed height, centered */}
      <div className="relative w-[90%] max-w-6xl h-[70vh] rounded-lg shadow-lg overflow-hidden flex items-center justify-center bg-white">
        <Map
          defaultCenter={center}
          defaultZoom={11}
          mapId={process.env.NEXT_PUBLIC_MAP_ID}
          className="w-full h-full" // force map to stretch
        >
          {/* Marker */}
          <AdvancedMarker
            position={town.position}
            onClick={() => setInfoOpen(true)}
          >
            <Pin background="gray" borderColor="green" glyphColor="purple" />
          </AdvancedMarker>

          {/* Info Window */}
          {infoOpen && (
            <InfoWindow
              position={town.position}
              onCloseClick={() => setInfoOpen(false)}
            >
              <p>{useTraditionalName ? town.traditionalName : town.name}</p>
            </InfoWindow>
          )}

          {/* Clan boundary polygon */}
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

        {/* Controls (absolute, won’t affect map centering) */}
        <div className="absolute top-28 right-4 z-20 flex flex-col items-end">
          {/* Small screen menu */}
          <div
            className={`md:hidden flex flex-col gap-2 mb-2 transition-all duration-300 overflow-hidden ${
              menuOpen ? "max-h-40 opacity-100" : "max-h-0 opacity-0"
            }`}
            style={{ width: "160px" }}
          >
            <button
              onClick={() => {
                setShowBoundary((p) => !p);
                setMenuOpen(false);
              }}
              className="w-full bg-green-700 text-white px-3 py-1.5 rounded hover:bg-green-800 transition text-sm text-center cursor-pointer"
            >
              {showBoundary ? "Hide Clan Boundary" : "Show Clan Boundary"}
            </button>
            <button
              onClick={() => {
                setUseTraditionalName((p) => !p);
                setInfoOpen(true);
                setMenuOpen(false);
              }}
              className="w-full bg-blue-700 text-white px-3 py-1.5 rounded hover:bg-blue-800 transition text-sm text-center cursor-pointer"
            >
              {useTraditionalName ? "Show Current Name" : "Show Traditional Name"}
            </button>
          </div>

          {/* Medium+ screen buttons */}
          <div className="hidden md:flex flex-col gap-3 w-auto min-w-[180px] bg-white bg-opacity-90 p-4 rounded-lg shadow-md">
            <button
              onClick={() => setShowBoundary((p) => !p)}
              className="bg-green-700 text-white px-5 py-2 rounded hover:bg-green-800 transition text-center cursor-pointer"
            >
              {showBoundary ? "Hide Clan Boundary" : "Show Clan Boundary"}
            </button>
            <button
              onClick={() => {
                setUseTraditionalName((p) => !p);
                setInfoOpen(true);
              }}
              className="bg-blue-700 text-white px-5 py-2 rounded hover:bg-blue-800 transition text-center cursor-pointer"
            >
              {useTraditionalName ? "Show Current Name" : "Show Traditional Name"}
            </button>
          </div>

          {/* Toggle menu (small screens) */}
          <button
            onClick={() => setMenuOpen((prev) => !prev)}
            aria-label={menuOpen ? "Close Menu" : "Open Menu"}
            className="md:hidden w-12 h-12 rounded-full bg-green-700 hover:bg-green-800 text-white shadow-lg flex items-center justify-center transition cursor-pointer"
          >
            {menuOpen ? "✖" : "☰"}
          </button>
        </div>
      </div>
    </APIProvider>
  );
}
