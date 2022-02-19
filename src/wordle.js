const countOccurrences = (string, character) => (string.match(new RegExp(character, 'g')) ?? []).length

const countLetters = word => {
  const counts = {};
  for (const letter of word) {
    counts[letter] = (counts[letter] ?? 0) + 1;
  }
  return counts;
}

const scoreLetters = (words) => {
  let letters = {};

  let effectiveCount = words.length;
  words.forEach(word => {
    Object.entries(countLetters(word)).forEach(([letter, occurrences]) => {
      letters[letter] ??= [];
      for (const i of range(4)) {
        letters[letter][i] ??= 0;
        if (i < occurrences) letters[letter][i] += 1;
      }
    })
  })
  for (const scores of Object.values(letters)) {
    for (const [i, score] of scores.entries()) {
      if (score > effectiveCount / 2) scores[i] = effectiveCount - score;
    }
  }
  return letters;
}

const score = (word, letters, validWords) => {
  const baseScore = Object.entries(countLetters(word)).map(([letter, count]) => letters[letter]?.[count - 1] ?? 0).reduce((a, b) => a + b, 0);
  if (!validWords.includes(word)) return baseScore;
  return baseScore * 1.1 + 1;
}

const range = function* (n) { for (let i = 0; i < n; i++) yield i }

const testGuess = (guess, solution) => {
  const result = [];
  // Handle duplicate letters by counting the number of times each letter occurs without being counted
  const letterOccurrences = {};
  for (const i of range(5)) {
    const nextLetter = solution[i];
    if (guess[i] !== nextLetter) {
      letterOccurrences[nextLetter] = (letterOccurrences[nextLetter] ?? 0) + 1;
    }
  }

  for (const i of range(5)) {
    const nextLetter = guess[i];

    if (nextLetter === solution[i]) {
      result.push('GREEN');
    } else if (letterOccurrences[nextLetter]) {
      letterOccurrences[nextLetter] -= 1;
      result.push('YELLOW');
    } else {
      result.push('GRAY');
    }
  }
  return result;
};

const makeGuess = (
  guess, response,
  {
    fixed: oldFixed = '.....',
    good: oldGood = {},
    bad: oldBad = {},
    badPositions = {},
    guessResult = ''
  } = {}
) => {
  let knownFixed = '';
  let newGood = {};
  let newBad = new Set();

  for (const [i, color] of response.entries()) {
    const nextLetter = guess[i];
    switch (color) {
      case 'GREEN':
        guessResult += '🟩';
        newGood[nextLetter] = (newGood[nextLetter] ?? 0) + 1;
        knownFixed += nextLetter;
        break;
      case 'YELLOW':
        guessResult += '🟨';
        newGood[nextLetter] = (newGood[nextLetter] ?? 0) + 1;
        badPositions = { ...badPositions, [nextLetter]: new Set(badPositions[nextLetter]).add(i) }
        knownFixed += oldFixed[i];
        break;
      case 'GRAY':
        guessResult += '⬜';
        newBad.add(nextLetter);
        knownFixed += oldFixed[i];
        break;
    }
  }
  guessResult += ` ${guess}\n`;
  const goodLetters = Object.fromEntries([...new Set(Object.keys(oldGood).concat(Object.keys(newGood)))].map(letter => [letter, Math.max(oldGood[letter] ?? 0, newGood[letter] ?? 0)]));
  const badLetters = { ...oldBad, ...Object.fromEntries([...newBad].map(letter => [letter, (goodLetters[letter] ?? 0) + 1])) };
  return {
    fixed: knownFixed,
    good: goodLetters,
    bad: badLetters,
    badPositions,
    guessResult
  };
}

const chooseWord = (words, guessPool = words) => {
  const letterScores = scoreLetters(words);
  if (verboseMode) {
    console.log('scored letters', Object.fromEntries(Object.entries(letterScores).sort(([, a], [, b]) => b - a)));
  }
  return guessPool.reduce((best, next) => score(best, letterScores, words) > score(next, letterScores, words) ? best : next);
}

const filterWords = (words, known) => {
  const regex = new RegExp(known.fixed);
  return words.filter(word =>
    regex.test(word)
    && Object.entries(known.good).every(([letter, count]) => countOccurrences(word, letter) >= count)
    && Object.entries(known.bad).every(([letter, count]) => countOccurrences(word, letter) < count)
    && Object.entries(known.badPositions).every(([letter, positions]) => [...positions].every(position => word[position] !== letter))
  )
}

const printKnown = (known) => {
  console.log(known.guessResult);

  if (!known.fixed.includes('.')) return;

  console.log('Known', known.fixed);
  console.log('Good', known.good);
  console.log('Bad', known.bad);
  console.log('Bad Positions', known.badPositions);
}

const readline = require('readline');

const { stdin: input, stdout: output } = require('node:process');

const rl = readline.createInterface({ input, output });

const question = text => new Promise(resolve => rl.question(text, resolve))

