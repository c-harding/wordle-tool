# Wordle Tool

This tool is based around the popular word game [Wordle](https://powerlanguage.co.uk/wordle/).
It can be used either as a computer player, or as a game host.
It also supports parallel games, e.g. for [Quordle](https://www.quordle.com/).

## Installation and usage

Use [`yarn`](https://yarnpkg.com/) as the JavaScript package manager.
Run `yarn` to install dependencies, `yarn build` to build the program, and `yarn wordle-tool` to run the program.

## CLI tool

```
wordle-tool v0.0.1

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
```
