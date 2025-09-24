import { motion, HTMLMotionProps } from "framer-motion";
import { ReactNode } from "react";

// ---------------------------
// 1. Define Props with Types
// ---------------------------

// Framer Motion provides `HTMLMotionProps<"button">`
// → It already merges standard <button> props + motion props.
interface BtnProps extends HTMLMotionProps<"button"> {
  onClick?: () => void;          // Optional click handler
  className?: string;            // Optional CSS classes
  label: string | ReactNode;     // Accepts text or JSX
}

// ---------------------------
// 2. Functional Component
// ---------------------------

export default function Btn({
  onClick,
  className = "",
  label,
  ...rest
}: BtnProps) {
  return (
    <motion.button onClick={onClick} className={className} {...rest}>
      {label}
    </motion.button>
  );
}






