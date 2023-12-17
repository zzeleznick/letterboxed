import { type Trie } from "./trie";
import {
    collect_children,
    get_node,
    get_letter_set,
    search,
    search_exact,
} from "./trie";
import { build_trie, compute_ngrams, longest_n_words } from "./utils";
import { string_cmp, set_eq, bin_insert, merge_sets } from "./lib";

export type LookupSet = Map<string, Set<string>>
export type SearchNode = [string[], Letter[], number]
export type Puzzle = [Letter[], Letter[], Letter[], Letter[]];
export type WordList = [string, Letter][];

export class Letter {
    val: string;
    row: number;
    constructor(char: string, row: number) {
        this.val = char;
        this.row = row; 
    }
    static from(char: string, row: number) {
        return new Letter(char, row)
    }
}

const update_node_at_prefix = (trie: Trie, prefix: string, lookup: LookupSet) => {
    const node = get_node(trie, prefix);
    if (!node) {
        return // MARK: word may not exist
    }
    const current_letters = get_letter_set(node!)
    const children = collect_children(node!, "", prefix);
    // console.log(`current_letters: ${Array.from(current_letters.values())}, children: ${children}`);
    const child_letters_ind = children.map(m => get_letter_set(m));
    const child_letters = child_letters_ind.reduce(
        (a,b) => merge_sets(a,b), (new Set())
    )
    const joined_set = merge_sets(current_letters, child_letters)
    lookup.set(prefix, joined_set)
}


const build_trie_star = (words: string[], puzzle: Puzzle) => {
    const {trie, word_list} = build_restricted_trie(words, puzzle);
    const words_without_pos = word_list.map(v => v[0]);
    const lookup: LookupSet= new Map();
    for (let word of longest_n_words(words_without_pos, -1)) {
        update_node_at_prefix(trie, word, lookup)   
    }
    return {
        trie,
        lookup,
        word_list,
    } 
}

const get_starting_candidates = (words: string[], puzzle: Puzzle) : SearchNode[] => {
    const ngrams_one = compute_ngrams(words, 1);
    const max_val = Math.max(...Array.from(ngrams_one.values()))
    return puzzle
        .flatMap(v => v)
        .toSorted((a,b) =>
            ngrams_one.get(a.val) ?? 0 - (ngrams_one.get(b.val) ?? 0)
        )
        .map(
            ch => [[], [ch], (ngrams_one.get(ch.val) ?? 1) / max_val]
        )
    }

const get_starting_candidates_dp = (puzzle: Puzzle) : SearchNode[] => {
    return puzzle
        .flatMap(v => v)
        .toSorted((a,b) => string_cmp(a.val, b.val))
        .map(
            ch => [[], [ch], ch.val.charCodeAt(0)]
        )
    }

const get_candidates = (trie: Trie, puzzle: Puzzle, buf: string, pos: number) =>
    puzzle.filter(
        (_v, index) =>
        pos !== index
    )
    .flatMap(v => v)
    .filter(
        v => search(trie, buf + v.val)
    )


export const build_restricted_trie = (dict_words: string[], puzzle: Puzzle) => {
    const letterSet = new Set(puzzle.flatMap(v => v).map(v => v.val));
    const trie = build_trie(dict_words, letterSet);
    let word_set = new Set<string>();
    let word_list: WordList = [];
    let fringe = get_starting_candidates_dp(puzzle);
    while (fringe && fringe.length) {
        const node = fringe.shift() as SearchNode;
        const [words, buf, _score] = node;
        const last = buf.at(-1)!
        const pos = last.row
        const buf_str = buf.map(v => v.val).join("");
        for (let cd of get_candidates(trie, puzzle, buf_str, pos)) {
            const possible_word = buf_str.concat(cd.val);
            const nxt_score = cd.val.charCodeAt(0);
            const is_word = search_exact(trie, possible_word);
            if (is_word && possible_word.length > 3 && !word_set.has(possible_word)) {
                word_set.add(possible_word)
                word_list.push([possible_word, cd])
            }
            const nxt_node: SearchNode = [ words, buf.concat(cd), nxt_score ]
            // bin_insert(fringe, nxt_node, v => v[2]);
            fringe.unshift(nxt_node);
        }
    }
    console.log(`Word List Ct: ${word_list.length}`)
    return {
        trie: build_trie(Array.from(word_set.values())),
        word_list,
    }
}

const solve_naive = (dict_words: string[], puzzle_raw: string [], word_limit = 2) => {
    const puzzle = puzzle_raw.map(
        (arr, row) => arr.toLowerCase().split("").map(
            v => Letter.from(v, row)
        )
    ) as Puzzle
    let solutions = [];
    const required_letters = new Set(puzzle.flatMap(v => v));
    const required_ct = required_letters.size;
    const trie = build_trie(dict_words);
    // highest value at end
    let fringe = get_starting_candidates(dict_words, puzzle);
    while (fringe && fringe.length) {
        const node = fringe.pop() as SearchNode;
        const [words, buf, score] = node;
        const last = buf.at(-1)!
        const pos = last.row
        const buf_str = buf.map(v => v.val).join("");
        const used_letters = new Set(words.join("").concat(buf_str))
        console.log(`Naive [score: ${score}, words: ${words}, buf_str: ${buf_str}, size: ${fringe.length}`);
        for (let cd of get_candidates(trie, puzzle, buf_str, pos)) {
            const possible_word = buf_str.concat(cd.val);
            const is_word = search_exact(trie, possible_word);
            const word_letter_uniq_ct = (new Set(words[0])).size
            const first_word_bonus = words.length === 0 && is_word ? 5 * word_letter_uniq_ct : 0;
            const too_many_words_penalty = words.length >= 1 && is_word ? -100 : 0;
            const new_letter_bonus = !used_letters.has(cd.val) ? 1 : 0; 
            if (is_word) {
                const nxt_score = 1 + new_letter_bonus + first_word_bonus + too_many_words_penalty;
                const nxt_node: SearchNode = [ words.concat(possible_word), [ cd ], nxt_score ]
                if (new_letter_bonus && used_letters.size + 1 === required_ct) {
                    const sol = nxt_node[0]
                    if (words.length === 1) {
                        console.log(`Winnning with ${sol}!`);
                        solutions.unshift(sol)
                    } else {
                        console.log(`Solution with ${sol}!`);
                        solutions.push(sol)
                    }
                }
                if (words.length >= word_limit) {
                    continue
                }
                bin_insert(fringe, nxt_node, v => v[2]);
            }
            const nxt_score = score + new_letter_bonus;
            const nxt_node: SearchNode = [ words, buf.concat(cd), nxt_score ]
            bin_insert(fringe, nxt_node, v => v[2]);
        }
    }
    return solutions
}

