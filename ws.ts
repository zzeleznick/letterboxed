import { promises as fs } from "node:fs";

type Puzzle = [Letter[], Letter[], Letter[], Letter[]];
type WordList = [string, Letter][];
type Trie = Map<string, Trie>;

class Letter {
  val: string;
  row: number;
  constructor(char: string, row: number) {
    this.val = char;
    this.row = row;
  }
  static from(char: string, row: number) {
    return new Letter(char, row);
  }
}

const lib = {
  lst_eq<T>(a: T[], b: T[]) {
    if (a.length !== b.length) {
      return false;
    }
    for (let i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) {
        return false;
      }
    }
    return true;
  },
  set_eq<T>(a: Set<T>, b: Set<T>) {
    if (a.size !== b.size) {
      return false;
    }
    return lib.lst_eq(
      Array.from(a.values()).toSorted(),
      Array.from(b.values()).toSorted(),
    );
  },
};

const puzzleLib = {
  load_words: async (local_words = true) => {
    const contents: string = local_words
      ? await puzzleLib.load_words_local()
      : await puzzleLib.load_words_remote();
    return contents.trim().split("\n").filter(
      (w) =>
        96 < w.charCodeAt(0) && w.charCodeAt(0) < 123 && // a is 97, z is 122
        w.length > 2, // min of 3 letter words
    ).concat(["quays", "stromboli"]);
  },
  load_words_local: async () => {
    const buf = await fs.readFile("boggle_words.txt");
    return buf.toString("utf8");
  },
  load_words_remote: async () => {
    const url =
      `https://raw.githubusercontent.com/benhoyt/boggle/master/word-list.txt`;
    const res = await fetch(url);
    return await res.text();
  },
  get_candidates: (trie: Trie, puzzle: Puzzle, buf: string, pos: number) =>
    puzzle.filter(
      (_v, index) => pos !== index,
    )
      .flatMap((v) => v)
      .filter(
        (v) => trieLib.search(trie, buf + v.val),
      ),
  build_restricted_trie: (dict_words: string[], puzzle: Puzzle) => {
    const letterSet = new Set(puzzle.flatMap((v) => v).map((v) => v.val));
    const trie = trieLib.build_trie(dict_words, letterSet);
    let word_set = new Set<string>();
    let word_list: WordList = [];
    let fringe = puzzle
      .flatMap((v) => v)
      .map(
        (ch) => [[], [ch]],
      );
    while (fringe && fringe.length) {
      const node = fringe.shift();
      const [words, buf] = node;
      const last = buf.at(-1)!;
      const pos = last.row;
      const buf_str = buf.map((v) => v.val).join("");
      for (let cd of puzzleLib.get_candidates(trie, puzzle, buf_str, pos)) {
        const possible_word = buf_str.concat(cd.val);
        const is_word = trieLib.search_exact(trie, possible_word);
        if (
          is_word && possible_word.length > 3 && !word_set.has(possible_word)
        ) {
          word_set.add(possible_word);
          word_list.push([possible_word, cd]);
        }
        const nxt_node = [words, buf.concat(cd)];
        fringe.unshift(nxt_node);
      }
    }
    console.log(`Word List Ct: ${word_list.length}`);
    return {
      trie: trieLib.build_trie(Array.from(word_set.values())),
      word_list,
    };
  },
};

const trieLib = {
  search_and_fill: (
    m: Trie,
    word: string,
    fill = true,
    exact_match = false,
  ) => {
    let root = m;
    for (let ch of word) {
      const node = root.get(ch);
      if (!node) {
        if (!fill) return false;
        root.set(ch, new Map());
      }
      root = root.get(ch)!;
    }
    if (fill) {
      root.set("!", new Map()); // Mark valid ending
    }
    return exact_match ? root.get("!")?.size === 0 : true;
  },
  build_trie: (
    words: string[],
    letterSet: Set<string> | undefined = undefined,
  ) => {
    const root: Trie = new Map();
    if (letterSet && letterSet.size > 0) {
      words = words.filter((w) => {
        for (let c of w) {
          if (!letterSet.has(c)) {
            return false;
          }
        }
        return true;
      });
    }
    for (let word of words) {
      trieLib.search_and_fill(root, word);
    }
    return root;
  },
  search: (m: Map<string, Map<string, any>>, word: string) =>
    trieLib.search_and_fill(m, word, false, false),
  search_exact: (m: Map<string, Map<string, any>>, word: string) =>
    trieLib.search_and_fill(m, word, false, true),
};

const solve = (dict_words: string[], puzzle_raw: string[]) => {
  const puzzle = puzzle_raw.map(
    (arr, row) =>
      arr.toLowerCase().split("").map(
        (v) => Letter.from(v, row),
      ),
  ) as Puzzle;
  let solutions = [];
  const required_letters = new Set(puzzle.flatMap((v) => v).map((v) => v.val));
  const { trie, word_list } = puzzleLib.build_restricted_trie(
    dict_words,
    puzzle,
  );
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
      const valid = lib.set_eq(
        new Set(word.concat(candidate)),
        required_letters,
      );
      if (valid) {
        solutions.push([word, candidate]);
      }
    }
  }
  return solutions;
};

const puzzles = [
  [
    "TLQ",
    "SRW",
    "NCE",
    "OAU",
  ],
];

const cmd_line_run = async (local_words = true) => {
  const words = await puzzleLib.load_words(local_words);
  const solutions = solve(words, puzzles.at(0));
  console.log(`Solutions (${solutions.length}): ${JSON.stringify(solutions)}`);
};

const deno_serve = async () => {
  const words = await puzzleLib.load_words(false);
  Deno.serve((req: Request) => {
    const u = new URL(req.url);
    const letters_via_url_path = u.pathname.slice(1).split("-");
    const first_size = letters_via_url_path?.[0].length;
    const valid_puzzle = letters_via_url_path.length > 2 && letters_via_url_path.reduce(
        (a, b) => a && b.length === first_size, first_size > 0
    );
    const puzzle = valid_puzzle ? letters_via_url_path : puzzles.at(0);
    const solutions = solve(words, puzzle);
    console.log(`${Date.now()}: Solutions (${solutions.length})`);
    return new Response(`${JSON.stringify(solutions)}`);
  });
};

const SERVE = false;
SERVE ? deno_serve() : cmd_line_run(true);
