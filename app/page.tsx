'use client'; // required for using hooks
import Section1 from "@/components/Main/section1";
import Section2 from "@/components/Main/section2";
import WorkingTogetherImg from '@/components/Main/section3'
import { useState } from "react";


export default function Home() {
  return (
    <>
    <Section1 />
    <Section2 />
    <WorkingTogetherImg />
    </>
  );
}