export const solve_bounded = (dict_words: string[], puzzle_raw: string [], word_limit = 2) => {
    const puzzle = puzzle_raw.map(
        (arr, row) => arr.toLowerCase().split("").map(
            v => Letter.from(v, row)
        )
    ) as Puzzle
    let solutions = [];
    const required_letters = new Set(puzzle.flatMap(v => v).map(v => v.val));
    const required_ct = required_letters.size;
    const {trie, lookup} = build_trie_star(dict_words, puzzle);
    // const {trie, word_list} = build_restricted_trie(dict_words, puzzle);
    // best value at start
    let fringe = get_starting_candidates_dp(puzzle);
    while (fringe && fringe.length) {
        const node = fringe.shift() as SearchNode;
        const [words, buf, _score] = node;
        const last = buf.at(-1)!
        const pos = last.row
        const buf_str = buf.map(v => v.val).join("");
        const used_letters = new Set(words.join("").concat(buf_str))
        const candidates = get_candidates(trie, puzzle, buf_str, pos);
        // console.log(`OP [words: ${words}, buf_str: ${buf_str}, cds: ${JSON.stringify(candidates.map(v => v.val))}, size: ${fringe.length}]`);
        for (let cd of candidates) {
            const possible_word = buf_str.concat(cd.val);
            const is_word = search_exact(trie, possible_word);
            let best_set = null
            lookup.get(possible_word)
            if (!best_set) {
                update_node_at_prefix(trie, possible_word, lookup);
            }
            best_set = lookup.get(possible_word);
            if (best_set && words.length > 0) { // only starts with words of 3+ letters
                const best_continuation = merge_sets(used_letters, best_set)
                // console.log(`words: ${words}, possible_word: ${possible_word}, Best Set: ${Array.from(best_set.values())}, best_continuation: ${Array.from(best_continuation.values())}`)
                if (best_continuation.size != required_ct) {
                    // console.log(`Skipping possible_word ${possible_word}!`);
                    continue
                }
            }
            const nxt_size = merge_sets(used_letters, new Set(cd.val)).size
            const nxt_score = cd.val.charCodeAt(0);
            if (is_word) {
                const nxt_node: SearchNode = [ words.concat(possible_word), [ cd ], nxt_score ]
                if (nxt_size === required_ct) {
                    const sol = nxt_node[0]
                    if (words.length === 1) {
                        // console.log(`Winnning with ${sol}!`);
                        solutions.unshift(sol)
                    } else {
                        // console.log(`Solution with ${sol}!`);
                        solutions.push(sol)
                    }
                    continue
                }
                if (words.length + 1 < word_limit) {
                    // bin_insert(fringe, nxt_node, v => v[2]);
                    fringe.unshift(nxt_node);
                }
            }
            const nxt_node: SearchNode = [ words, buf.concat(cd), nxt_score ]
            // bin_insert(fringe, nxt_node, v => v[2]);
            fringe.unshift(nxt_node);
        }
    }
    return solutions
}

const solve_fixed_with_coverage = (dict_words: string[], puzzle_raw: string []) => {
    const puzzle = puzzle_raw.map(
        (arr, row) => arr.toLowerCase().split("").map(
            v => Letter.from(v, row)
        )
    ) as Puzzle
    let solutions = [];
    const required_letters = new Set(puzzle.flatMap(v => v).map(v => v.val));
    const {trie, word_list} = build_restricted_trie(dict_words, puzzle);
    const prefix_map = new Map<string, Set<string>>();
    const coverage_map = new Map<string, Set<string>>();
    for (let [word, _letter] of word_list) {
        const prefix = word.at(0);
        const set = prefix_map.get(prefix) ?? new Set();
        set.add(word);
        prefix_map.set(prefix, set);
    }
    for (let prefix of prefix_map.keys()) {
        const word_set = prefix_map.get(prefix)!;
        const spanning_set: Set<string> = Array.from(word_set.values()).reduce(
            (a,b) => merge_sets(a, new Set(b)), (new Set<string>())
        )
        coverage_map.set(prefix, spanning_set);
    }
    for (let [word, letter] of word_list) {
        const prefix = letter.val;
        const next_words = prefix_map.get(prefix);
        if (!next_words) {
            continue
        }
        const best_set = coverage_map.get(prefix) ?? new Set();
        const feasible = set_eq(merge_sets(new Set(word), best_set), required_letters)
        if (!feasible) { // skip if not feasible
            continue
        }
        for (let candidate of next_words.values()) {
            // console.log(`word: ${word}, candidate: ${candidate}`)
            const valid = set_eq(new Set(word.concat(candidate)), required_letters)
            if (valid) {
                solutions.push([word, candidate])
            }
        }
    }
    return solutions
}