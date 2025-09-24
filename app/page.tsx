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
      {/* ✅ Suspense ensures LogoutToast works in server-side builds */}
      <Suspense fallback={null}>
        <LogoutToastHandler />
      </Suspense>

      <TopofPageContent
        HeadingOneTitle="Nyangbul Cultural Awareness"
        paragraphContent="Cultural Awareness training from the Grass-Roots Community"
        linkOne="Acknowledgement of Country"
        onClick={openAcknowledge}
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









// // app/page.tsx
// 'use client';

// import { Suspense, useState } from "react";
// import { useSearchParams } from "next/navigation"; // ✅ now safe in client
// import Section1 from "@/components/Main/section1";
// import Section2 from "@/components/Main/section2";
// import TopofPageContent from "@/components/topPage/topOfPageStyle";
// import PopUpMessage from "@/components/PopUpMsgs/popUpTemplate";
// import LogoutToast from "@/components/toasts/logoutToast"; 

// // ------------------------------
// // Inner client component just for searchParams
// // ------------------------------
// function LogoutToastHandler() {
//   const searchParams = useSearchParams();
//   const logoutSuccess = searchParams.get("logout") === "success";

//   if (logoutSuccess) {
//     // ✅ Show toast once after logout redirect
//     <LogoutToast />;
//   }

//   return null; // This component only triggers side effects
// }

// export default function Home() {
//   const title = "Acknowledgement of Country";
//   const message =
//     "We acknowledge the Traditional Custodians of the lands on which we work and live. We pay our respects to Elders past and present and extend that respect to all First Nations peoples.";

//   const [isModalOpen, setModalOpen] = useState(false);

//   const openAcknowledge = (e: React.MouseEvent<HTMLAnchorElement>) => {
//     e.preventDefault();
//     setModalOpen(true);
//   };
//   const closeAcknowledgement = () => setModalOpen(false);

//   return (
//     <>
//       {/* ✅ Wrap LogoutToastHandler in Suspense to fix build error */}
//       <Suspense fallback={null}>
//         <LogoutToastHandler />
//       </Suspense>

//       <TopofPageContent
//         HeadingOneTitle="Nyangbul Cultural Awareness"
//         paragraphContent="Cultural Awareness training from the Grass-Roots Community"
//         linkOne="Acknowledgement of Country"
//         onClick={openAcknowledge}
//       />

//       <PopUpMessage
//         isOpen={isModalOpen}
//         onClose={closeAcknowledgement}
//         heading={title}
//         message={message}
//       />

//       <Section1 />
//       <Section2 />
//     </>
//   );
// }








// 'use client';

// import Section1 from "@/components/Main/section1";
// import Section2 from "@/components/Main/section2";
// import TopofPageContent from "@/components/topPage/topOfPageStyle";
// import { useEffect, useState } from "react";
// import { useSearchParams } from "next/navigation"; // ✅ NEW: read query string
// import toast from "react-hot-toast"; // ✅ NEW: trigger logout success toast
// import PopUpMessage from "@/components/PopUpMsgs/popUpTemplate";

// export default function Home() {
//   // Heading for Acknowledgement of Country
//   const title = "Acknowledgement of Country";

//   // Message for Acknowledgement of Country
//   const message =
//     "We acknowledge the Traditional Custodians of the lands on which we work and live. We pay our respects to Elders past and present and extend that respect to all First Nations peoples.";

//   // State to control the modal's visibility
//   const [isModalOpen, setModalOpen] = useState(false);

//   // Function to open the modal, receives the mouse event
//   const openAcknowledge = (e: React.MouseEvent<HTMLAnchorElement>) => {
//     e.preventDefault(); // prevent default link behavior
//     setModalOpen(true);
//   };

//   // Function to close the modal
//   const closeAcknowledgement = () => setModalOpen(false);

//   // ✅ NEW: show a toast if redirected after logout
//   // We look for "?logout=success" (set by signOut callbackUrl) and show a success toast.
//   // The toast duration is longer so users can see it even if they start scrolling.
//   const params = useSearchParams();
//   useEffect(() => {
//     const logoutFlag = params.get("logout");
//     if (logoutFlag === "success") {
//       toast.success("You’ve been logged out successfully.", {
//         duration: 6000,
//       });
//       // Optional: If you’d like to clean up the query from the address bar
//       // you can replace the URL without a full navigation:
//       // history.replaceState(null, "", "/");
//     }
//   }, [params]);

//   return (
//     <>
//       {/* Top of page content, including Acknowledgement of Country link */}
//       <TopofPageContent
//         HeadingOneTitle="Nyangbul Cultural Awareness"
//         paragraphContent="Cultural Awareness training from the Grass-Roots Community"
//         linkOne="Acknowledgement of Country"
//         onClick={openAcknowledge} // now fully typed
//       />

//       {/* Modal component (pop up message) */}
//       <PopUpMessage
//         isOpen={isModalOpen}
//         onClose={closeAcknowledgement}
//         heading={title}
//         message={message}
//       />

//       <Section1 />
//       <Section2 />
//     </>
//   );
// }









// 'use client';

// import Section1 from "@/components/Main/section1";
// import Section2 from "@/components/Main/section2";
// import TopofPageContent from "@/components/topPage/topOfPageStyle";
// import { useState } from "react";
// import PopUpMessage from "@/components/PopUpMsgs/popUpTemplate";

