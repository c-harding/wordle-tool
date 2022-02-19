#!/usr/bin/env node

import arg from "arg";
import { createInterface } from "readline";
import { stdin, stdout } from "process";
import { readFileSync } from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const countOccurrences = (string: string, character: string) =>
  (string.match(new RegExp(character, "g")) ?? []).length;

const countLetters = (word: string): Record<string, number> => {
  const counts: Record<string, number> = {};
  for (const letter of word) {
    counts[letter] = (counts[letter] ?? 0) + 1;
  }
  return counts;
};

function* range(n = Infinity) {
  for (let i = 0; i < n; i += 1) yield i;
}

type LetterScores = Record<string, number[]>;

const scoreLetters = (words: string[]) => {
  const letters: LetterScores = {};

  const effectiveCount = words.length;
  words.forEach((word) => {
    Object.entries(countLetters(word)).forEach(([letter, occurrences]) => {
      letters[letter] ??= [];
      for (const i of range(4)) {
        letters[letter][i] ??= 0;
        if (i < occurrences) letters[letter][i] += 1;
      }
    });
  });
  for (const scores of Object.values(letters)) {
    for (const [i, score] of scores.entries()) {
      if (score > effectiveCount / 2) scores[i] = effectiveCount - score;
    }
  }
  return letters;
};

const scoreWord = (word: string, letters: LetterScores, validWords: string[]) => {
  const baseScore = Object.entries(countLetters(word))
    .map(([letter, count]) => letters[letter]?.[count - 1] ?? 0)
    .reduce((a, b) => a + b, 0);
  if (!validWords.includes(word)) return baseScore;
  return baseScore * 1.1 + 1;
};

enum LetterResult {
  PERFECT,
  CLOSE,
  WRONG,
}

const makeGuess = (guess: string, solution: string): LetterResult[] => {
  const result: LetterResult[] = [];
  // Handle duplicate letters by counting the number of times each letter occurs without being counted
  const letterOccurrences: Record<string, number> = {};
  for (const i of range(5)) {
    const nextLetter = solution[i];
    if (guess[i] !== nextLetter) {
      letterOccurrences[nextLetter] = (letterOccurrences[nextLetter] ?? 0) + 1;
    }
  }

  for (const i of range(5)) {
    const nextLetter = guess[i];

    if (nextLetter === solution[i]) {
      result.push(LetterResult.PERFECT);
    } else if (letterOccurrences[nextLetter]) {
      letterOccurrences[nextLetter] -= 1;
      result.push(LetterResult.CLOSE);
    } else {
      result.push(LetterResult.WRONG);
    }
  }
  return result;
};

type LetterCount = Record<string, number>;

interface Known {
  fixed: string;
  good: LetterCount;
  bad: LetterCount;
  badPositions: Record<string, Set<number>>;
  guessResult: string;
  solved: boolean;
}

const nothingKnown = (): Known => ({
  fixed: ".....",
  good: {},
  bad: {},
  badPositions: {},
  guessResult: "",
  solved: false,
});

const updateKnown = (
  guess: string,
  response: LetterResult[],
  {
    fixed: oldFixed,
    good: oldGood,
    bad: oldBad,
    badPositions: oldBadPositions,
    guessResult: oldGuessResult,
  } = nothingKnown()
): Known => {
  let knownFixed = "";
  const newGood: Record<string, number> = {};
  const newBad = new Set<string>();
  let guessResult = oldGuessResult;
  let badPositions = oldBadPositions;

  for (const [i, letterResult] of response.entries()) {
    const nextLetter = guess[i];
    switch (letterResult) {
      case LetterResult.PERFECT:
        guessResult += "🟩";
        newGood[nextLetter] = (newGood[nextLetter] ?? 0) + 1;
        knownFixed += nextLetter;
        break;
      case LetterResult.CLOSE:
        guessResult += "🟨";
        newGood[nextLetter] = (newGood[nextLetter] ?? 0) + 1;
        badPositions = {
          ...badPositions,
          [nextLetter]: new Set(badPositions[nextLetter]).add(i),
        };
        knownFixed += oldFixed[i];
        break;
      case LetterResult.WRONG:
        guessResult += "🟥";
        newBad.add(nextLetter);
        knownFixed += oldFixed[i];
        break;
      default:
        throw new Error(`Unknown letter result ${letterResult} in ${JSON.stringify(response)}`);
    }
  }
  guessResult += ` ${guess}\n`;
  const goodLetters = Object.fromEntries(
    [...new Set(Object.keys(oldGood).concat(Object.keys(newGood)))].map((letter) => [
      letter,
      Math.max(oldGood[letter] ?? 0, newGood[letter] ?? 0),
    ])
  );
  const badLetters = {
    ...oldBad,
    ...Object.fromEntries([...newBad].map((letter) => [letter, (goodLetters[letter] ?? 0) + 1])),
  };
  return {
    fixed: knownFixed,
    good: goodLetters,
    bad: badLetters,
    badPositions,
    guessResult,
    solved: response.every((position) => position === LetterResult.PERFECT),
  };
};

