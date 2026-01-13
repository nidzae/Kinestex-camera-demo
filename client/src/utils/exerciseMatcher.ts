import exerciseData from '../data/kinestex-exercises-summary.json';

export interface ExerciseMatch {
  id: string;
  model_id: string;
  title: string;
  body_parts: string[];
  dif_level: string;
  position: string;
  score: number;
}

/**
 * Calculate similarity score between two strings (0-1)
 * Uses a combination of techniques for better matching
 */
function calculateSimilarity(str1: string, str2: string): number {
  const s1 = str1.toLowerCase().trim();
  const s2 = str2.toLowerCase().trim();

  // Exact match
  if (s1 === s2) return 1;

  // Check if one contains the other
  if (s2.includes(s1)) return 0.9;
  if (s1.includes(s2)) return 0.85;

  // Word-based matching
  const words1 = s1.split(/\s+/);
  const words2 = s2.split(/\s+/);
  const matchingWords = words1.filter(w => words2.some(w2 => w2.includes(w) || w.includes(w2)));
  const wordScore = matchingWords.length / Math.max(words1.length, words2.length);

  // Levenshtein distance for close matches
  const levenScore = 1 - (levenshteinDistance(s1, s2) / Math.max(s1.length, s2.length));

  // Combine scores (weighted average)
  return Math.max(wordScore * 0.7 + levenScore * 0.3, levenScore);
}

/**
 * Calculate Levenshtein distance between two strings
 */
function levenshteinDistance(str1: string, str2: string): number {
  const m = str1.length;
  const n = str2.length;
  const dp: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (str1[i - 1] === str2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
      }
    }
  }

  return dp[m][n];
}

/**
 * Find the best matching exercise for a given query
 * Returns null if no good match found (score < threshold)
 */
export function findExercise(query: string, threshold = 0.4): ExerciseMatch | null {
  const matches = findExercises(query, 1, threshold);
  return matches.length > 0 ? matches[0] : null;
}

/**
 * Find multiple matching exercises for a given query
 */
export function findExercises(query: string, limit = 5, threshold = 0.3): ExerciseMatch[] {
  const results: ExerciseMatch[] = [];

  for (const exercise of exerciseData.exercises) {
    const score = calculateSimilarity(query, exercise.title);
    if (score >= threshold) {
      results.push({
        ...exercise,
        score
      });
    }
  }

  return results
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

/**
 * Get all exercises (useful for selection UI)
 */
export function getAllExercises() {
  return exerciseData.exercises;
}

/**
 * Get exercises filtered by body part
 */
export function getExercisesByBodyPart(bodyPart: string) {
  return exerciseData.exercises.filter(e =>
    e.body_parts?.some(bp => bp.toLowerCase().includes(bodyPart.toLowerCase()))
  );
}

/**
 * Get exercise by exact ID
 */
export function getExerciseById(id: string) {
  return exerciseData.exercises.find(e => e.id === id);
}

/**
 * Validate an exercise name and return the correct title if found
 * This is useful before sending to KinesteX API
 */
export function validateExerciseName(name: string): { valid: boolean; correctedName?: string; exercise?: ExerciseMatch } {
  // First try exact match
  const exact = exerciseData.exercises.find(e => e.title.toLowerCase() === name.toLowerCase());
  if (exact) {
    return { valid: true, correctedName: exact.title, exercise: { ...exact, score: 1 } };
  }

  // Try fuzzy match
  const match = findExercise(name, 0.5);
  if (match) {
    return { valid: true, correctedName: match.title, exercise: match };
  }

  return { valid: false };
}
