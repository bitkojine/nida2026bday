import { trackSyntaxTreeAdded, trackSyntaxTreeRemoved } from '../core/resourceTracker';

interface DeletableTree {
  delete(): void;
}

interface ParseOnlyParser<TTree extends DeletableTree> {
  parse(source: string): TTree | null;
}

export type ParsedTreeResult<T> = { parsed: false } | { parsed: true; value: T };

export function withParsedSyntaxTree<TTree extends DeletableTree, TResult>(
  parser: ParseOnlyParser<TTree>,
  source: string,
  callback: (tree: TTree) => TResult,
): ParsedTreeResult<TResult> {
  const tree = parser.parse(source);
  if (!tree) {
    return { parsed: false };
  }
  trackSyntaxTreeAdded();
  try {
    return { parsed: true, value: callback(tree) };
  } finally {
    tree.delete();
    trackSyntaxTreeRemoved();
  }
}