const scoreWords = (word: string, threadLetterScores: LetterScores[], threadWords: string[][]) =>
  threadWords
    .map((words, i) => scoreWord(word, threadLetterScores[i], words))
    .reduce((acc, value) => acc + value, 0);

const chooseWord = (
  threadWords: string[][],
  guessPool = threadWords.flat(),
  verboseMode = false
) => {
  const threadLetterScores = threadWords.map((words) => scoreLetters(words));
  if (verboseMode) {
    console.log(
      "scored letters",
      threadLetterScores.map((letterScores) =>
        Object.fromEntries(Object.entries(letterScores).sort(([, a], [, b]) => b[0] - a[0]))
      )
    );
  }
  return guessPool.reduce((best, next) =>
    scoreWords(best, threadLetterScores, threadWords) >
      scoreWords(next, threadLetterScores, threadWords)
      ? best
      : next
  );
};

const filterWords = (words: string[], known: Known) => {
  const regex = new RegExp(known.fixed);
  return words.filter(
    (word) =>
      regex.test(word) &&
      Object.entries(known.good).every(
        ([letter, count]) => countOccurrences(word, letter) >= count
      ) &&
      Object.entries(known.bad).every(
        ([letter, count]) => countOccurrences(word, letter) < count
      ) &&
      Object.entries(known.badPositions).every(([letter, positions]) =>
        [...positions].every((position) => word[position] !== letter)
      )
  );
};

const showRepeatedLetters = (letters: LetterCount) =>
  Object.entries(letters)
    .map(([letter, count]) => letter.repeat(count))
    .join("");

const showBadPositions = (badPositions: Record<string, Set<number>>) =>
  [...range(5)]
    .map((i) =>
      Object.keys(badPositions)
        .filter((letter) => badPositions[letter].has(i))
        .join("")
    )
    .join("|");

const showKnown = (known: Known, thread?: number) => {
  return [
    thread !== undefined && `Thread: ${thread}`,
    known.guessResult.trim(),
    ...(known.solved
      ? []
      : [
        `Known ${known.fixed}`,
        `Good ${showRepeatedLetters(known.good)}`,
        `Bad ${showRepeatedLetters(known.bad)}`,
        `Bad Positions ${showBadPositions(known.badPositions)}`,
        `Remaining ${[..."abcdefghijklmnopqrstuvwxyz"]
          .filter((letter) => !(letter in known.good || letter in known.bad))
          .join("")}`,
      ]),
  ]
    .filter(Boolean)
    .join("\n");
};

const printKnown = (known: Known, thread?: number) => {
  console.log(showKnown(known, thread));
};

const rl = createInterface({ input: stdin, output: stdout });

const question = (text: string) =>
  new Promise<string>((resolve) => {
    rl.question(text, resolve);
  });

const requestResult = async (thread?: number): Promise<LetterResult[]> => {
  console.log(`Please enter the result${thread !== undefined ? ` for thread ${thread + 1}` : ""}.`);
  while (true) {
    const response = await question("? ");
    if (/^[012]{5}$/.test(response)) {
      return [...response].map(
        (char) => [LetterResult.WRONG, LetterResult.CLOSE, LetterResult.PERFECT][+char]
      );
    }
    console.error(
      "Please enter five digits (0 = not in word, 1 = wrong position, 2 = right position)."
    );
  }
};

const requestGuess = async (allWords: string[]) => {
  console.log("Please enter the guess");
  while (true) {
    const response = await question("? ");
    if (!response) {
      return response;
    }
    if (!/^[a-z]{5}$/.test(response)) {
      console.error("Please enter five letters.");
    } else if (!allWords.includes(response)) {
      console.error("Please enter a valid word.");
    } else {
      return response;
    }
  }
};

enum GameModeName {
  NORMAL,
  TEST,
  SCORE,
}
interface GameMode {
  maxArgs?: number;
  minArgs?: number;
  run(args: string[]): void;
}

let gameModeName: GameModeName = GameModeName.NORMAL;

