import "./styles.css";
import { loadCollection, loadPuzzle } from "./data";
import {
  canRevealCategoryHint,
  CATEGORY_GUESS_REQUIREMENT,
  CLOSEST_HINT_RANK,
  formatScore,
  GameSession,
  GuessError,
} from "./game";
import { emptyProgress, loadProgress, saveProgress } from "./persistence";
import type {
  GuessResult,
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

const root = requiredElement<HTMLElement>("semantic-game");
const configuredDataRoot = root.dataset.dataRoot;
if (!configuredDataRoot) throw new Error("The game data path is missing.");
const dataRoot: string = configuredDataRoot;

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

let vocabulary: VocabularyData;
let puzzles: PuzzleSummary[] = [];
let progress: StoredProgress;
let activePuzzle: PuzzleSummary | null = null;
let session: GameSession | null = null;
let loadSequence = 0;
const sessions = new Map<string, GameSession>();
let browserStorage: Storage | null = null;
try {
  browserStorage = window.localStorage;
} catch {
  // Browser privacy settings may make localStorage unavailable.
}

function setStatus(
  message: string,
  kind: "normal" | "error" | "success" | "revealed" = "normal",
): void {
  status.textContent = message;
  status.dataset.kind = kind;
}

function setGuessingEnabled(enabled: boolean): void {
  input.disabled = !enabled;
  guessButton.disabled = !enabled;
}

function persist(): void {
  if (browserStorage) saveProgress(browserStorage, progress);
}

function savedProgress(puzzleId: string): SavedPuzzleProgress | undefined {
  return progress.puzzles[puzzleId];
}

function categoryIsRevealed(): boolean {
  return activePuzzle ? (savedProgress(activePuzzle.id)?.categoryRevealed ?? false) : false;
}

function syncActiveProgress(): void {
  if (!activePuzzle || !session) return;
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
  wordHintButton.textContent = session && !session.solved && nextRank === null ? "No more word hints" : "Word hint";

  const guesses = session?.getResultCounts().guesses ?? 0;
  const revealed = categoryIsRevealed();
  giveUpButton.disabled = !session || session.complete;

  if (!session || session.complete) {
    categoryHintButton.disabled = true;
    categoryHintButton.textContent = "Category hint";
  } else if (revealed) {
    categoryHintButton.disabled = true;
    categoryHintButton.textContent = "Category revealed";
  } else if (!canRevealCategoryHint(session)) {
    categoryHintButton.disabled = true;
    categoryHintButton.textContent = `Category hint (${guesses}/${CATEGORY_GUESS_REQUIREMENT})`;
  } else {
    categoryHintButton.disabled = false;
    categoryHintButton.textContent = "Category hint";
  }

  if (session && revealed) {
    const name = session.category[0].toUpperCase() + session.category.slice(1);
    categoryClue.textContent = `Category: ${name}`;
    categoryClue.hidden = false;
  } else {
    categoryClue.textContent = "";
    categoryClue.hidden = true;
  }
}

function renderResults(results: readonly GuessResult[]): void {
  historySection.hidden = results.length === 0;
  history.replaceChildren();
  const counts = session?.getResultCounts() ?? { guesses: 0, hints: 0 };
  const hintCount = counts.hints + (categoryIsRevealed() ? 1 : 0);
  historyCount.textContent = `${counts.guesses} ${counts.guesses === 1 ? "guess" : "guesses"} · ${hintCount} ${hintCount === 1 ? "hint" : "hints"}`;

  if (results.length === 0) {
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
      badge.textContent = "Hint";
      wordCell.append(badge);
    } else if (result.source === "answer") {
      const badge = document.createElement("span");
      badge.className = "answer-badge";
      badge.textContent = "Answer";
      wordCell.append(badge);
    }
    row.insertCell().textContent = formatScore(result.score);
    row.insertCell().textContent = result.rank === null ? "cold" : `#${result.rank}`;
  }
}

