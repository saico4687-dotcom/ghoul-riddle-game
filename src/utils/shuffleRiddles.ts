// Utility function to shuffle riddle options while maintaining correct answer tracking
import riddleFunBackground from "@/assets/riddle-fun-background.jpg";
import riddleCompetition from "@/assets/riddle-competition.jpg";

export interface ShuffledRiddle {
  id: number;
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  image: string;
}

// Seeded random number generator for consistent shuffling
function seededRandom(seed: number): () => number {
  return function() {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };
}

// Fisher-Yates shuffle with tracking
export function shuffleOptions(
  options: string[],
  correctIndex: number,
  seed: number
): { shuffledOptions: string[]; newCorrectIndex: number } {
  const random = seededRandom(seed);
  const correctAnswer = options[correctIndex];
  const shuffledOptions = [...options];
  
  // Fisher-Yates shuffle
  for (let i = shuffledOptions.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [shuffledOptions[i], shuffledOptions[j]] = [shuffledOptions[j], shuffledOptions[i]];
  }
  
  // Find the new index of the correct answer
  const newCorrectIndex = shuffledOptions.indexOf(correctAnswer);
  
  return { shuffledOptions, newCorrectIndex };
}

// Apply shuffle to all riddles and assign unified background images
export function shuffleAllRiddles(riddles: ShuffledRiddle[]): ShuffledRiddle[] {
  return riddles.map((riddle, index) => {
    // Use riddle id as seed for consistent shuffling
    const { shuffledOptions, newCorrectIndex } = shuffleOptions(
      riddle.options,
      riddle.correctIndex,
      riddle.id * 17 + index * 31 // Unique seed per riddle
    );
    
    // All 400 riddles use the unified competition background
    const unifiedImage = riddleCompetition;
    
    return {
      ...riddle,
      options: shuffledOptions,
      correctIndex: newCorrectIndex,
      image: unifiedImage,
    };
  });
}
