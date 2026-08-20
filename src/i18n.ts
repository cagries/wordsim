import type {
  GameOutcome,
  LanguageCode,
  TargetCategory,
} from "./types";
import type { GuessErrorCode } from "./game";

export interface TutorialRow {
  word: string;
  rank: number | null;
  hint?: boolean;
}

export interface TutorialSlide {
  title: string;
  text: string;
  inputWord: string;
  status: string;
  statusRank?: number | null;
  rows: TutorialRow[];
}

export interface Translations {
  documentTitle: string;
  description: string;
  tagline: string;
  howToPlay: string;
  tutorialTitle: string;
  tutorialClose: string;
  tutorialBack: string;
  tutorialNext: string;
  tutorialStartPlaying: string;
  tutorialProgress: (step: number, total: number) => string;
  tutorialSlides: TutorialSlide[];
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
  ranking: string;
  puzzles: string;
  resetSelectedPuzzle: string;
  nextPuzzle: string;
  started: string;
  solved: string;
  answerRevealed: string;
  hintBadge: string;
  answerBadge: string;
  cold: string;
  category: string;
  anything: string;
  categorySelection: string;
  language: string;
  categories: Record<TargetCategory, string>;
  historyCount: (guesses: number, hints: number) => string;
  puzzleAriaLabel: (number: number, state: "untouched" | "started" | "solved" | "revealed") => string;
  puzzlePosition: (number: number, total: number) => string;
  showPuzzles: string;
  hidePuzzles: string;
  loadingPuzzles: string;
  loadingPuzzle: (number: number) => string;
  tryWord: string;
  progressRestored: string;
  solvedStatus: (word: string) => string;
  gaveUpStatus: (word: string) => string;
  coldStatus: (word: string) => string;
  rankedStatus: (word: string, rank: number) => string;
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
  changelog: string;
  guessError: (code: GuessErrorCode, word: string | undefined, outcome: GameOutcome) => string;
}

