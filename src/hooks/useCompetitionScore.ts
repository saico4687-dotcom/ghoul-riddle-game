import { supabase } from "@/integrations/supabase/client";

export const updateCompetitionScore = async (
  pointsToAdd: number,
  correctToAdd: number,
  questionsToAdd: number,
  timeBonusToAdd: number
) => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  // Try to get existing record
  const { data: existing } = await supabase
    .from("competition_scores")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  if (existing) {
    await supabase
      .from("competition_scores")
      .update({
        total_points: existing.total_points + pointsToAdd,
        total_correct: existing.total_correct + correctToAdd,
        total_questions: existing.total_questions + questionsToAdd,
        time_bonus: existing.time_bonus + timeBonusToAdd,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", user.id);
  } else {
    await supabase
      .from("competition_scores")
      .insert({
        user_id: user.id,
        total_points: pointsToAdd,
        total_correct: correctToAdd,
        total_questions: questionsToAdd,
        time_bonus: timeBonusToAdd,
      });
  }
};
