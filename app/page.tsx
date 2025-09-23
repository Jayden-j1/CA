'use client';

import Section1 from "@/components/Main/section1";
import Section2 from "@/components/Main/section2";
import TopofPageContent from "@/components/topPage/topOfPageStyle";
import { useState } from "react";
import PopUpMessage from "@/components/PopUpMsgs/popUpTemplate";

export default function Home() {
  // Heading for Acknowledgement of Country
  const title = "Acknowledgement of Country";

  // Message for Acknowledgement of Country
  const message =
    "We acknowledge the Traditional Custodians of the lands on which we work and live. We pay our respects to Elders past and present and extend that respect to all First Nations peoples.";

  // State to control the modal's visibility
  const [isModalOpen, setModalOpen] = useState(false);

  // Function to open the modal, receives the mouse event
  const openAcknowledge = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault(); // prevent default link behavior
    setModalOpen(true);
  };

  // Function to close the modal
  const closeAcknowledgement = () => setModalOpen(false);

  return (
    <>
      {/* Top of page content, including Acknowledgement of Country link */}
      <TopofPageContent
        HeadingOneTitle="Nyangbul Cultural Awareness"
        paragraphContent="Cultural Awareness training from the Grass-Roots Community"
        linkOne="Acknowledgement of Country"
        onClick={openAcknowledge} // now fully typed
      />

      {/* Modal component (pop up message) */}
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