const usage = `wordle-tool v0.0.1

Usage:
  wordle-tool --help
  wordle-tool [--verbose|--quiet] [--hard] [--file=words.json] [--random] [--free] [--rounds=6] [--threads=4]
  wordle-tool [--verbose|--quiet] [--hard] [--file=words.json] [--free] [--rounds=6] answer
  wordle-tool [-v|-q] [--hard] [--file=words.json] [--free] [--rounds=6] [--threads=4] answer1 answer2 answer3 answer4
  wordle-tool [--verbose|--quiet] [--hard] answer
  wordle-tool [--test] [--file=words.json] [--hard]
  wordle-tool [--score=guess] answer

  --help, -h: print this message
  --verbose, -v:  print each letter's score for each round
  --quiet, -q:    do not print possible solutions after each guess
  --hard, -H:     only guess words that have the potential to win. Sometimes guessing words that cannot win helps to
                  eliminate more letters at once
  --file, -f:     choose an alternative source of words. This is a JSON array, and defaults to the provided words.json
  --free, -F:     the user specifies the guess, rather than the computer.
  --rounds, -r:   the number of rounds to play. This is used to end the game, and when the number of rounds left is less
                  than or equal to the number of threads left to guess, hard mode is activated to avoid wasting guesses.
  --threads, -t:  the number of games to play in parallel with the same guesses, inspired by Quordle. Defaults to 1
  --random, -R:   generate a word randomly. Useful in combination with --free for playing Wordle locally
  --test, -T:     run the program with every word in the word list, and collect the numbers of rounds needed to win.
                  This takes a while, but can be aborted with Ctrl-C, which still shows the results.
  --score, -S:    show the information known after making a guess, and exit.

  trailing parameters:  the trailing parameters are the word that are being guessed. Not compatible with
                        --random. This is optional, and if not given, the user will be prompted to enter the
                        result of each guess. There should be exactly one unless --threads is given, in which
                        case there should be exactly as many parameters as the number of threads.


Examples:
$ wordle-tool
    Run an computer player against an external Wordle game with the default settings. It will propose guesses, and you
    can enter in the response by typing 0 for a wrong letter, 1 for a wrong position, or 2 for a correct position.
$ wordle-tool -H
    Run an computer player against an external Wordle game with hard mode enabled.
$ wordle-tool -q
    As above, but do not print the list of possible words.
$ wordle-tool boxes
    Run a demonstration of the AI against the word "boxes"
$ wordle-tool -FRq
    Run a game locally, using a random word.
$ wordle-tool -t 4
Run an computer player against an external Quordle game with the default settings.
`;

const printUsage = (): never => {
  console.log(usage);
  process.exit(1);
};

const {
  "--help": helpMode,
  "--hard": hardMode,
  "--quiet": quietMode,
  "--verbose": verboseMode,
  "--test": testMode,
  "--random": randomMode,
  "--free": freeMode,
  "--score": scoreGuess,
  "--threads": threadCount = 1,
  "--rounds": rawRoundCount,
  "--file": wordFile = path.normalize(
    `${path.dirname(fileURLToPath(import.meta.url))}/../words.json`
  ),
  _: args,
} = arg({
  "--help": Boolean,
  "-h": "--help",
  "--hard": Boolean,
  "-H": "--hard",
  "--quiet": Boolean,
  "-q": "--quiet",
  "--verbose": Boolean,
  "-v": "--verbose",
  "--test": Boolean,
  "-T": "--test",
  "--random": Boolean,
  "-R": "--random",
  "--free": Boolean,
  "-F": "--free",
  "--score": String,
  "-S": "--score",
  "--threads": Number,
  "-t": "--threads",
  "--rounds": Number,
  "-r": "--rounds",
  "--file": String,
  "-f": "--file",
});

const roundCount = rawRoundCount ?? 5 + threadCount;

const mapAsyncSequentially = async <A, B>(
  array: A[],
  mapper: (value: A, index: number, array: A[]) => Promise<B>
): Promise<B[]> => {
  const result: B[] = [];
  for (const i of range(array.length)) {
    result.push(await mapper(array[i], i, array));
  }
  return result;
};

const juxtapose = (outputs: string[]): string => {
  const height = Math.max(...outputs.map((output) => countOccurrences(output, "\n") + 1));
  const paddedOutputs = outputs.map((output) => {
    const lines = output.split("\n");
    const paddedLines = lines.concat(Array.from({ length: height - lines.length }, () => ""));
    const width = Math.max(...paddedLines.map((line) => line.length));
    return paddedLines.map((line) => line.padEnd(width));
  });
  return paddedOutputs[0]
    .map((_, i) => paddedOutputs.map((output) => output[i]).join("  "))
    .join("\n");
};

const loadAllWords = (): string[] => JSON.parse(readFileSync(wordFile, "utf8"));

if (helpMode) printUsage();
if (testMode) gameModeName = GameModeName.TEST;
if (scoreGuess) gameModeName = GameModeName.SCORE;