function renderPuzzleGrid(): void {
  puzzleGrid.replaceChildren(
    ...puzzles.map((puzzle, index) => {
      const saved = savedProgress(puzzle.id);
      const started = Boolean(saved && (saved.actions.length > 0 || saved.categoryRevealed));
      const button = document.createElement("button");
      button.type = "button";
      button.className = "puzzle-button";
      button.dataset.state = saved?.solved
        ? "solved"
        : saved?.gaveUp
          ? "revealed"
          : started
            ? "started"
            : "untouched";
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
      button.setAttribute(
        "aria-label",
        `Puzzle ${visibleNumber}${saved?.solved ? ", solved" : saved?.gaveUp ? ", answer revealed" : started ? ", started" : ""}`,
      );
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
    const answer = session.getResults().find((result) => result.solved)?.word ?? "the target";
    setStatus(`Solved! The word was “${answer}”.`, "success");
    setGuessingEnabled(false);
  } else if (session.gaveUp) {
    const answer = session.getResults().find((result) => result.source === "answer")?.word ?? "the target";
    setStatus(`You gave up. The word was “${answer}”.`, "revealed");
    setGuessingEnabled(false);
  } else {
    setGuessingEnabled(true);
    setStatus(session.getActions().length > 0 ? "Progress restored. Keep guessing." : "Try any common English word.");
    input.focus();
  }
}

async function selectPuzzle(puzzle: PuzzleSummary): Promise<void> {
  const sequence = ++loadSequence;
  activePuzzle = puzzle;
  progress.selectedPuzzleId = puzzle.id;
  persist();
  renderPuzzleGrid();

  const cached = sessions.get(puzzle.id);
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
  setStatus(`Loading ${puzzle.label}…`);

  try {
    const data = await loadPuzzle(dataRoot, puzzle.file);
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
    sessions.set(puzzle.id, loadedSession);
    if (sequence !== loadSequence) return;
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
  } catch (error) {
    if (sequence !== loadSequence) return;
    setStatus(error instanceof Error ? error.message : "Could not load this puzzle.", "error");
  }
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
      setStatus(`Solved! The word was “${result.word}”.`, "success");
      setGuessingEnabled(false);
    } else {
      setStatus(result.rank === null ? "That guess is cold." : `That guess is ranked #${result.rank}.`);
      input.focus();
    }
  } catch (error) {
    setStatus(error instanceof GuessError ? error.message : "That guess could not be scored.", "error");
    input.select();
  }
});

resetButton.addEventListener("click", () => {
  if (!session || !activePuzzle) return;
  session.reset();
  delete progress.puzzles[activePuzzle.id];
  persist();
  renderPuzzleGrid();
  renderResults([]);
  updateHintControls();
  setGuessingEnabled(true);
  setStatus("Puzzle reset. Try any common English word.");
  input.focus();
});

wordHintButton.addEventListener("click", () => {
  if (!session) return;
  try {
    const result = session.revealHint();
    if (!result) {
      updateHintControls();
      setStatus("No safer word hints remain.");
      return;
    }
    syncActiveProgress();
    renderPuzzleGrid();
    renderResults(session.getResults());
    updateHintControls();
    const suffix = result.rank === CLOSEST_HINT_RANK ? " This is the closest available hint." : "";
    setStatus(`Hint: “${result.word}” is ranked #${result.rank}.${suffix}`);
    input.focus();
  } catch (error) {
    setStatus(error instanceof Error ? error.message : "Could not reveal a hint.", "error");
  }
});

categoryHintButton.addEventListener("click", () => {
  if (!session || !activePuzzle || session.complete || categoryIsRevealed()) return;
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
  setStatus(`Category revealed: ${session.category}.`);
  input.focus();
});

giveUpButton.addEventListener("click", () => {
  if (!session || !activePuzzle || session.complete) return;
  if (!window.confirm("Reveal the answer and end this attempt?")) return;
  try {
    const result = session.revealAnswer();
    input.value = "";
    syncActiveProgress();
    renderPuzzleGrid();
    renderResults(session.getResults());
    updateHintControls();
    setGuessingEnabled(false);
    setStatus(`You gave up. The word was “${result.word}”.`, "revealed");
  } catch (error) {
    setStatus(error instanceof Error ? error.message : "Could not reveal the answer.", "error");
  }
});

async function initialize(): Promise<void> {
  try {
    const collection = await loadCollection(dataRoot);
    vocabulary = collection.vocabulary;
    puzzles = collection.manifest.puzzles;
    progress = browserStorage
      ? loadProgress(browserStorage, vocabulary.version, puzzles.map((puzzle) => puzzle.id))
      : emptyProgress(vocabulary.version, puzzles[0]?.id ?? "0");
    const initialPuzzle = puzzles.find((puzzle) => puzzle.id === progress.selectedPuzzleId) ?? puzzles[0];
    if (!initialPuzzle) throw new Error("The puzzle collection is empty.");
    await selectPuzzle(initialPuzzle);
  } catch (error) {
    setStatus(error instanceof Error ? error.message : "Could not start the game.", "error");
  }
}

void initialize();
