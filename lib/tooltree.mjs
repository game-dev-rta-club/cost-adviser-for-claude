// Tool keys as a tree, the same way the report shows Calls by action: uses that share
// leading words add up (bash › chill › connection › reply). A node's id is the
// start of the key up to it, so a leaf's id is its key.
export const tokens = key => [...key.matchAll(key.startsWith('mcp ') ? /\([^)]*\)|[^\s.]+/g : /\([^)]*\)|\S+/g)]
  .map(m => ({text: m[0], id: key.slice(0, m.index + m[0].length)}));

// Does a tool key belong to a name from the tree? A group takes its children;
// "X (itself)" takes only the uses of X with nothing after it.
export const OWN = ' (itself)';
export const matchesTool = (key, name) => name.endsWith(OWN) ? key === name.slice(0, -OWN.length) : key === name || tokens(key).some(t => t.id === name);

const node = (id, depth) => ({id, depth, cost: 0, uses: 0, own: {cost: 0, uses: 0}, children: new Map()});

// rows: [{tool, cost, count}] → root node with cost and uses summed upward.
export function toolTree(rows) {
  const root = node('', 0);
  for (const r of rows) {
    let n = root;
    n.cost += r.cost; n.uses += r.count;
    for (const t of tokens(r.tool)) {
      if (!n.children.has(t.text)) n.children.set(t.text, node(t.id, n.depth + 1));
      n = n.children.get(t.text);
      n.cost += r.cost; n.uses += r.count;
    }
    n.own.cost += r.cost; n.own.uses += r.count;
  }
  return root;
}

// The biggest branches as a flat list, each with its depth: top `top` at the
// first level, then `per` children per node down to `depth` levels. Uses of a
// group's own key (bare `bash chill`) are listed as "(itself)" so the children
// add up.
export function treeLines(root, {depth = 3, top = 8, per = 5} = {}) {
  const out = [];
  const walk = (n, limit) => {
    const all = [...n.children.values()];
    if (n !== root && all.length && n.own.uses) all.push({id: `${n.id} (itself)`, depth: n.depth + 1, cost: n.own.cost, uses: n.own.uses, children: new Map()});
    const kids = all.sort((a, b) => b.cost - a.cost).slice(0, limit);
    for (const k of kids) {
      out.push({id: k.id, depth: k.depth, cost: k.cost, uses: k.uses, share: root.cost ? k.cost / root.cost : 0, groups: k.children.size});
      if (k.depth < depth) walk(k, per);
    }
  };
  walk(root, top);
  return out;
}
