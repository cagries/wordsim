import "./styles.css";
import { version as APP_VERSION } from "../package.json";
import { loadCatalog, loadCollection, loadPuzzle } from "./data";
import {
  canRevealCategoryHint,
  CATEGORY_GUESS_REQUIREMENT,
  CLOSEST_HINT_RANK,
  GameSession,
  GuessError,
} from "./game";
import { TRANSLATIONS } from "./i18n";
import {
  emptyProgress,
  loadProgress,
  loadSelectedCollection,
  saveProgress,
  saveSelectedCollection,
} from "./persistence";
import { temperatureForRank } from "./temperature";
import type { TemperatureBand } from "./temperature";
import type {
  CollectionCatalog,
  CollectionSummary,
  GuessResult,
  LanguageCode,
  PuzzleSummary,
  SavedPuzzleProgress,
  StoredProgress,
  VocabularyData,
} from "./types";

function requiredElement<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Missing required element #${id}.`);
  return element as T;
}

const root = requiredElement<HTMLElement>("wordsim");
const configuredDataRoot = root.dataset.dataRoot;
if (!configuredDataRoot) throw new Error("The game data path is missing.");
const dataRoot: string = configuredDataRoot;

const metaDescription = requiredElement<HTMLMetaElement>("meta-description");
const languageLabel = requiredElement<HTMLLabelElement>("language-label");
const languageSelect = requiredElement<HTMLSelectElement>("language-select");
const tagline = requiredElement<HTMLParagraphElement>("tagline");
const howSummary = requiredElement<HTMLElement>("how-summary");
const howIntro = requiredElement<HTMLElement>("how-intro");
const howFirstLabel = requiredElement<HTMLElement>("how-first-label");
const howFirstText = requiredElement<HTMLElement>("how-first-text");
const howRankingLabel = requiredElement<HTMLElement>("how-ranking-label");
const howRankingText = requiredElement<HTMLElement>("how-ranking-text");
const howHintsLabel = requiredElement<HTMLElement>("how-hints-label");
const howHintsText = requiredElement<HTMLElement>("how-hints-text");
const howFormsItem = requiredElement<HTMLLIElement>("how-forms-item");
const howFormsLabel = requiredElement<HTMLElement>("how-forms-label");
const howFormsText = requiredElement<HTMLElement>("how-forms-text");
const guessLabel = requiredElement<HTMLElement>("guess-label");
const assistanceControls = requiredElement<HTMLElement>("assistance-controls");
const puzzleGrid = requiredElement<HTMLElement>("puzzle-grid");
const resetButton = requiredElement<HTMLButtonElement>("reset-button");
const giveUpButton = requiredElement<HTMLButtonElement>("give-up-button");
const form = requiredElement<HTMLFormElement>("guess-form");
const input = requiredElement<HTMLInputElement>("guess-input");
const guessButton = requiredElement<HTMLButtonElement>("guess-button");
const wordHintButton = requiredElement<HTMLButtonElement>("word-hint-button");
const categoryHintButton = requiredElement<HTMLButtonElement>("category-hint-button");
const categoryClue = requiredElement<HTMLParagraphElement>("category-clue");
const status = requiredElement<HTMLParagraphElement>("status");
const history = requiredElement<HTMLTableSectionElement>("guess-history");
const historyCount = requiredElement<HTMLSpanElement>("history-count");
const historySection = requiredElement<HTMLElement>("history-section");
const guessesHeading = requiredElement<HTMLElement>("guesses-heading");
const wordHeading = requiredElement<HTMLElement>("word-heading");
const rankingHeading = requiredElement<HTMLElement>("ranking-heading");
const puzzlesHeading = requiredElement<HTMLElement>("puzzles-heading");
const startedLegend = requiredElement<HTMLElement>("started-legend");
const solvedLegend = requiredElement<HTMLElement>("solved-legend");
const revealedLegend = requiredElement<HTMLElement>("revealed-legend");
const appVersion = requiredElement<HTMLElement>("app-version");
const aboutSummary = requiredElement<HTMLElement>("about-summary");
const aboutDescription = requiredElement<HTMLElement>("about-description");

appVersion.textContent = `v${APP_VERSION}`;

