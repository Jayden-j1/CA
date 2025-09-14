'use client';

import Image from 'next/image';
import { motion } from 'framer-motion';

export default function WorkingTogetherImg() {
  return (
    <section className="relative w-full h-[50vh] sm:h-[60vh] md:h-[70vh] overflow-hidden">
      <motion.div
        className="absolute top-0 left-0 flex h-full w-[200vw]"
        animate={{ x: ['0%', '-50%'] }}
        transition={{
          duration: 40, // adjust speed
          repeat: Infinity,
          ease: 'linear',
        }}
      >
        {/* First image */}
        <div className="relative w-[100vw] h-full">
          <Image
            src="/images/working_together.jpeg"
            alt="Working together"
            fill
            className="object-fill"
            priority
          />
        </div>

        {/* Second image (seamless duplicate) */}
        <div className="relative w-[100vw] h-full">
          <Image
            src="/images/working_together.jpeg"
            alt="Working together"
            fill
            className="object-fill"
            priority
          />
        </div>
      </motion.div>
    </section>
  );
}



