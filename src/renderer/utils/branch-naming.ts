interface BranchIssue {
  number: number;
  title: string;
  labels: string[];
}

const LABEL_PREFIX_MAP: [string[], string][] = [
  [['bug'], 'fix'],
  [['hotfix'], 'hotfix'],
  [['enhancement', 'feature'], 'feat'],
  [['documentation', 'docs'], 'docs'],
  [['refactor'], 'refactor'],
  [['test', 'testing'], 'test'],
  [['chore', 'dependencies'], 'chore'],
];

function getTypePrefix(labels: string[]): string {
  const lower = labels.map((l) => l.toLowerCase());
  for (const [keywords, prefix] of LABEL_PREFIX_MAP) {
    if (keywords.some((kw) => lower.includes(kw))) {
      return prefix;
    }
  }
  return 'feat';
}

function slugify(title: string, maxWords = 4): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  if (!slug) return 'untitled';

  const words = slug.split('-').slice(0, maxWords);
  return words.join('-');
}

export function generateBranchName(issue: BranchIssue): string {
  const prefix = getTypePrefix(issue.labels);
  const slug = slugify(issue.title);
  return `${prefix}/${issue.number}-${slug}`;
}