const requestResult = async () => {
  console.log("Please enter the result, with 2 for green, 1 for yellow, and 0 for gray. For example, enter 01120 for ⬜🟨🟨🟩⬜")
  while (true) {
    const response = await question('? ');
    if (/^[012]{5}$/.test(response)) {
      console.log(response);
      return [...response].map(char => ['GRAY', 'YELLOW', 'GREEN'][char]);
    }
    console.error("Please enter five digits.");
  }
}

const requestGuess = async () => {
  console.log("Please enter the guess")
  while (true) {
    const response = await question('? ');
    if (!response || /^[a-z]{5}$/.test(response)) {
      return response;
    }
    console.error("Please enter five letters.");
  }
}

let gameModeName = 'normal';

const args = process.argv.slice(2);

const defineFlag = flag => {
  const position = args.indexOf(flag);
  const enabled = position !== -1;
  if (enabled) args.splice(position, 1);
  return enabled;
}

const defineFlagWithArgument = (flag) => {
  let position = args.indexOf(flag);
  if (position !== -1) {
    if (position === args.length - 1) {
      printUsage();
    }
    const arg = args[position + 1];
    args.splice(position, 2);
    return arg;
  }

  position = args.findIndex(arg => arg.startsWith(flag + '='));
  if (position !== -1) {
    const arg = args[position].substring(flags.length + 1);
    args.splice(position, 1);
    return arg;
  }
}

const printUsage = () => {
  console.log([
    'Usage:',
    '  node wordle.js [--verbose|--quiet] [--hard] answer',
    '  node wordle.js [--test] [--hard]',
    '  node wordle.js [--score] answer guess',
  ].join('\n'));
  process.exit(1);
}

const hardMode = defineFlag('--hard');
const quietMode = defineFlag('--quiet');
const verboseMode = defineFlag('--verbose');
const testMode = defineFlag('--test');
const freeMode = defineFlag('--free');
const scoreMode = defineFlag('--score');
const roundCount = parseInt(defineFlagWithArgument('--rounds'), 10) || 6;
const wordFile = defineFlagWithArgument('--file') ?? 'words.json';

const loadAllWords = () => JSON.parse(require('fs').readFileSync(wordFile, 'utf8'));

if (testMode) gameModeName = 'test';
if (scoreMode) gameModeName = 'score';

const gameModes = {
  normal: {
    maxArgs: 1,
    async run([solution]) {
      const allWords = loadAllWords();

      if (solution && !allWords.includes(solution)) {
        console.log(`Unknown word ${solution}`);
        process.exit(1);
      }

      let known, words = allWords;
      for (const i of range(Infinity)) {
        let guess;
        if (freeMode) {
          guess = await requestGuess();
        }
        if (!guess) {
          const guessPool = hardMode || i >= roundCount - 1 ? words : allWords;
          guess = chooseWord(words, guessPool);
        }
        if (!quietMode || !solution) console.log('Guessing', guess);
        const response = solution ? testGuess(guess, solution) : await requestResult();
        known = makeGuess(guess, response, known);
        if (!known.fixed.includes('.')) break;

        words = filterWords(words, known);
        if (words.length === 0) {
          console.error("Word not known with constraints:");
          printKnown(known);
          process.exit(1);
        } else {
          if (!quietMode) printKnown(known);
        }
        if (!quietMode) console.log("Possible solutions", words);
      }
      console.log(known.guessResult.trim());
      console.log(countOccurrences(known.guessResult, '\n'));
      process.exit(0);
    }
  },
  test: {
    maxArgs: 0,
    async run() {
      const frequencyOfScores = {};

      const allWords = loadAllWords();

      await Promise.any(
        [
          new Promise(async resolve => {
            for (const answer of allWords) {
              await new Promise(r => setTimeout(r, 0));

              let known, words = allWords;
              for (const i of range(10)) {
                const guessPool = hardMode ? words : allWords;
                const guess = chooseWord(words, guessPool);
                const response = testGuess(guess, solution);
                known = makeGuess(guess, response, known);
                if (!known.fixed.includes('.')) break;
                words = filterWords(words, known);
              }
              const score = countOccurrences(known.guessResult, '\n')
              frequencyOfScores[score] = (frequencyOfScores[score] ?? 0) + 1
            }
            resolve();
          }),
          new Promise(resolve => {
            process.on('SIGINT', () => {
              process.on('SIGINT', () => process.exit(1));
              resolve();
            });
          })
        ]
      );

      console.log(Object.fromEntries(Object.entries(frequencyOfScores).sort(([a], [b]) => a - b)));
      process.exit();
    }
  },
  score: {
    minArgs: 2,
    maxArgs: 2,
    run([expected, found]) {
      const known = makeGuess(found, expected);
      printKnown(known);
    }
  }
}

const gameMode = gameModes[gameModeName];

if (!gameMode || (gameMode.minArgs ?? 0) > args.length || (gameMode.maxArgs ?? Infinity) < args.length) {
  printUsage();
}
gameMode.run(args);
