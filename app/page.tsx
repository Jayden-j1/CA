// app/page.tsx
'use client';

import { Suspense, useState } from "react";
import Section1 from "@/components/Main/section1";
import Section2 from "@/components/Main/section2";
import TopofPageContent from "@/components/topPage/topOfPageStyle";
import PopUpMessage from "@/components/PopUpMsgs/popUpTemplate";
import LogoutToast from "@/components/toasts/logoutToast"; 

// ------------------------------
// Wrapper to safely render LogoutToast in Suspense
// ------------------------------
// - This ensures useSearchParams inside LogoutToast
//   doesn’t break prerendering.
// ------------------------------
function LogoutToastHandler() {
  return <LogoutToast />; // ✅ Correctly render the component
}

export default function Home() {
  const title = "Acknowledgement of Country";
  const message =
    "We acknowledge the Traditional Custodians of the lands on which we work and live. We pay our respects to Elders past and present and extend that respect to all First Nations peoples.";

  const [isModalOpen, setModalOpen] = useState(false);

  const openAcknowledge = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    setModalOpen(true);
  };
  const closeAcknowledgement = () => setModalOpen(false);

  return (
    <>
      {/*  Suspense ensures LogoutToast works in server-side builds */}
      <Suspense fallback={null}>
        <LogoutToastHandler />
      </Suspense>

      <TopofPageContent
        HeadingOneTitle="Nyangbul Cultural Awareness"
        paragraphContent="Cultural Awareness training from the Grass-Roots Community"
        linkOne="Acknowledgement of Country"
        onClick={openAcknowledge}
        imageSrc="/images/dolphin logo.png"
        imageAlt="Aboriginal Style Image of a Dolphin"
      />

      <PopUpMessage
        isOpen={isModalOpen}
        onClose={closeAcknowledgement}
        heading={title}
        message={message}
      />

      <Section1 />
      <Section2 />
    </>
  );
}









