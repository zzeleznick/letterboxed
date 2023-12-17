import fs from "fs/promises";

import { string_cmp } from "./lib"
import { type Trie } from "./trie";
import {
    search_and_fill,
} from "./trie";

// Unix word list at /usr/share/dict/words
const unix_word_list_path = "/usr/share/dict/words"
const boggle_world_list_path = "./dict/boggle_words.txt"
const nyt_url = "https://www.nytimes.com/puzzles/letter-boxed"

const trie_path = "trie.json"

// Remove proper names and short words from the word list
export const load_words = async (unix_path = true) => {
    const word_list_path = unix_path ? unix_word_list_path : boggle_world_list_path;
    const buf = await fs.readFile(word_list_path)
    const contents: string = buf.toString('utf8');
    return contents.split("\n").filter(
        w => 96 < w.charCodeAt(0) && w.charCodeAt(0) < 123 // a is 97, z is 122
        && w.length > 2 // min of 3 letter words
    ).concat(["quays", "stromboli"])
}

export const load_nyt_puzzle = async () => {
    const response = await fetch(nyt_url);
    const text = await response.text();
    const sidesRegex = /\"sides\":\[\"(?<sides>[\"A-Z,]+)\]/;
    const dictRegex = /(?:\"dictionary\":\[)(?<words>[\"A-Z,]+)\]/;
    const sidesRaw = text.match(sidesRegex)?.groups?.sides;
    const dictRaw = text.match(dictRegex)?.groups?.words
    if (! sidesRaw || ! dictRaw) {
        throw new Error("Could not parse NYT puzzle!");
    }
    const sides = sidesRaw.replaceAll('"', '').split(",");
    const words = dictRaw.replaceAll('"', '').split(",");
    return {
        words,
        sides,
    }
}

export const save_trie = async () => {
    const words = await load_words();
    const trie = build_trie(words);
    const serialized = serialize_trie(trie);
    await fs.writeFile(trie_path, serialized);
}

export const load_trie = async () => {
    const buf = await fs.readFile(trie_path)
    const contents: string = buf.toString('utf8');
    return deserialize_trie(contents);
}

export const longest_n_words = (words: string[], limit = 10) =>
    words.toSorted(
        (a: string, b: string) => string_cmp(b, a)
    ).slice(0, limit > 0 ? limit : undefined)


export const compute_ngrams = (words: string[], n = 3) => {
    let map = new Map<string, number>();
    let ct = 0;
    for (let word of words) {
        if (word.length < n) {
            continue
        }
        const limit = word.length - (n - 1);
        for (let i = 0; i < limit ; i++) {
            const cut = word.slice(i, i+n);
            map.set(cut, 1 + (map.get(cut) ?? 0));
            ct += 1
        }
    }
    return map
}

export const build_trie = (words: string[], letterSet: Set<string> | undefined = undefined) => {
    const root: Trie = new Map();
    if (letterSet && letterSet.size > 0) {
        words = words.filter(w => {
            for (let c of w) {
                if (!letterSet.has(c)) {
                    return false
                }
            }
            return true
        })
    }
    for (let word of longest_n_words(words, -1)) {
        search_and_fill(root, word)
    }
    return root
}

export const serialize_trie = (trie: Trie, root = true) => {
    const transform = root ? JSON.stringify : (x: any) => x // Only stringify root
    let obj = {}
    if (trie.size === 0) {
        return transform(obj)
    }
    for (let [key, value] of trie.entries()) {
        obj[key] = key === "!" ? 1 : serialize_trie(value, false)
    }
    return transform(obj)
}

export const deserialize_trie = (value: string | object) => {
    let raw_trie = value;
    if (typeof value === "string") {
        raw_trie = JSON.parse(value)
    } else if (value instanceof Object) {
        // pass
    } else if (~~value === value) { // Number
        raw_trie = new Map(); // Word ending
    }
    const root: Trie = new Map();
    for (let [key, value] of Object.entries(raw_trie)) {
        root.set(key, key === "!" ? new Map() : deserialize_trie(value))
    }
    return root
}

export const bunTime = () => {
    return BigInt(Bun.nanoseconds()) + BigInt(1_000_000 * performance.timeOrigin);
}

export const withTiming = (f: () => void, iterations = 1, name: string | undefined = undefined) => {
    let elapsed_times = [];
    for (let i = 0; i < Math.max(1, iterations); i++) {
        const start = bunTime();
        f();
        elapsed_times.push(Number((bunTime() - start) / BigInt(1_000)));
    }
    if (elapsed_times.length === 1) {
        console.log(`[Function ${f} took ${elapsed_times.at(0)} ms`)
        return
    }
    const max_t = Math.max(...elapsed_times);
    const min_t = Math.min(...elapsed_times);
    const avg_t = elapsed_times.reduce((a, b) => a+b, 0) / elapsed_times.length;
    console.log(`[Function ${name ?? f.name} took avg of ${avg_t} ms, max_t: ${max_t} ms, min_t: ${min_t} ms over ${iterations} runs.`);    
}
