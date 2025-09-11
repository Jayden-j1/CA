import { motion } from 'framer-motion';


export default function Btn( {onClick, className="", label, ...rest} ) {
    return (
        <>
          <motion.button onClick={onClick} className={className}>
            {label}
          </motion.button>
        </>
    );
}