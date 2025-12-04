// app/contact/page.tsx
//
// Purpose
// -------
// Render the public "Contact us" page, composed of:
//  - A top-of-page hero/intro section (TopofPageContent).
//  - A contact section containing the ContactFormComponent.
//
// Notes
// -----
// - This page is a simple composition layer: it does NOT implement any form
//   submission logic itself.
// - The ContactFormComponent currently posts to "#" and has no backend wiring.
//   When you add a real API route for contact submissions, you will either:
//     • update the form action/method, or
//     • add an onSubmit handler and call your API from the client.
// - The background image is applied inline via style={{ backgroundImage: ... }}.
//   Make sure the file exists in /public/images/ and the path matches exactly.
//
// Pillars
// -------
// - Simplicity: small component, easy to scan.
// - Ease of management: keeps Content (hero copy + form) in one place.
// - Security: no data handling here; backend route(s) must validate input.

import TopofPageContent from "../../components/topPage/topOfPageStyle";
import ContactFormComponent from "../../components/forms/contactForm";

export default function ContactPage() {
  return (
    <>
      {/* Hero / intro section at the top of the Contact page */}
      <TopofPageContent
        HeadingOneTitle="Contact us"
        paragraphContent="Placeholder text for now."
        linkOne="Contact form below"
        href="#contact"
        imageSrc="/images/humpback whale logo 1.png"
        imageAlt="Aboriginal style image of a Whale"
      />

      {/* Contact section
          - Anchored by id="contact" so the hero link can scroll here.
          - Uses a background image pulled from the public /images folder.
          - Centers the ContactFormComponent inside a flex container. */}
      <section
        id="contact"
        className="
          flex flex-col justify-center items-center
          mt-40
          bg-cover bg-center
        "
        // Background image:
        // - Replace '/images/background image.png' with another path if needed.
        // - Ensure the file actually exists under /public/images.
        style={{ backgroundImage: "url('/images/background image.png')" }}
      >
        <ContactFormComponent />
      </section>
    </>
  );
}









// import TopofPageContent from "../../components/topPage/topOfPageStyle";
// import ContactFormComponent from "../../components/forms/contactForm";

// export default function ContactPage() {
//   return (
//     <>
//       <TopofPageContent
//         HeadingOneTitle="Contact us"
//         paragraphContent="Placeholder text for now."
//         linkOne="Contact form below"
//         href="#contact"
//         imageSrc="/images/humpback whale logo 1.png"
//         imageAlt="Aboriginal style image of a Whale"
//       />

//       <section
//         id="contact"
//         className="
//           flex flex-col justify-center items-center
//           mt-40
//           bg-cover bg-center
//         "
//         // 🔄 Background change:
//         // - Previously: bg-gradient-to-b from-blue-700 to-blue-300
//         // - Now: image-based background for the contact section.
//         //   Swap '/images/contact-bg.png' with any image you like.
//         style={{ backgroundImage: "url('/images/background image.png')" }}
//       >
//         <ContactFormComponent />
//       </section>
//     </>
//   );
// }









