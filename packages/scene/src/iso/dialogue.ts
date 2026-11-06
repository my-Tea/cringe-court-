/**
 * Branching dialogue for the town.
 *
 * The first-person courtroom uses `BarkBook` — a round-robin of canned lines,
 * which is right for a judge heckling you but cannot carry a town. This is a
 * small node graph instead: a node is one utterance plus optional choices, and a
 * choice names the next node. It stays data (no functions), so it can be
 * authored in JSON, translated, and asserted on in tests.
 *
 * Deliberately not a scripting language: no conditions, no flags, no
 * visibility rules. If the town later needs quest state, that belongs in its own
 * module rather than being bolted onto the dialogue format.
 */

export interface DialogueChoice {
  /** Button label. */
  text: string;
  /** Node to jump to. `null` ends the conversation. */
  next: string | null;
}

export interface DialogueNode {
  /** Who is speaking: an NPC id from the map, or 'player'. */
  speaker: string;
  /** Display name override; defaults to the NPC's name. */
  name?: string;
  text: string;
  /** Offered after the line finishes. Empty = "press E to continue" to `next`. */
  choices?: readonly DialogueChoice[];
  /** Where a plain continue goes. `null` (default) ends. */
  next?: string | null;
  /**
   * Fired once, when the player continues past this node and the conversation
   * ends. The town uses it to hand off to the trial without putting game
   * logic inside the dialogue data.
   */
  action?: string;
}

export interface DialogueTree {
  /** Node id the conversation starts at. */
  start: string;
  nodes: Readonly<Record<string, DialogueNode>>;
}

export class DialogueError extends Error {
  constructor(message: string) {
    super(`dialogue: ${message}`);
    this.name = 'DialogueError';
  }
}

/** Validate a tree, including that every `next` resolves. */
export function validateTree(tree: DialogueTree): DialogueTree {
  if (!tree?.nodes || typeof tree.nodes !== 'object') throw new DialogueError('missing nodes');
  if (typeof tree.start !== 'string') throw new DialogueError('missing start');
  if (!tree.nodes[tree.start]) throw new DialogueError(`start node "${tree.start}" does not exist`);
  for (const [id, node] of Object.entries(tree.nodes)) {
    if (typeof node.text !== 'string' || !node.text) throw new DialogueError(`node "${id}" has no text`);
    if (typeof node.speaker !== 'string' || !node.speaker) throw new DialogueError(`node "${id}" has no speaker`);
    if (node.next != null && !tree.nodes[node.next]) throw new DialogueError(`node "${id}" points at missing node "${node.next}"`);
    if (node.choices) {
      if (!node.choices.length) throw new DialogueError(`node "${id}" has an empty choices array; omit it instead`);
      for (const [i, choice] of node.choices.entries()) {
        if (!choice.text) throw new DialogueError(`node "${id}" choice ${i} has no text`);
        if (choice.next != null && !tree.nodes[choice.next]) {
          throw new DialogueError(`node "${id}" choice ${i} points at missing node "${choice.next}"`);
        }
      }
    }
  }
  return tree;
}

export interface DialogueView {
  /** Current node id, or null when the conversation has ended. */
  nodeId: string | null;
  node: DialogueNode | null;
  /** Choices offered by the current node. */
  choices: readonly DialogueChoice[];
  /** True when the only way forward is a plain continue. */
  canContinue: boolean;
}

/**
 * One player's position in a tree. Pure: every method returns a new view and
 * never mutates the tree, so the same tree can back many conversations.
 */
export class DialogueRunner {
  readonly tree: DialogueTree;
  #nodeId: string | null;

  constructor(tree: DialogueTree, start?: string) {
    this.tree = validateTree(tree);
    this.#nodeId = start ?? tree.start;
    if (!this.tree.nodes[this.#nodeId]) throw new DialogueError(`cannot start at missing node "${this.#nodeId}"`);
  }

  view(): DialogueView {
    const node = this.#nodeId ? (this.tree.nodes[this.#nodeId] ?? null) : null;
    if (!node) return { nodeId: null, node: null, choices: [], canContinue: false };
    const choices = node.choices ?? [];
    return {
      nodeId: this.#nodeId,
      node,
      choices,
      // A node with choices needs a choice; a node without one continues.
      canContinue: choices.length === 0 && node.next != null,
    };
  }

  /**
   * Follow a plain continue.
   *
   * Returns true when the runner consumed the input — including on a terminal
   * node, where "continue" means "end the conversation". Returns false only
   * when the current node is offering choices, since those need `choose`.
   */
  advance(): boolean {
    const { node } = this.view();
    if (!node || node.choices?.length) return false;
    this.#nodeId = node.next ?? null;
    return true;
  }

  /** Pick a choice by index. Returns false for an out-of-range index. */
  choose(index: number): boolean {
    const { choices } = this.view();
    const choice = choices[index];
    if (!choice) return false;
    this.#nodeId = choice.next;
    return true;
  }

  /** End the conversation. */
  end(): void {
    this.#nodeId = null;
  }

  get done(): boolean {
    return this.#nodeId === null;
  }
}
