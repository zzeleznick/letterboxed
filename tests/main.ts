import assert from "assert";

import { search, search_exact } from "../src/trie";
import {
  build_trie,
  deserialize_trie,
  load_nyt_puzzle,
  load_trie,
  load_words,
  save_trie,
  serialize_trie,
  withTiming,
} from "../src/utils";
import {
  bin_insert,
  insert_at_optimized,
  insert_at_shift,
  insert_at_simple,
  insert_at_using_copywithin,
  lst_eq,
} from "../src/lib";

const test_trie = () => {
  const words = [
    "able",
    "abduct",
    "abductor",
    "abduction",
    "abduct",
    "cart",
    "catheter",
    "cat",
    "trap",
    "tarp",
    "tart",
    "tasty",
    "party",
  ];
  const test_cases: [string, boolean, boolean][] = [
    // word, exact, expectation
    ["able", false, true],
    ["able", true, true],
    ["aba", false, false],
    ["aba", true, false],
    ["cart", true, true],
    ["cath", false, true],
    ["catheters", false, false],
  ];
  const trie = build_trie(words);
  const caller = (exact: boolean) => exact ? search_exact : search;
  for (let tc of test_cases) {
    const [word, exact, expectation] = tc;
    const res = caller(exact)(trie, word);
    assert(
      res == expectation,
      `Expected ${res} == ${expectation} for word ${word}`,
    );
  }
};

const test_big_insert_at = () => {
  type TestCase = [number, number];
  const test_cases: TestCase[] = [
    [100_000, 100],
    [100_000, 10_00],
    [100_000, 50_000],
    [100_000, 90_000],
    [1_000_000, 10_000],
    [1_000_000, 50_000],
    [1_000_000, 500_000],
    [1_000_000, 900_000],
  ];
  const methods = [
    insert_at_shift,
    insert_at_simple,
    insert_at_using_copywithin,
    insert_at_optimized,
  ];
  for (let tc of test_cases) {
    const [size, index] = tc;
    console.log(`=======Testing (size: ${size}, index: ${index})=======`);
    for (let fnc of methods) {
      const a = Array(size).fill(0);
      const f = () => fnc(a, 1, index);
      withTiming(f, 10, fnc.name);
    }
  }
};

const test_insert_at = () => {
  type Operation<T> = [T, number];
  type TestCase<T> = [T[], T[], Operation<T>[]];
  const test_cases: TestCase<number | string>[] = [
    [[1], [2, 1], [[2, 0]]],
    [[1], [1, 2], [[2, 1]]],
    [[1, 2], [1, 2, 3], [[3, 2]]],
    [[1, 2, 4], [1, 2, 3, 4], [[3, 2]]],
    [[1, 2, 4, 5], [1, 2, 3, 4, 5], [[3, 2]]],
    [[1, 3, 4, 5], [1, 2, 3, 4, 5], [[2, 1]]],
    [[2, 3, 4, 5], [1, 2, 3, 4, 5], [[1, 0]]],
    [[5, 4, 3, 2], [5, 4, 3, 2, 1], [[1, 4]]],
    [[5, 3, 1], [5, 4, 3, 2, 1], [[4, 1], [2, 3]]],
  ];
  const methods = [
    insert_at_shift,
    insert_at_optimized,
  ];
  for (let tc of test_cases) {
    const [initial, expected, operations] = tc;
    for (let fnc of methods) {
      let res = initial.slice();
      for (let op of operations) {
        const [val, idx] = op;
        fnc(res, val, idx);
      }
      assert(
        lst_eq(res, expected),
        `Expected ${expected} == ${res} for initial ${initial} with fnc ${fnc.name}`,
      );
    }
  }
};

const test_bin_insert = () => {
  type Insertion = number;
  type TestCase<T> = [T[], T[], boolean, Insertion[]];
  const test_cases: TestCase<number>[] = [
    [[1], [1, 2], false, [2]],
    [[1], [2, 1], true, [2]],
    [[1, 2], [1, 2, 3], false, [3]],
    [[3, 1], [3, 2, 1], true, [2]],
    [[1, 2, 4], [1, 2, 3, 4], false, [3]],
    [[1, 2, 4, 5], [1, 2, 3, 4, 5], false, [3]],
    [[1, 3, 4, 5], [1, 2, 3, 4, 5], false, [2]],
    [[2, 3, 4, 5], [1, 2, 3, 4, 5], false, [1]],
    [[5, 4, 2], [5, 4, 3, 2, 1], true, [1, 3]],
    [[5, 3, 1], [5, 4, 3, 2, 1], true, [2, 4]],
    [[1, 2, 3, 5, 6, 7, 8, 9], [1, 2, 3, 4, 5, 6, 7, 8, 9], false, [4]],
  ];
  for (let tc of test_cases) {
    const [initial, expected, reversed, operations] = tc;
    let res = initial.slice();
    for (let val of operations) {
      bin_insert(res, val, (v) => v, reversed);
    }
    assert(
      lst_eq(res, expected),
      `Expected ${expected} == ${res} for initial ${initial}`,
    );
  }
};

const test_serialization = async () => {
  const words = await load_words();
  console.log(words.length);
  const cut = words.slice(0, 10);
  console.log(cut);
  const trie = build_trie(cut);
  const serialized = serialize_trie(trie);
  console.log(`og-serialized: ${serialized}`);
  const deserialized = deserialize_trie(serialized);
  const reserialized = serialize_trie(deserialized);
  console.log(`re-serialized: ${reserialized}`);
};

const test_deserialization = async () => {
  await save_trie();
  const trie = await load_trie();
  const word_checks = [
    "ant",
    "antelope",
    "vulture",
    "quays",
    "notaword",
    "stromboli",
    "zz",
  ];
  for (let word of word_checks) {
    console.log(`searching for ${word}: ${search(trie, word)}`);
  }
};

const test_load_nyt_puzzle = async () => {
  const {
    sides,
    words,
  } = await load_nyt_puzzle();
  console.log(`Sides (${sides.length}): [${sides}], Word Count: ${words.length}`);
}

const main = async () => {
  const colwidth = 50;
  const tests_fncs = [
    test_trie,
    test_big_insert_at,
    test_insert_at,
    test_bin_insert,
  ]
  for (let fnc of tests_fncs) {
    const name = fnc.name;
    const reps = Math.floor((colwidth - (8 + name.length)) / 2);
    const spacer = `${"=".repeat(reps)}`;
    console.log(`${spacer}Running ${name}${spacer}`);
    try {
      fnc();
      console.log(`OK: Test ${name} passed`);
    } catch (e) {
      console.log(`ERROR: Test ${name} failed: ${e}`);
    }
    console.log(`${"=".repeat(colwidth)}`);
  }
  await test_load_nyt_puzzle();
  // await test_serialization();
  // await test_deserialization();
};

main();