let catalog: CollectionCatalog | null = null;
let activeCollection: CollectionSummary | null = null;
let collectionRoot = "";
let vocabulary: VocabularyData | null = null;
let puzzles: PuzzleSummary[] = [];
let progress: StoredProgress | null = null;
let activePuzzle: PuzzleSummary | null = null;
let session: GameSession | null = null;
let locale: LanguageCode = "en";
let messages = TRANSLATIONS.en;
let collectionSequence = 0;
let puzzleSequence = 0;
const sessions = new Map<string, GameSession>();
let browserStorage: Storage | null = null;
try {
  browserStorage = window.localStorage;
} catch {
  // Browser privacy settings may make localStorage unavailable.
}

function applyTranslations(): void {
  messages = TRANSLATIONS[locale];
  document.documentElement.lang = locale;
  document.title = messages.documentTitle;
  metaDescription.content = messages.description;
  languageLabel.textContent = messages.language;
  tagline.textContent = messages.tagline;
  howSummary.textContent = messages.howToPlay;
  howIntro.textContent = messages.howIntro;
  howFirstLabel.textContent = messages.howFirstLabel;
  howFirstText.textContent = messages.howFirstText;
  howRankingLabel.textContent = messages.howRankingLabel;
  howRankingText.textContent = messages.howRankingText;
  howHintsLabel.textContent = messages.howHintsLabel;
  howHintsText.textContent = messages.howHintsText;
  howFormsLabel.textContent = messages.howFormsLabel;
  howFormsText.textContent = messages.howFormsText;
  howFormsItem.hidden = locale !== "tr";
  guessLabel.textContent = messages.yourGuess;
  guessButton.textContent = messages.guess;
  giveUpButton.textContent = messages.giveUp;
  assistanceControls.setAttribute("aria-label", messages.assistanceControls);
  puzzleGrid.setAttribute("aria-label", messages.choosePuzzle);
  guessesHeading.textContent = messages.history;
  wordHeading.textContent = messages.word;
  rankingHeading.textContent = messages.ranking;
  puzzlesHeading.textContent = messages.puzzles;
  resetButton.textContent = messages.resetSelectedPuzzle;
  startedLegend.textContent = `● ${messages.started}`;
  solvedLegend.textContent = `✓ ${messages.solved}`;
  revealedLegend.textContent = `× ${messages.answerRevealed}`;
  aboutSummary.textContent = messages.about;
  aboutDescription.textContent = messages.aboutDescription;
}

function populateLanguageSelect(loadedCatalog: CollectionCatalog): void {
  languageSelect.replaceChildren(
    ...loadedCatalog.collections.map((collection) => {
      const option = document.createElement("option");
      option.value = collection.id;
      option.textContent = collection.label;
      option.lang = collection.language;
      return option;
    }),
  );
  languageSelect.disabled = loadedCatalog.collections.length < 2;
}

function setStatus(
  message: string,
  kind: "normal" | "result" | "error" | "success" | "revealed" = "normal",
  temperature?: TemperatureBand,
): void {
  status.textContent = message;
  status.dataset.kind = kind;
  if (temperature) status.dataset.temperature = temperature;
  else status.removeAttribute("data-temperature");
}

function setGuessingEnabled(enabled: boolean): void {
  input.disabled = !enabled;
  guessButton.disabled = !enabled;
}

function persist(): void {
  if (browserStorage && activeCollection && progress) {
    saveProgress(browserStorage, activeCollection.id, progress);
  }
}

function savedProgress(puzzleId: string): SavedPuzzleProgress | undefined {
  return progress?.puzzles[puzzleId];
}

function categoryIsRevealed(): boolean {
  return activePuzzle ? (savedProgress(activePuzzle.id)?.categoryRevealed ?? false) : false;
}

function syncActiveProgress(): void {
  if (!activePuzzle || !session || !progress) return;
  const previous = savedProgress(activePuzzle.id);
  progress.puzzles[activePuzzle.id] = {
    actions: [...session.getActions()],
    categoryRevealed: previous?.categoryRevealed ?? false,
    solved: session.solved,
    gaveUp: session.gaveUp,
  };
  persist();
}

function updateHintControls(): void {
  const nextRank = session?.getNextHintRank() ?? null;
  wordHintButton.disabled = nextRank === null;
  wordHintButton.textContent = session && !session.solved && nextRank === null
    ? messages.noMoreWordHints
    : messages.wordHint;

  const guesses = session?.getResultCounts().guesses ?? 0;
  const revealed = categoryIsRevealed();
  giveUpButton.disabled = !session || session.complete;

  if (!session || session.complete) {
    categoryHintButton.disabled = true;
    categoryHintButton.textContent = messages.categoryHint;
  } else if (revealed) {
    categoryHintButton.disabled = true;
    categoryHintButton.textContent = messages.categoryRevealed;
  } else if (!canRevealCategoryHint(session)) {
    categoryHintButton.disabled = true;
    categoryHintButton.textContent = messages.categoryHintProgress(
      guesses,
      CATEGORY_GUESS_REQUIREMENT,
    );
  } else {
    categoryHintButton.disabled = false;
    categoryHintButton.textContent = messages.categoryHint;
  }

  if (session && revealed) {
    categoryClue.textContent = `${messages.category}: ${messages.categories[session.category]}`;
    categoryClue.hidden = false;
  } else {
    categoryClue.textContent = "";
    categoryClue.hidden = true;
  }
}

