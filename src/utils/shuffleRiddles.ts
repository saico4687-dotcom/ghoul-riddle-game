// Utility function to shuffle riddle options.
// الموبايل مبقاش يعرف الإجابة الصحيحة خالص — السيرفر هو اللي بيصحّح.
import riddleCompetition from "@/assets/riddle-competition.jpg";

export interface ShuffledRiddle {
  id: number;
  question: string;
  options: string[];
  image: string;
}

// Seeded random number generator for consistent shuffling
function seededRandom(seed: number): () => number {
  return function() {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };
}

// Fisher-Yates shuffle
export function shuffleOptions(options: string[], seed: number): string[] {
  const random = seededRandom(seed);
  const shuffledOptions = [...options];

  for (let i = shuffledOptions.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [shuffledOptions[i], shuffledOptions[j]] = [shuffledOptions[j], shuffledOptions[i]];
  }

  return shuffledOptions;
}

// Apply shuffle to all riddles and assign unified background images
export function shuffleAllRiddles(riddles: ShuffledRiddle[]): ShuffledRiddle[] {
  return riddles.map((riddle, index) => ({
    ...riddle,
    // Use riddle id as seed for consistent shuffling
    options: shuffleOptions(riddle.options, riddle.id * 17 + index * 31),
    // All 400 riddles use the unified competition background
    image: riddleCompetition,
  }));
}