const gameModes: Record<GameModeName, GameMode> = {
  [GameModeName.NORMAL]: {
    async run(solutions) {
      let hasSolutions = solutions.length !== 0;
      if (hasSolutions && solutions.length !== threadCount) {
        console.error("Error: the correct number of solutions must be provided with --threads");
        printUsage();
      }

      const allWords = loadAllWords();

      if (randomMode) {
        if (hasSolutions) {
          console.error("Error: --random cannot be used when solutions are provided");
          printUsage();
        }

        solutions.push(
          ...Array.from(
            { length: threadCount },
            () => allWords[Math.floor(Math.random() * allWords.length)]
          )
        );
        hasSolutions = true;
      }

      for (const solution of solutions) {
        if (solution && !allWords.includes(solution)) {
          console.log(`Unknown word ${solution}`);
          process.exit(1);
        }
      }

      let threadKnown = Array.from({ length: threadCount }, () => nothingKnown());

      let threadWords = Array.from({ length: threadCount }, () => allWords);

      for (const roundNumber of range(roundCount)) {
        let guess = "";
        if (freeMode) {
          guess = await requestGuess(allWords);
        }
        if (!guess) {
          const wordsToGuess = threadKnown.filter((known) => !known.solved).length;
          const guessPool =
            hardMode || roundNumber >= roundCount - wordsToGuess ? threadWords.flat() : allWords;
          guess = chooseWord(threadWords, guessPool, verboseMode);
        }
        if (!quietMode || !hasSolutions) console.log("Guessing", guess);
        const newKnown = await mapAsyncSequentially(threadKnown, async (known, i) => {
          if (known.solved) return known;
          const response = hasSolutions
            ? makeGuess(guess, solutions[i])
            : await requestResult(threadCount > 1 ? i : undefined);
          return updateKnown(guess, response, known);
        });
        threadKnown = newKnown;
        if (threadKnown.every((known) => known.solved)) break;

        threadWords = threadWords.map((words, i) => {
          if (newKnown[i].solved) return [];
          const remainingWords = filterWords(words, newKnown[i]);

          if (remainingWords.length === 0) {
            console.error(`Word not known with constraints:`);
            printKnown(newKnown[i], threadCount > 1 ? i : undefined);
            process.exit(1);
          }

          return remainingWords;
        });

        console.log();
        console.log(
          juxtapose(
            threadKnown.map((known, i) => showKnown(known, threadCount > 1 ? i : undefined))
          )
        );
        console.log();

        if (!quietMode) console.log("Possible solutions", threadWords);
      }
      const threadGuessResult = juxtapose(threadKnown.map((known) => known.guessResult.trim()));
      console.log(threadGuessResult);

      if (threadKnown.every((known) => known.solved)) {
        console.log("Score:", countOccurrences(threadGuessResult, "\n") + 1);
        process.exit(0);
      } else {
        console.log("You lost");
        if (hasSolutions) console.log("The answer was", solutions);
        process.exit(1);
      }
    },
  },
  [GameModeName.TEST]: {
    maxArgs: 0,
    async run() {
      const frequencyOfScores: Record<number, number> = {};

      const allWords = loadAllWords();

      await Promise.any([
        (async () => {
          for (const solution of allWords) {
            await new Promise((r) => {
              setTimeout(r, 0);
            });

            let known = nothingKnown();
            let words = allWords;
            for (const _ of range(10)) {
              const guessPool = hardMode ? words : allWords;
              const guess = chooseWord([words], guessPool);
              const response = makeGuess(guess, solution);
              known = updateKnown(guess, response, known);
              if (!known.fixed.includes(".")) break;
              words = filterWords(words, known);
            }
            const score = countOccurrences(known.guessResult, "\n") + 1;
            frequencyOfScores[score] = (frequencyOfScores[score] ?? 0) + 1;
          }
        })(),
        new Promise<void>((resolve) => {
          process.on("SIGINT", () => {
            process.on("SIGINT", () => process.exit(1));
            resolve();
          });
        }),
      ]);

      console.log(
        Object.fromEntries(Object.entries(frequencyOfScores).sort(([a], [b]) => +a - +b))
      );
      process.exit();
    },
  },
  [GameModeName.SCORE]: {
    minArgs: 1,
    maxArgs: 1,
    run([solution]) {
      if (scoreGuess === undefined) {
        console.error("a parameter for --score must be given");
        printUsage();
        return;
      }
      const result = makeGuess(scoreGuess, solution);
      const known = updateKnown(scoreGuess, result);
      printKnown(known);
      process.exit();
    },
  },
};

const gameMode = gameModes[gameModeName];

if (
  !gameMode ||
  (gameMode.minArgs ?? 0) > args.length ||
  (gameMode.maxArgs ?? Infinity) < args.length
) {
  printUsage();
}
gameMode.run(args);