function renderResults(results: readonly GuessResult[]): void {
  const empty = results.length === 0;
  historySection.dataset.empty = String(empty);
  if (empty) historySection.setAttribute("aria-hidden", "true");
  else historySection.removeAttribute("aria-hidden");
  history.replaceChildren();
  const counts = session?.getResultCounts() ?? { guesses: 0, hints: 0 };
  const hintCount = counts.hints + (categoryIsRevealed() ? 1 : 0);
  historyCount.textContent = messages.historyCount(counts.guesses, hintCount);

  if (empty) {
    const row = history.insertRow();
    row.className = "history-placeholder";
    for (let index = 0; index < 2; index += 1) {
      row.insertCell().textContent = "\u00a0";
    }
    return;
  }

  for (const result of results) {
    const row = history.insertRow();
    if (result.solved) row.className = "solved-row";
    if (result.source === "answer") row.className = "answer-row";
    const wordCell = row.insertCell();
    wordCell.append(result.word);
    if (result.source === "hint") {
      const badge = document.createElement("span");
      badge.className = "hint-badge";
      badge.textContent = messages.hintBadge;
      wordCell.append(badge);
    } else if (result.source === "answer") {
      const badge = document.createElement("span");
      badge.className = "answer-badge";
      badge.textContent = messages.answerBadge;
      wordCell.append(badge);
    }
    const rankCell = row.insertCell();
    const temperature = document.createElement("span");
    temperature.className = "temperature-pill";
    temperature.dataset.temperature = temperatureForRank(result.rank);
    temperature.textContent = result.rank === null ? messages.cold : `#${result.rank}`;
    rankCell.append(temperature);
  }
}

function renderPuzzleGrid(): void {
  puzzleGrid.replaceChildren(
    ...puzzles.map((puzzle, index) => {
      const saved = savedProgress(puzzle.id);
      const started = Boolean(saved && (saved.actions.length > 0 || saved.categoryRevealed));
      const state = saved?.solved
        ? "solved"
        : saved?.gaveUp
          ? "revealed"
          : started
            ? "started"
            : "untouched";
      const button = document.createElement("button");
      button.type = "button";
      button.className = "puzzle-button";
      button.dataset.state = state;
      if (activePuzzle?.id === puzzle.id) {
        button.classList.add("selected");
        button.setAttribute("aria-current", "page");
      }
      const visibleNumber = index + 1;
      button.textContent = saved?.solved
        ? `${visibleNumber} ✓`
        : saved?.gaveUp
          ? `${visibleNumber} ×`
          : String(visibleNumber);
      button.setAttribute("aria-label", messages.puzzleAriaLabel(visibleNumber, state));
      button.addEventListener("click", () => void selectPuzzle(puzzle));
      return button;
    }),
  );
}

function activateSession(puzzle: PuzzleSummary, loadedSession: GameSession): void {
  activePuzzle = puzzle;
  session = loadedSession;
  resetButton.disabled = false;
  renderPuzzleGrid();
  renderResults(session.getResults());
  updateHintControls();
  if (session.solved) {
    const answer = session.getResults().find((result) => result.solved)?.word ?? "";
    setStatus(messages.solvedStatus(answer), "success", temperatureForRank(1));
    setGuessingEnabled(false);
  } else if (session.gaveUp) {
    const answer = session.getResults().find((result) => result.source === "answer")?.word ?? "";
    setStatus(messages.gaveUpStatus(answer), "revealed");
    setGuessingEnabled(false);
  } else {
    setGuessingEnabled(true);
    setStatus(session.getActions().length > 0 ? messages.progressRestored : messages.tryWord);
    input.focus();
  }
}

