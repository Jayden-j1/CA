'use client';

import dynamic from 'next/dynamic';

// Load the map component only on the client
const GoogleMapComponent = dynamic(
  () => import('../../components/GoogleMap/GoogleMapComponent'),
  { ssr: false }
);

export default function MapsPage() {
  return (
    <div>
      <GoogleMapComponent />
    </div>
  );
}
