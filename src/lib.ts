import assert from 'assert';

export const string_cmp = (a: string, b: string) => {
    if (a.length != b.length) {
        return a.length < b.length ? -1 : 1
    }
    for (let i = 0; i < a.length; i++) {
        const [x, y] = [a.charCodeAt(i), b.charCodeAt(i)]
        if (x != y) {
            return x < y ? -1 : 1
        }
    }
    return 0
}

export function lst_eq<T>(a: T[], b: T[]) {
    if (a.length !== b.length) {
        return false
    }
    for (let i = 0; i < a.length; i++) {
        if (a[i] !== b[i]) {
            return false
        }
    }
    return true
}

export function set_eq<T>(a: Set<T>, b: Set<T>) {
    if (a.size !== b.size) {
        return false
    }
    return lst_eq((Array.from(a.values()).toSorted()), (Array.from(b.values()).toSorted()))
}

export const merge_sets = (a: Set<any>, b: Set<any>) => new Set([...a.values(), ...b.values()])


export function insert_at_simple<T>(lst: T[], element: T, index: number) {
    assert(index <= lst.length, `index: ${index} exceeds list length of ${lst.length}`);
    return lst.slice(0, index).concat([element]).concat(lst.slice(index + 1,))
}

export function insert_at_shift<T>(lst: T[], element: T, index: number) {
    assert(index <= lst.length, `index: ${index} exceeds list length of ${lst.length}`);
    const pop_unshift = index >= Math.floor(lst.length / 2);
    const n = pop_unshift ? lst.length - index : index;
    for (let i = 0; i < n; i++) {
        pop_unshift ? lst.unshift(lst.pop()!) : lst.push(lst.shift()!)
    }
    pop_unshift ? lst.push(element) : lst.unshift(element);
    for (let j = n; j > 0; j-- ) {
        pop_unshift ? lst.push(lst.shift()!) : lst.unshift(lst.pop()!)
    }
}

export function insert_at_using_copywithin<T>(lst: T[], element: T, index: number) {
    assert(index <= lst.length, `index: ${index} exceeds list length of ${lst.length}`);
    if (index === lst.length) {
        lst.push(element)
    } else if (index === 0) {
        lst.unshift(element)
    } else {
        lst.push(lst.at(-1)!);
        lst.copyWithin(index+1, index);
        lst.fill(element, index, index+1);
    }
}

export function insert_at_optimized<T>(lst: T[], element: T, index: number) {
    assert(index <= lst.length, `index: ${index} exceeds list length of ${lst.length}`);
    if (index === lst.length || index === 0) {
        index === 0 ? lst.unshift(element) : lst.push(element);
        return
    }
    const extend_right = index > Math.floor(lst.length / 2);
    extend_right ? lst.push(element) : lst.unshift(element);
    extend_right ? lst.copyWithin(index+1, index) : lst.copyWithin(0, 1, index+1);
    lst.fill(element, index, index+1);
}

export const insert_at = insert_at_optimized

export function bin_insert<T>(lst: T[], element: T, getter = (v: T): number => v as number, highestToLowest = false) {
    // 0: Handle empty list case
    if (!lst.length) {
        lst.push(element);
        return
    }
    // NOTE: This handles cases where the list is sorted in reverse order (highestToLowest = true)
    if (highestToLowest) {
        const original_getter = getter.bind({});
        getter = (v: T) => -original_getter(v)
    }
    const val = getter(element);
    const head = getter(lst.at(0))!;
    // 1: Handle cases where there is only one element in the list (head and tail are the same)
    if (lst.length === 1) {
        val >= head ? lst.push(element) : lst.unshift(element);
        return
    }
    let hi = lst.length;
    let lo = 0;
    let mid = Math.floor((hi + lo) / 2);
    while (mid > lo) {
        const mid_val = getter(lst[mid]);
        if (val === mid_val) {
            break
        } else if (val > mid_val) {
            lo = mid;
        } else { // val < mid_val
            hi = mid;
        }
        mid = Math.floor((hi + lo) / 2);
    }
    const mid_val = getter(lst[mid]);
    if (val === mid_val) {
        insert_at(lst, element, mid)
    } else if (val > mid_val) {
        insert_at(lst, element, mid+1)
    } else { // val < mid_val
        insert_at(lst, element, mid)
    }
}
