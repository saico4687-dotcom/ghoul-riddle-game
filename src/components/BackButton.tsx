import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";

interface BackButtonProps {
  onClick: () => void;
}

const BackButton = ({ onClick }: BackButtonProps) => {
  return (
    <motion.button
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      onClick={onClick}
      className="fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-2 rounded-lg bg-secondary/80 border border-border text-foreground font-typewriter text-sm backdrop-blur-sm hover:border-primary transition-colors cursor-pointer"
    >
      <ArrowRight className="w-4 h-4" />
      رجوع
    </motion.button>
  );
};

export default BackButton;
