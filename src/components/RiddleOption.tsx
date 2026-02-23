import { motion } from "framer-motion";

interface RiddleOptionProps {
  option: string;
  index: number;
  selected: boolean;
  showResult: boolean;
  isCorrect: boolean;
  onClick: () => void;
  disabled: boolean;
  hideCorrectInCompetition?: boolean;
}

const RiddleOption = ({
  option,
  index,
  selected,
  showResult,
  isCorrect,
  onClick,
  disabled,
  hideCorrectInCompetition = false,
}: RiddleOptionProps) => {
  const getOptionClass = () => {
    let base = "option-horror";
    
    if (showResult) {
      // In competition mode, don't highlight the correct answer if user was wrong
      if (isCorrect && !hideCorrectInCompetition) {
        base += " correct";
      } else if (selected && !isCorrect) {
        base += " wrong";
      }
    } else if (selected) {
      base += " selected";
    }
    
    return base;
  };

  const letters = ["أ", "ب", "ج", "د"];

  return (
    <motion.button
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.1 }}
      onClick={onClick}
      disabled={disabled}
      className={`${getOptionClass()} w-full text-right flex items-center gap-4 ${
        disabled && !showResult ? "opacity-50 cursor-not-allowed" : ""
      }`}
    >
      <span className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center font-horror text-primary text-xl shrink-0">
        {letters[index]}
      </span>
      <span className="font-typewriter text-foreground text-lg leading-relaxed">
        {option}
      </span>
    </motion.button>
  );
};

export default RiddleOption;
