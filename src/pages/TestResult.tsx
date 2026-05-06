import ResultScreen from "@/components/ResultScreen";
import { useNavigate } from "react-router-dom";

const TestResult = () => {
  const navigate = useNavigate();
  return (
    <ResultScreen
      score={8}
      totalQuestions={10}
      totalPoints={800}
      maxPoints={1000}
      timeBonus={120}
      rank={{ title: "مخيف جداً 👻", color: "text-primary" }}
      gameMode="competition"
      onRestart={() => navigate("/")}
    />
  );
};

export default TestResult;
