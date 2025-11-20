import TopofPageContent from "../../components/topPage/topOfPageStyle";
import ContactFormComponent from "../../components/forms/contactForm";


export default function ContactPage() {
    return (
        <>
          <TopofPageContent 
            HeadingOneTitle="Contact us"
            paragraphContent="Placeholder text for now."
            linkOne="Contact form below"
            href="#contact"
            imageSrc="/images/humpback whale logo 1.png"
            imageAlt="Aboriginal style image of a Whale"
          />

          <section id="contact" className="flex flex-col justify-center items-center bg-gradient-to-b from-blue-700 to-blue-300 mt-40">
            <ContactFormComponent />
          </section>
        </>
    );
}