const english: Translations = {
  documentTitle: "wordsim - word similarity guessing game",
  description: "Guess a hidden word by following semantic similarity.",
  tagline: "Guess the hidden word.",
  howToPlay: "How to play?",
  tutorialTitle: "How to play wordsim",
  tutorialClose: "Close tutorial",
  tutorialBack: "Back",
  tutorialNext: "Next",
  tutorialStartPlaying: "Start playing",
  tutorialProgress: (step, total) => `Step ${step} of ${total}`,
  tutorialSlides: [
    {
      title: "Start anywhere",
      text: "Find the hidden word by entering one common English word at a time. There is no opening clue, so any valid word is a useful first step.",
      inputWord: "music 👈",
      status: "Try any common English word.",
      rows: [],
    },
    {
      title: "Read the feedback",
      text: "A cold, blue result means the guess is outside the 1000 closest words. Ranked guesses are closer, and lower numbers are better.",
      inputWord: "music",
      status: "“music” · cold",
      statusRank: null,
      rows: [{ word: "music", rank: null }],
    },
    {
      title: "Use a hint when you need one",
      text: "A word hint reveals a nearby word. If \"Anything\" is selected as the category, the category hint unlocks after five guesses.",
      inputWord: "",
      status: "Hint: “space” is ranked #20.",
      statusRank: 20,
      rows: [
        { word: "space", rank: 20, hint: true },
        { word: "music", rank: null },
      ],
    },
    {
      title: "Follow the meaning",
      text: "Use the warmer words to explore the same semantic neighborhood. Redder colors and smaller ranks mean you are getting closer.",
      inputWord: "earth",
      status: "“earth” · #5",
      statusRank: 5,
      rows: [
        { word: "earth", rank: 5 },
        { word: "space", rank: 20, hint: true },
        { word: "music", rank: null },
      ],
    },
    {
      title: "Find the hidden word",
      text: "Rank #1 is the answer. After finishing, use Next puzzle to continue with another unfinished puzzle in your selected category.",
      inputWord: "planet",
      status: "Great job! “planet” · #1",
      statusRank: 1,
      rows: [
        { word: "planet", rank: 1 },
        { word: "earth", rank: 5 },
        { word: "space", rank: 20, hint: true },
        { word: "music", rank: null },
      ],
    },
  ],
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
  ranking: "Ranking",
  puzzles: "Puzzles",
  resetSelectedPuzzle: "Reset selected puzzle",
  nextPuzzle: "Next puzzle",
  started: "Started",
  solved: "Solved",
  answerRevealed: "Answer revealed",
  hintBadge: "Hint",
  answerBadge: "Answer",
  cold: "cold",
  category: "Category",
  anything: "Anything",
  categorySelection: "Choose a category",
  language: "Language",
  categories: {
    animal: "Animal",
    object: "Object",
    action: "Action",
    adjective: "Adjective",
    food: "Food",
    place: "Place",
    occupation: "Occupation",
    clothing: "Clothing",
  },
  historyCount: (guesses, hints) => `${guesses} ${guesses === 1 ? "guess" : "guesses"} · ${hints} ${hints === 1 ? "hint" : "hints"}`,
  puzzleAriaLabel: (number, state) => `Puzzle ${number}${state === "solved" ? ", solved" : state === "revealed" ? ", answer revealed" : state === "started" ? ", started" : ""}`,
  puzzlePosition: (number, total) => `Puzzle ${number} of ${total}`,
  showPuzzles: "Show puzzles",
  hidePuzzles: "Hide puzzles",
  loadingPuzzles: "Loading puzzles…",
  loadingPuzzle: (number) => `Loading Puzzle ${number}…`,
  tryWord: "Try any common English word.",
  progressRestored: "Progress restored. Keep guessing.",
  solvedStatus: (word) => `Great job! “${word}” · #1`,
  gaveUpStatus: (word) => `You gave up. The word was “${word}”.`,
  coldStatus: (word) => `“${word}” · cold`,
  rankedStatus: (word, rank) => `“${word}” · #${rank}`,
  resetStatus: "Puzzle reset. Try any common English word.",
  noHintsStatus: "No safer word hints remain.",
  hintStatus: (word, rank, closest) => `Hint: “${word}” is ranked #${rank}.${closest ? " This is the closest available hint." : ""}`,
  categoryStatus: (category) => `Category revealed: ${category}.`,
  revealConfirmation: "Reveal the answer and end this attempt?",
  loadError: "Could not start the game.",
  puzzleLoadError: "Could not load this puzzle.",
  guessFallbackError: "That guess could not be ranked.",
  hintFallbackError: "Could not reveal a hint.",
  answerFallbackError: "Could not reveal the answer.",
  about: "About",
  aboutDescription: "A word guessing game based on word similarities.",
  changelog: "Changelog",
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
  documentTitle: "wordsim - kelime benzerliği tahmin oyunu",
  description: "Anlamsal benzerliği izleyerek gizli kelimeyi bulmalısın.",
  tagline: "Gizli kelimeyi bulma oyunu.",
  howToPlay: "Nasıl oynanır?",
  tutorialTitle: "wordsim nasıl oynanır?",
  tutorialClose: "Öğreticiyi kapat",
  tutorialBack: "Geri",
  tutorialNext: "İleri",
  tutorialStartPlaying: "Oynamaya başla",
  tutorialProgress: (step, total) => `${step}/${total}. adım`,
  tutorialSlides: [
    {
      title: "Herhangi bir yerden başla",
      text: "Gizli kelimeyi bulmak için her seferinde bir Türkçe kelime gir. İstediğin kelimeyle başla.",
      inputWord: "hayvan 👈",
      status: "Yaygın bir Türkçe kelime dene.",
      rows: [],
    },
    {
      title: "Sonucu incele",
      text: "Mavi ve uzak bir sonuç, yaptığın tahminin en yakın 1000 kelimenin dışında olduğunu gösterir.",
      inputWord: "hayvan",
      status: "“hayvan” · uzak",
      statusRank: null,
      rows: [{ word: "hayvan", rank: null }],
    },
    {
      title: "Gerektiğinde ipucu kullan",
      text: "Kelime ipucu yakın bir kelime gösterir. Kategori \"Herhangi\" ise beş tahminden sonra kategori ipucu da kullanıma açılır.",
      inputWord: "",
      status: "İpucu: “kutup” #20 sırada.",
      statusRank: 20,
      rows: [
        { word: "kutup", rank: 20, hint: true },
        { word: "hayvan", rank: null },
      ],
    },
    {
      title: "Anlamı takip et",
      text: "Daha sıcak kelimelerden yola çıkarak hedef kelimeye yaklaşacak yeni tahminler yap. Kırmızıya yaklaştıkça ve sıra küçüldükçe hedefe yaklaşırsın.",
      inputWord: "deniz",
      status: "“deniz” · #4",
      statusRank: 4,
      rows: [
        { word: "deniz", rank: 4 },
        { word: "kutup", rank: 20, hint: true },
        { word: "hayvan", rank: null },
      ],
    },
    {
      title: "Gizli kelimeyi bul",
      text: "#1 gizli cevap. Bitirdikten sonra seçtiğin kategorideki tamamlanmamış bir bulmacaya geçmek için Sonraki bulmaca düğmesini kullan.",
      inputWord: "okyanus",
      status: "Tebrikler! “okyanus” · #1",
      statusRank: 1,
      rows: [
        { word: "okyanus", rank: 1 },
        { word: "deniz", rank: 4 },
        { word: "kutup", rank: 20, hint: true },
        { word: "hayvan", rank: null },
      ],
    },
  ],
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
  ranking: "Sıralama",
  puzzles: "Bulmacalar",
  resetSelectedPuzzle: "Seçili bulmacayı sıfırla",
  nextPuzzle: "Sonraki bulmaca",
  started: "Başlandı",
  solved: "Çözüldü",
  answerRevealed: "Cevap gösterildi",
  hintBadge: "İpucu",
  answerBadge: "Cevap",
  cold: "uzak",
  category: "Kategori",
  anything: "Herhangi",
  categorySelection: "Kategori seç",
  language: "Dil",
  categories: {
    animal: "Hayvan",
    object: "Nesne",
    action: "Eylem",
    adjective: "Sıfat",
    food: "Yiyecek",
    place: "Yer",
    occupation: "Meslek",
    clothing: "Giyim",
  },
  historyCount: (guesses, hints) => `${guesses} tahmin · ${hints} ipucu`,
  puzzleAriaLabel: (number, state) => `${number}. bulmaca${state === "solved" ? ", çözüldü" : state === "revealed" ? ", cevap gösterildi" : state === "started" ? ", başlandı" : ""}`,
  puzzlePosition: (number, total) => `Bulmaca #${number} / ${total}`,
  showPuzzles: "Bulmacaları göster",
  hidePuzzles: "Bulmacaları gizle",
  loadingPuzzles: "Bulmacalar yükleniyor…",
  loadingPuzzle: (number) => `${number}. bulmaca yükleniyor…`,
  tryWord: "Yaygın bir Türkçe kelime dene.",
  progressRestored: "İlerlemen geri yüklendi. Tahmine devam et.",
  solvedStatus: (word) => `Tebrikler! “${word}” · #1`,
  gaveUpStatus: (word) => `Vazgeçtin. Kelime “${word}” idi.`,
  coldStatus: (word) => `“${word}” · uzak`,
  rankedStatus: (word, rank) => `“${word}” · #${rank}`,
  resetStatus: "Bulmaca sıfırlandı. Yaygın bir Türkçe kelime dene.",
  noHintsStatus: "Gösterilebilecek daha yakın kelime ipucu kalmadı.",
  hintStatus: (word, rank, closest) => `İpucu: “${word}” #${rank} sırada.${closest ? " Bu, kullanılabilir en yakın ipucu." : ""}`,
  categoryStatus: (category) => `Kategori gösterildi: ${category}.`,
  revealConfirmation: "Cevabı gösterip bu denemeyi bitirmek istiyor musun?",
  loadError: "Oyun başlatılamadı.",
  puzzleLoadError: "Bu bulmaca yüklenemedi.",
  guessFallbackError: "Bu tahmin sıralanamadı.",
  hintFallbackError: "İpucu gösterilemedi.",
  answerFallbackError: "Cevap gösterilemedi.",
  about: "Hakkında",
  aboutDescription: "Kelime benzerliklerine dayalı bir kelime tahmin oyunu.",
  changelog: "Değişiklikler",
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
