'use client';
import dynamic from 'next/dynamic';
import TopofPageContent from '../../components/topPage/topOfPageStyle';


// Load the map component only on the client
const GoogleMapComponent = dynamic(
  () => import('../../components/GoogleMap/GoogleMapComponent'),
  { ssr: false }
);

export default function MapsPage() {
  return (
    <>
    <TopofPageContent 
      HeadingOneTitle="Map Boundary"
      paragraphContent="Placeholder text for now"
    />
    <div>
      <GoogleMapComponent />
    </div>
    </>
  );
}
