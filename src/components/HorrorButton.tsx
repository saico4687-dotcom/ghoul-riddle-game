import { motion } from "framer-motion";
import { forwardRef, ReactNode } from "react";

interface HorrorButtonProps {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  variant?: "primary" | "secondary" | "ghost";
  className?: string;
}

const HorrorButton = forwardRef<HTMLButtonElement, HorrorButtonProps>(
  (
    {
      children,
      onClick,
      disabled = false,
      variant = "primary",
      className = "",
    },
    ref
  ) => {
    const baseClasses =
      "font-horror text-xl px-8 py-4 rounded-lg transition-all duration-300 relative overflow-hidden";

    const variantClasses = {
      primary: "btn-horror",
      secondary:
        "bg-secondary border border-border text-foreground hover:border-primary",
      ghost:
        "bg-transparent border border-primary/50 text-primary hover:bg-primary/10",
    };

    return (
      <motion.button
        ref={ref}
        onClick={onClick}
        disabled={disabled}
        whileHover={{ scale: disabled ? 1 : 1.05 }}
        whileTap={{ scale: disabled ? 1 : 0.95 }}
        className={`${baseClasses} ${variantClasses[variant]} ${className} ${
          disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"
        }`}
      >
        <span className="relative z-10">{children}</span>
        {variant === "primary" && (
          <motion.div
            className="absolute inset-0 bg-gradient-to-r from-horror-blood/0 via-horror-glow/20 to-horror-blood/0"
            animate={{ x: ["-100%", "100%"] }}
            transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
          />
        )}
      </motion.button>
    );
  }
);

HorrorButton.displayName = "HorrorButton";

export default HorrorButton;