async function selectPuzzle(puzzle: PuzzleSummary): Promise<void> {
  if (!activeCollection || !vocabulary || !progress) return;
  const sequence = ++puzzleSequence;
  const collectionId = activeCollection.id;
  activePuzzle = puzzle;
  progress.selectedPuzzleId = puzzle.id;
  persist();
  renderPuzzleGrid();

  const cacheKey = `${collectionId}:${puzzle.id}`;
  const cached = sessions.get(cacheKey);
  if (cached) {
    activateSession(puzzle, cached);
    return;
  }

  session = null;
  setGuessingEnabled(false);
  updateHintControls();
  resetButton.disabled = true;
  giveUpButton.disabled = true;
  renderResults([]);
  const puzzleNumber = puzzles.indexOf(puzzle) + 1;
  setStatus(messages.loadingPuzzle(puzzleNumber));

  try {
    const data = await loadPuzzle(collectionRoot, puzzle.file);
    if (sequence !== puzzleSequence || activeCollection?.id !== collectionId) return;
    let loadedSession: GameSession;
    const saved = savedProgress(puzzle.id);
    try {
      loadedSession = saved
        ? GameSession.restore(vocabulary, data, saved.actions)
        : new GameSession(vocabulary, data);
    } catch {
      delete progress.puzzles[puzzle.id];
      persist();
      loadedSession = new GameSession(vocabulary, data);
    }
    sessions.set(cacheKey, loadedSession);
    const restored = savedProgress(puzzle.id);
    if (restored) {
      progress.puzzles[puzzle.id] = {
        actions: [...loadedSession.getActions()],
        categoryRevealed: restored.categoryRevealed,
        solved: loadedSession.solved,
        gaveUp: loadedSession.gaveUp,
      };
      persist();
    }
    activateSession(puzzle, loadedSession);
  } catch {
    if (sequence !== puzzleSequence || activeCollection?.id !== collectionId) return;
    setStatus(messages.puzzleLoadError, "error");
  }
}

async function activateCollection(
  summary: CollectionSummary,
  rememberSelection: boolean,
): Promise<boolean> {
  const sequence = ++collectionSequence;
  ++puzzleSequence;
  const previous = {
    activeCollection,
    collectionRoot,
    vocabulary,
    puzzles,
    progress,
    activePuzzle,
    session,
    locale,
  };

  locale = summary.language;
  languageSelect.value = summary.id;
  applyTranslations();
  languageSelect.disabled = true;
  session = null;
  setGuessingEnabled(false);
  updateHintControls();
  setStatus(messages.loadingPuzzles);

  try {
    const loaded = await loadCollection(dataRoot, summary);
    if (sequence !== collectionSequence) return false;
    activeCollection = summary;
    collectionRoot = loaded.collectionRoot;
    vocabulary = loaded.vocabulary;
    puzzles = loaded.manifest.puzzles;
    progress = browserStorage
      ? loadProgress(
          browserStorage,
          summary.id,
          vocabulary.version,
          puzzles.map((puzzle) => puzzle.id),
          summary.language,
        )
      : emptyProgress(vocabulary.version, puzzles[0]?.id ?? "0");
    activePuzzle = null;
    session = null;
    if (browserStorage) saveProgress(browserStorage, summary.id, progress);
    if (rememberSelection && browserStorage) {
      saveSelectedCollection(browserStorage, summary.id);
    }
    applyTranslations();
    renderPuzzleGrid();
    renderResults([]);
    updateHintControls();
    languageSelect.value = summary.id;
    languageSelect.disabled = (catalog?.collections.length ?? 0) < 2;
    const initialPuzzle = puzzles.find((puzzle) => puzzle.id === progress?.selectedPuzzleId) ?? puzzles[0];
    if (!initialPuzzle) throw new Error("The puzzle collection is empty.");
    await selectPuzzle(initialPuzzle);
    return true;
  } catch {
    if (sequence !== collectionSequence) return false;
    activeCollection = previous.activeCollection;
    collectionRoot = previous.collectionRoot;
    vocabulary = previous.vocabulary;
    puzzles = previous.puzzles;
    progress = previous.progress;
    activePuzzle = previous.activePuzzle;
    session = previous.session;
    locale = previous.locale;
    languageSelect.value = previous.activeCollection?.id ?? "";
    applyTranslations();
    languageSelect.disabled = (catalog?.collections.length ?? 0) < 2;
    if (activePuzzle && session) {
      activateSession(activePuzzle, session);
      setStatus(messages.loadError, "error");
    } else {
      setStatus(messages.loadError, "error");
    }
    return false;
  }
}