// export default function Home() {
//   // Heading for Acknowledgement of Country
//   const title = "Acknowledgement of Country";

//   // Message for Acknowledgement of Country
//   const message =
//     "We acknowledge the Traditional Custodians of the lands on which we work and live. We pay our respects to Elders past and present and extend that respect to all First Nations peoples.";

//   // State to control the modal's visibility
//   const [isModalOpen, setModalOpen] = useState(false);

//   // Function to open the modal, receives the mouse event
//   const openAcknowledge = (e: React.MouseEvent<HTMLAnchorElement>) => {
//     e.preventDefault(); // prevent default link behavior
//     setModalOpen(true);
//   };

//   // Function to close the modal
//   const closeAcknowledgement = () => setModalOpen(false);

//   return (
//     <>
//       {/* Top of page content, including Acknowledgement of Country link */}
//       <TopofPageContent
//         HeadingOneTitle="Nyangbul Cultural Awareness"
//         paragraphContent="Cultural Awareness training from the Grass-Roots Community"
//         linkOne="Acknowledgement of Country"
//         onClick={openAcknowledge} // now fully typed
//       />

//       {/* Modal component (pop up message) */}
//       <PopUpMessage
//         isOpen={isModalOpen}
//         onClose={closeAcknowledgement}
//         heading={title}
//         message={message}
//       />

//       <Section1 />
//       <Section2 />
//     </>
//   );
// }









// 'use client'; // Required for using React hooks

// import { useState } from "react";
// import Section1 from "@/components/Main/section1";
// import Section2 from "@/components/Main/section2";
// import TopofPageContent from "@/components/topPage/topOfPageStyle";
// import PopUpMessage from "@/components/PopUpMsgs/popUpTemplate";

// // Optional: type for modal state
// type ModalState = boolean;

// export default function Home() {
//   // Heading for Acknowledgement of Country modal
//   const title = "Acknowledgement of Country";

//   // Message content for the modal
//   const message =
//     "We acknowledge the Traditional Custodians of the lands on which we work and live. We pay our respects to Elders past and present and extend that respect to all First Nations peoples.";

//   // State to control the modal visibility
//   const [isModalOpen, setModalOpen] = useState<ModalState>(false);

//   // Function to open the modal
//   const openAcknowledge = (e: React.MouseEvent<HTMLAnchorElement>) => {
//     e.preventDefault(); // Prevent link navigation
//     setModalOpen(true);
//   };

//   // Function to close the modal
//   const closeAcknowledgement = () => setModalOpen(false);

//   return (
//     <>
//       {/* Top of page content including Acknowledgement of Country link */}
//       <TopofPageContent
//         HeadingOneTitle="Nynangbul Cultural Awareness"
//         paragraphContent="Cultural Awareness training from the Grass-Roots Community"
//         linkOne="Acknowledgement of Country"
//         onClick={openAcknowledge} // Now matches prop type
//       />

//       {/* Modal Component (pop up message) */}
//       <PopUpMessage
//         isOpen={isModalOpen}
//         onClose={closeAcknowledgement}
//         heading={title}
//         message={message}
//       />

//       {/* Main page sections */}
//       <Section1 className="mt-40" />
//       <Section2 />
//     </>
//   );
// }










// // 'use client'; // required for using hooks
// // import Section1 from "@/components/Main/section1";
// // import Section2 from "@/components/Main/section2";
// // import TopofPageContent from "../components/topPage/topOfPageStyle";
// // import { useState } from "react";
// // import PopUpMessage from "../components/PopUpMsgs/popUpTemplate"



// // export default function Home( {} ) {

// //   // Heading for Acknowlegement of Country
// //   const title = "Acknowlegement of Country";

// //   // Message for Acknowleddgement of Country
// //   const message = "We acknowledge the Traditional Custodians of the lands on which we work and live. We pay our respects to Elders past and present and extend that respect to all First Nations peoples.";

// //   // State to control the modals visibility
// //   const [isModalOpen, setModalOpen] = useState();

  
// //   // Function to open the modal
// //   const openAcknowledge = (e) => {
// //     // PreventDefault prenets the link from navigating else where
// //     e.preventDefault();  
// //     // Show the modal
// //     setModalOpen(true);    ;
// //   }


// //   // Function to close the modal
// //   // Hide the modal
// //   const closeAcknowledgement = () => setModalOpen(false); 


// //   return (
// //     <>
// //       {/* Top of page content,including Acknowledgement of Country link */}
// //       <TopofPageContent
// //         HeadingOneTitle="Nyanbul Cultural Awareness"
// //         paragraphContent="Cultural Awareness training from the Grass-Roots Community"
// //         linkOne="Acknowledgement of Country" 
        
// //         // Pass the open handler to the link 
// //         onClick={openAcknowledge}
// //       />


// //       {/* Moda; Component (pop up message) - Only shows if isModalOpen is true */}
// //       <PopUpMessage 
// //         isOpen={isModalOpen}
// //         onClose={closeAcknowledgement}
// //         heading={title}
// //         message={message}
// //       />


// //       <Section1 className="mt-40" />
// //       <Section2 />
// //     </>
// //   );
// // }
