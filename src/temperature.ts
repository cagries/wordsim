export type TemperatureBand =
  | "cold"
  | "cool"
  | "mild"
  | "neutral"
  | "warm"
  | "hot"
  | "very-hot"
  | "answer";

export function temperatureForRank(rank: number | null): TemperatureBand {
  if (rank === null) return "cold";
  if (rank === 1) return "answer";
  if (rank <= 10) return "very-hot";
  if (rank <= 20) return "hot";
  if (rank <= 100) return "warm";
  if (rank <= 250) return "neutral";
  if (rank <= 500) return "mild";
  return "cool";
}