function preferredCollection(loadedCatalog: CollectionCatalog): CollectionSummary {
  const validIds = loadedCatalog.collections.map((collection) => collection.id);
  const stored = browserStorage
    ? loadSelectedCollection(browserStorage, validIds)
    : null;
  if (stored) {
    const selected = loadedCatalog.collections.find((collection) => collection.id === stored);
    if (selected) return selected;
  }
  const prefersTurkish = [...(navigator.languages ?? []), navigator.language]
    .filter(Boolean)
    .some((language) => language.toLowerCase().startsWith("tr"));
  if (prefersTurkish) {
    const turkish = loadedCatalog.collections.find((collection) => collection.language === "tr");
    if (turkish) return turkish;
  }
  return loadedCatalog.collections.find(
    (collection) => collection.id === loadedCatalog.defaultCollectionId,
  ) ?? loadedCatalog.collections[0];
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  if (!session) return;

  try {
    const result = session.guess(input.value);
    syncActiveProgress();
    renderPuzzleGrid();
    renderResults(session.getResults());
    updateHintControls();
    input.value = "";
    if (result.solved) {
      setStatus(messages.solvedStatus(result.word), "success", temperatureForRank(1));
      setGuessingEnabled(false);
    } else {
      setStatus(
        result.rank === null
          ? messages.coldStatus(result.word)
          : messages.rankedStatus(result.word, result.rank),
        "result",
        temperatureForRank(result.rank),
      );
      input.focus();
    }
  } catch (error) {
    const message = error instanceof GuessError
      ? messages.guessError(error.code, error.word, session.outcome)
      : messages.guessFallbackError;
    setStatus(message, "error");
    input.select();
  }
});

resetButton.addEventListener("click", () => {
  if (!session || !activePuzzle || !progress) return;
  session.reset();
  delete progress.puzzles[activePuzzle.id];
  persist();
  renderPuzzleGrid();
  renderResults([]);
  updateHintControls();
  setGuessingEnabled(true);
  setStatus(messages.resetStatus);
  input.focus();
});

wordHintButton.addEventListener("click", () => {
  if (!session) return;
  try {
    const result = session.revealHint();
    if (!result) {
      updateHintControls();
      setStatus(messages.noHintsStatus);
      return;
    }
    syncActiveProgress();
    renderPuzzleGrid();
    renderResults(session.getResults());
    updateHintControls();
    const hintRank = result.rank ?? CLOSEST_HINT_RANK;
    setStatus(messages.hintStatus(
      result.word,
      hintRank,
      result.rank === CLOSEST_HINT_RANK,
    ), "result", temperatureForRank(hintRank));
    input.focus();
  } catch {
    setStatus(messages.hintFallbackError, "error");
  }
});

categoryHintButton.addEventListener("click", () => {
  if (!session || !activePuzzle || !progress || session.complete || categoryIsRevealed()) return;
  if (!canRevealCategoryHint(session)) return;
  progress.puzzles[activePuzzle.id] = {
    actions: [...session.getActions()],
    categoryRevealed: true,
    solved: session.solved,
    gaveUp: session.gaveUp,
  };
  persist();
  renderPuzzleGrid();
  renderResults(session.getResults());
  updateHintControls();
  setStatus(messages.categoryStatus(messages.categories[session.category]));
  input.focus();
});

giveUpButton.addEventListener("click", () => {
  if (!session || !activePuzzle || session.complete) return;
  if (!window.confirm(messages.revealConfirmation)) return;
  try {
    const result = session.revealAnswer();
    input.value = "";
    syncActiveProgress();
    renderPuzzleGrid();
    renderResults(session.getResults());
    updateHintControls();
    setGuessingEnabled(false);
    setStatus(messages.gaveUpStatus(result.word), "revealed");
  } catch {
    setStatus(messages.answerFallbackError, "error");
  }
});

languageSelect.addEventListener("change", () => {
  const selected = catalog?.collections.find(
    (collection) => collection.id === languageSelect.value,
  );
  if (!selected || selected.id === activeCollection?.id) return;
  void activateCollection(selected, true);
});

async function initialize(): Promise<void> {
  try {
    catalog = await loadCatalog(dataRoot);
    populateLanguageSelect(catalog);
    applyTranslations();
    const preferred = preferredCollection(catalog);
    const loaded = await activateCollection(preferred, false);
    if (!loaded && preferred.id !== catalog.defaultCollectionId) {
      const fallback = catalog.collections.find(
        (collection) => collection.id === catalog?.defaultCollectionId,
      );
      if (fallback) await activateCollection(fallback, false);
    }
  } catch {
    setStatus(messages.loadError, "error");
  }
}

applyTranslations();
void initialize();
