import "./styles.css";
import { loadCollection, loadPuzzle } from "./data";
import { formatScore, GameSession, GuessError } from "./game";
import type { GuessResult, PuzzleSummary, VocabularyData } from "./types";

function requiredElement<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Missing required element #${id}.`);
  return element as T;
}

const root = requiredElement<HTMLElement>("semantic-game");
const configuredDataRoot = root.dataset.dataRoot;
if (!configuredDataRoot) throw new Error("The game data path is missing.");
const dataRoot: string = configuredDataRoot;

const puzzleSelect = requiredElement<HTMLSelectElement>("puzzle-select");
const resetButton = requiredElement<HTMLButtonElement>("reset-button");
const form = requiredElement<HTMLFormElement>("guess-form");
const input = requiredElement<HTMLInputElement>("guess-input");
const guessButton = requiredElement<HTMLButtonElement>("guess-button");
const status = requiredElement<HTMLParagraphElement>("status");
const history = requiredElement<HTMLTableSectionElement>("guess-history");
const guessCount = requiredElement<HTMLSpanElement>("guess-count");

let vocabulary: VocabularyData;
let puzzles: PuzzleSummary[] = [];
let session: GameSession | null = null;

function setStatus(message: string, kind: "normal" | "error" | "success" = "normal"): void {
  status.textContent = message;
  status.dataset.kind = kind;
}

function setGuessingEnabled(enabled: boolean): void {
  input.disabled = !enabled;
  guessButton.disabled = !enabled;
}

function renderResults(results: readonly GuessResult[]): void {
  history.replaceChildren();
  guessCount.textContent = String(results.length);

  if (results.length === 0) {
    const row = history.insertRow();
    row.id = "empty-row";
    const cell = row.insertCell();
    cell.colSpan = 3;
    cell.textContent = "No guesses yet.";
    return;
  }

  for (const result of results) {
    const row = history.insertRow();
    if (result.solved) row.className = "solved-row";
    row.insertCell().textContent = result.word;
    row.insertCell().textContent = formatScore(result.score);
    row.insertCell().textContent = result.rank === null ? "cold" : `#${result.rank}`;
  }
}

async function selectPuzzle(puzzle: PuzzleSummary): Promise<void> {
  session = null;
  puzzleSelect.disabled = true;
  setGuessingEnabled(false);
  resetButton.disabled = true;
  renderResults([]);
  setStatus(`Loading ${puzzle.label}…`);

  try {
    const data = await loadPuzzle(dataRoot, puzzle.file);
    session = new GameSession(vocabulary, data);
    setGuessingEnabled(true);
    puzzleSelect.disabled = false;
    resetButton.disabled = false;
    setStatus("Try any common English word.");
    input.focus();
  } catch (error) {
    puzzleSelect.disabled = false;
    setStatus(error instanceof Error ? error.message : "Could not load this puzzle.", "error");
  }
}

function currentPuzzle(): PuzzleSummary {
  const puzzle = puzzles[Number(puzzleSelect.value)];
  if (!puzzle) throw new Error("The selected puzzle does not exist.");
  return puzzle;
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  if (!session) return;

  try {
    const result = session.guess(input.value);
    renderResults(session.getResults());
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

puzzleSelect.addEventListener("change", () => void selectPuzzle(currentPuzzle()));
resetButton.addEventListener("click", () => void selectPuzzle(currentPuzzle()));

async function initialize(): Promise<void> {
  try {
    const collection = await loadCollection(dataRoot);
    vocabulary = collection.vocabulary;
    puzzles = collection.manifest.puzzles;
    puzzleSelect.replaceChildren(
      ...puzzles.map((puzzle, index) => {
        const option = document.createElement("option");
        option.value = String(index);
        option.textContent = puzzle.label;
        return option;
      }),
    );
    puzzleSelect.disabled = false;
    await selectPuzzle(currentPuzzle());
  } catch (error) {
    setStatus(error instanceof Error ? error.message : "Could not start the game.", "error");
  }
}

void initialize();
