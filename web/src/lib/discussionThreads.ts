import type { DiscussionPost } from './discussions';

export type ThreadReply = DiscussionPost & { depth: number };

export type DiscussionThread = {
  root: DiscussionPost;
  replies: ThreadReply[];
};

function replyDepth(item: DiscussionPost, byId: Map<string, DiscussionPost>): number {
  let depth = 1;
  let parentId = item.parentId;
  const seen = new Set<string>();
  while (parentId) {
    const parent = byId.get(parentId);
    if (!parent?.parentId || seen.has(parentId)) break;
    seen.add(parentId);
    depth += 1;
    parentId = parent.parentId;
  }
  return depth;
}

export function buildDiscussionThreads(items: DiscussionPost[]): DiscussionThread[] {
  const byId = new Map(items.map((i) => [i.id, i]));
  const roots = items.filter((i) => !i.parentId);
  const replies = items.filter((i) => i.parentId);

  function findRootId(item: DiscussionPost): string | null {
    if (!item.parentId) return item.id;
    let cur: DiscussionPost | undefined = item;
    const seen = new Set<string>();
    while (cur?.parentId) {
      if (seen.has(cur.id)) break;
      seen.add(cur.id);
      cur = byId.get(cur.parentId);
    }
    return cur && !cur.parentId ? cur.id : item.parentId;
  }

  const threads = new Map<string, DiscussionThread>();

  for (const root of roots) {
    threads.set(root.id, { root, replies: [] });
  }

  for (const reply of replies) {
    const rootId = findRootId(reply);
    if (!rootId) continue;
    let thread = threads.get(rootId);
    if (!thread) {
      const root = byId.get(rootId);
      if (!root) continue;
      thread = { root, replies: [] };
      threads.set(rootId, thread);
    }
    const depth = replyDepth(reply, byId);
    thread.replies.push({ ...reply, depth });
  }

  for (const t of threads.values()) {
    t.replies.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }

  return [...threads.values()].sort(
    (a, b) => new Date(b.root.createdAt).getTime() - new Date(a.root.createdAt).getTime(),
  );
}
