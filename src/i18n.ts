import type {
  GameOutcome,
  LanguageCode,
  TargetCategory,
} from "./types";
import type { GuessErrorCode } from "./game";

export interface Translations {
  documentTitle: string;
  description: string;
  tagline: string;
  howToPlay: string;
  howIntro: string;
  howFirstLabel: string;
  howFirstText: string;
  howSimilarityLabel: string;
  howSimilarityText: string;
  howRankingLabel: string;
  howRankingText: string;
  howHintsLabel: string;
  howHintsText: string;
  howFormsLabel: string;
  howFormsText: string;
  yourGuess: string;
  guess: string;
  wordHint: string;
  noMoreWordHints: string;
  categoryHint: string;
  categoryRevealed: string;
  categoryHintProgress: (guesses: number, required: number) => string;
  giveUp: string;
  assistanceControls: string;
  choosePuzzle: string;
  history: string;
  word: string;
  similarity: string;
  ranking: string;
  puzzles: string;
  resetSelectedPuzzle: string;
  started: string;
  solved: string;
  answerRevealed: string;
  hintBadge: string;
  answerBadge: string;
  cold: string;
  category: string;
  language: string;
  categories: Record<TargetCategory, string>;
  historyCount: (guesses: number, hints: number) => string;
  puzzleAriaLabel: (number: number, state: "untouched" | "started" | "solved" | "revealed") => string;
  loadingPuzzles: string;
  loadingPuzzle: (number: number) => string;
  tryWord: string;
  progressRestored: string;
  solvedStatus: (word: string) => string;
  gaveUpStatus: (word: string) => string;
  coldStatus: string;
  rankedStatus: (rank: number) => string;
  resetStatus: string;
  noHintsStatus: string;
  hintStatus: (word: string, rank: number, closest: boolean) => string;
  categoryStatus: (category: string) => string;
  revealConfirmation: string;
  loadError: string;
  puzzleLoadError: string;
  guessFallbackError: string;
  hintFallbackError: string;
  answerFallbackError: string;
  about: string;
  aboutDescription: string;
  guessError: (code: GuessErrorCode, word: string | undefined, outcome: GameOutcome) => string;
}

const english: Translations = {
  documentTitle: "wordsim",
  description: "Guess a hidden word by following semantic similarity.",
  tagline: "Guess the hidden word.",
  howToPlay: "How to play?",
  howIntro: "Find the hidden word by guessing one common English word at a time.",
  howFirstLabel: "First guess:",
  howFirstText: "You start with no prior information, guess anything!",
  howSimilarityLabel: "Similarity:",
  howSimilarityText: "Higher scores mean the words are closer in meaning, with 100 being the maximum.",
  howRankingLabel: "Ranking:",
  howRankingText: "Lower is better. #1 is the hidden word, while “cold” means the guess is outside the closest 1000 words.",
  howHintsLabel: "Hints:",
  howHintsText: "Word hints reveal increasingly close words. The category hint unlocks after 5 accepted guesses.",
  howFormsLabel: "",
  howFormsText: "",
  yourGuess: "Your guess",
  guess: "Guess",
  wordHint: "Word hint",
  noMoreWordHints: "No more word hints",
  categoryHint: "Category hint",
  categoryRevealed: "Category revealed",
  categoryHintProgress: (guesses, required) => `Category hint (${guesses}/${required})`,
  giveUp: "Give up",
  assistanceControls: "Hints and answer controls",
  choosePuzzle: "Choose a puzzle",
  history: "History",
  word: "Word",
  similarity: "Similarity",
  ranking: "Ranking",
  puzzles: "Puzzles",
  resetSelectedPuzzle: "Reset selected puzzle",
  started: "Started",
  solved: "Solved",
  answerRevealed: "Answer revealed",
  hintBadge: "Hint",
  answerBadge: "Answer",
  cold: "cold",
  category: "Category",
  language: "Language",
  categories: {
    animal: "Animal",
    object: "Object",
    action: "Action",
    adjective: "Adjective",
    food: "Food",
    place: "Place",
  },
  historyCount: (guesses, hints) => `${guesses} ${guesses === 1 ? "guess" : "guesses"} · ${hints} ${hints === 1 ? "hint" : "hints"}`,
  puzzleAriaLabel: (number, state) => `Puzzle ${number}${state === "solved" ? ", solved" : state === "revealed" ? ", answer revealed" : state === "started" ? ", started" : ""}`,
  loadingPuzzles: "Loading puzzles…",
  loadingPuzzle: (number) => `Loading Puzzle ${number}…`,
  tryWord: "Try any common English word.",
  progressRestored: "Progress restored. Keep guessing.",
  solvedStatus: (word) => `Solved! The word was “${word}”.`,
  gaveUpStatus: (word) => `You gave up. The word was “${word}”.`,
  coldStatus: "That guess is cold.",
  rankedStatus: (rank) => `That guess is ranked #${rank}.`,
  resetStatus: "Puzzle reset. Try any common English word.",
  noHintsStatus: "No safer word hints remain.",
  hintStatus: (word, rank, closest) => `Hint: “${word}” is ranked #${rank}.${closest ? " This is the closest available hint." : ""}`,
  categoryStatus: (category) => `Category revealed: ${category}.`,
  revealConfirmation: "Reveal the answer and end this attempt?",
  loadError: "Could not start the game.",
  puzzleLoadError: "Could not load this puzzle.",
  guessFallbackError: "That guess could not be scored.",
  hintFallbackError: "Could not reveal a hint.",
  answerFallbackError: "Could not reveal the answer.",
  about: "About",
  aboutDescription: "A word guessing game based on word similarities.",
  guessError: (code, word, outcome) => {
    if (code === "empty") return "Enter a word.";
    if (code === "invalid") return "Guesses must contain letters only (no spaces).";
    if (code === "unknown") return `“${word ?? ""}” is not in this game’s vocabulary.`;
    if (code === "duplicate") return `You already guessed “${word ?? ""}”.`;
    return outcome === "gave-up"
      ? "This attempt has ended. Reset it to play again."
      : "This puzzle is already solved. Reset it to play again.";
  },
};

