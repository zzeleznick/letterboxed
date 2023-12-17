import puzzles from "./src/puzzles";
import { build_restricted_trie, Letter, solve_bounded, type Puzzle } from "./src/solutions";
import { load_words } from "./src/utils";
import { set_eq } from "./src/lib";

const solve_fixed = (dict_words: string[], puzzle_raw: string[]) => {
  const puzzle = puzzle_raw.map(
    (arr, row) =>
      arr.toLowerCase().split("").map(
        (v) => Letter.from(v, row),
      ),
  ) as Puzzle;
  let solutions = [];
  const required_letters = new Set(puzzle.flatMap((v) => v).map((v) => v.val));
  const { trie, word_list } = build_restricted_trie(dict_words, puzzle);
  const prefix_map = new Map<string, Set<string>>();
  for (let [word, _letter] of word_list) {
    const prefix = word.at(0);
    const set = prefix_map.get(prefix) ?? new Set();
    set.add(word);
    prefix_map.set(prefix, set);
  }
  for (let [word, letter] of word_list) {
    const prefix = letter.val;
    const next_words = prefix_map.get(prefix);
    if (!next_words) {
      continue;
    }
    for (let candidate of next_words.values()) {
      // console.log(`word: ${word}, candidate: ${candidate}`)
      const valid = set_eq(new Set(word.concat(candidate)), required_letters);
      if (valid) {
        solutions.push([word, candidate]);
      }
    }
  }
  return solutions;
};

const solve = solve_fixed // solve_bounded

const main = async () => {
  const words = await load_words(false);
  const solutions = solve(words, puzzles.at(2));
  console.log(`Solutions (${solutions.length}): ${JSON.stringify(solutions)}`);
};

main();
