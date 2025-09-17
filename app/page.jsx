'use client'; // required for using hooks
import Section1 from "@/components/Main/section1";
import Section2 from "@/components/Main/section2";
import TopofPageContent from "../components/topPage/topOfPageStyle";



export default function Home() {
  return (
    <>
      <TopofPageContent
        HeadingOneTitle="Nyanbul Cultural Awareness"
        paragraphContent="Cultural Awareness training from the Grass-Roots Community"
      />
      <Section1 className="mt-40" />
      <Section2 />
    </>
  );
}