const turkish: Translations = {
  documentTitle: "wordsim",
  description: "Anlamsal benzerliği izleyerek gizli kelimeyi bul.",
  tagline: "Gizli kelimeyi bul.",
  howToPlay: "Nasıl oynanır?",
  howIntro: "Her seferinde yaygın bir Türkçe kelime tahmin ederek gizli kelimeyi bul.",
  howFirstLabel: "İlk tahmin:",
  howFirstText: "Başlangıçta hiçbir bilgin yok; istediğin bir kelimeyi dene!",
  howSimilarityLabel: "Benzerlik:",
  howSimilarityText: "Puan yükseldikçe kelimelerin anlamı birbirine yaklaşır; en yüksek puan 100’dür.",
  howRankingLabel: "Sıralama:",
  howRankingText: "Daha düşük sıra daha iyidir. #1 gizli kelimedir; “uzak” tahmin en yakın 1000 kelimenin dışında demektir.",
  howHintsLabel: "İpuçları:",
  howHintsText: "Kelime ipuçları giderek yakınlaşan kelimeler gösterir. Kategori ipucu 5 geçerli tahminden sonra açılır.",
  howFormsLabel: "Kelime biçimleri:",
  howFormsText: "Sözlük biçimlerini kullan; fiilleri -mak/-mek mastarıyla yaz.",
  yourGuess: "Tahminin",
  guess: "Tahmin et",
  wordHint: "Kelime ipucu",
  noMoreWordHints: "Başka kelime ipucu yok",
  categoryHint: "Kategori ipucu",
  categoryRevealed: "Kategori gösterildi",
  categoryHintProgress: (guesses, required) => `Kategori ipucu (${guesses}/${required})`,
  giveUp: "Vazgeç",
  assistanceControls: "İpuçları ve cevap denetimleri",
  choosePuzzle: "Bir bulmaca seç",
  history: "Tahminler",
  word: "Kelime",
  similarity: "Benzerlik",
  ranking: "Sıralama",
  puzzles: "Bulmacalar",
  resetSelectedPuzzle: "Seçili bulmacayı sıfırla",
  started: "Başlandı",
  solved: "Çözüldü",
  answerRevealed: "Cevap gösterildi",
  hintBadge: "İpucu",
  answerBadge: "Cevap",
  cold: "uzak",
  category: "Kategori",
  language: "Dil",
  categories: {
    animal: "Hayvan",
    object: "Nesne",
    action: "Eylem",
    adjective: "Sıfat",
    food: "Yiyecek",
    place: "Yer",
  },
  historyCount: (guesses, hints) => `${guesses} tahmin · ${hints} ipucu`,
  puzzleAriaLabel: (number, state) => `${number}. bulmaca${state === "solved" ? ", çözüldü" : state === "revealed" ? ", cevap gösterildi" : state === "started" ? ", başlandı" : ""}`,
  loadingPuzzles: "Bulmacalar yükleniyor…",
  loadingPuzzle: (number) => `${number}. bulmaca yükleniyor…`,
  tryWord: "Yaygın bir Türkçe kelime dene.",
  progressRestored: "İlerlemen geri yüklendi. Tahmine devam et.",
  solvedStatus: (word) => `Çözdün! Kelime “${word}” idi.`,
  gaveUpStatus: (word) => `Vazgeçtin. Kelime “${word}” idi.`,
  coldStatus: "Bu tahmin uzak.",
  rankedStatus: (rank) => `Bu tahminin sırası #${rank}.`,
  resetStatus: "Bulmaca sıfırlandı. Yaygın bir Türkçe kelime dene.",
  noHintsStatus: "Gösterilebilecek daha yakın kelime ipucu kalmadı.",
  hintStatus: (word, rank, closest) => `İpucu: “${word}” #${rank} sırada.${closest ? " Bu, kullanılabilir en yakın ipucu." : ""}`,
  categoryStatus: (category) => `Kategori gösterildi: ${category}.`,
  revealConfirmation: "Cevabı gösterip bu denemeyi bitirmek istiyor musun?",
  loadError: "Oyun başlatılamadı.",
  puzzleLoadError: "Bu bulmaca yüklenemedi.",
  guessFallbackError: "Bu tahmin puanlanamadı.",
  hintFallbackError: "İpucu gösterilemedi.",
  answerFallbackError: "Cevap gösterilemedi.",
  about: "Hakkında",
  aboutDescription: "Kelime benzerliklerine dayalı bir kelime tahmin oyunu.",
  guessError: (code, word, outcome) => {
    if (code === "empty") return "Bir kelime gir.";
    if (code === "invalid") return "Tahminler yalnızca harf içermelidir (boşluk kullanma).";
    if (code === "unknown") return `“${word ?? ""}” bu oyunun kelime listesinde yok.`;
    if (code === "duplicate") return `“${word ?? ""}” kelimesini zaten tahmin ettin.`;
    return outcome === "gave-up"
      ? "Bu deneme sona erdi. Yeniden oynamak için bulmacayı sıfırla."
      : "Bu bulmacayı zaten çözdün. Yeniden oynamak için bulmacayı sıfırla.";
  },
};

export const TRANSLATIONS: Record<LanguageCode, Translations> = { en: english, tr: turkish };
