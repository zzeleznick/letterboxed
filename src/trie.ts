export type Trie = Map<string, Trie>

export const search_and_fill = (m: Trie, word: string, fill = true, exact_match = false) => {
    let root = m;
    for (let ch of word) {
        const node = root.get(ch)
        if (!node) {
            if (!fill) return false
            root.set(ch, new Map())
        }
        root = root.get(ch)!
    }
    if (fill) {
        root.set("!", new Map()) // Mark valid ending
    }
    return exact_match ? root.get("!")?.size === 0 : true
}

export const get_node = (m: Trie, word: string) => {
    let root = m;
    let label = "";
    for (let ch of word) {
        const node = root.get(ch)
        if (!node) {
            return
        }
        root = node
        label = label.concat(ch)
        !root.hasOwnProperty("_label") ? (root as any)["_label"] = label : null   
    }
    return root
}

export const get_letter_set = (t: Trie) => {
    const prefix = (t as any)?.["_label"] ?? ""
    return new Set(prefix)
}

export const collect_children = (root: Trie, prefix: string, ancestor = "") => {
    let node = get_node(root, prefix);
    let children: Trie[] = [];
    if (!node) {
        console.error(`Bad prefix '${prefix}' for root ${root}`)
    }
    // console.log(`collect_children for node: ${(node as any)?.["_label"] ?? ""}, prefix: ${prefix}, ancestor: ${ancestor}`)
    for (let [ch, child] of Array.from(node!.entries())) {
        if (ch === "!") {
            continue
        }
        children.push(child);
        children.push(...collect_children(child, "", ancestor.concat(ch)))
    }
    return children
}

export const search = (m: Trie, word: string) => search_and_fill(m, word, false, false) 
export const search_exact = (m: Trie, word: string) => search_and_fill(m, word, false, true);
