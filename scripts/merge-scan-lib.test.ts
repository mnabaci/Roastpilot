import { describe, expect, it } from 'vitest';
import {
  addedMembers,
  decisionFiles,
  interfaceMembers,
  overSize,
  parseNameStatus,
  removedDeclarations,
  parseNumstat,
  staleReferences,
} from './merge-scan-lib.ts';

describe('parseNameStatus', () => {
  it('reads changes, renames with their old path, and deletes', () => {
    const out = [
      'M\tdocs/spec/ui.md',
      'R087\tsrc/main/profiles/soaks.ts\tsrc/main/profiles/own-soaks.ts',
      'D\tsrc/old.ts',
      'A\tsrc/new.ts',
    ].join('\n');
    expect(parseNameStatus(out)).toEqual([
      { status: 'M', path: 'docs/spec/ui.md' },
      { status: 'R', path: 'src/main/profiles/own-soaks.ts', from: 'src/main/profiles/soaks.ts' },
      { status: 'D', path: 'src/old.ts' },
      { status: 'A', path: 'src/new.ts' },
    ]);
  });

  it('ignores blank lines', () => {
    expect(parseNameStatus('\n\n')).toEqual([]);
  });
});

describe('parseNumstat', () => {
  it('reads added and removed lines per path, binary files as 0', () => {
    expect(parseNumstat('12\t3\ta.ts\n-\t-\timg.png\n')).toEqual(
      new Map([
        ['a.ts', { added: 12, removed: 3 }],
        ['img.png', { added: 0, removed: 0 }],
      ]),
    );
  });
});

describe('decisionFiles', () => {
  it('keeps specs, ADRs, AGENTS files, skills and the brand book', () => {
    const paths = [
      'docs/spec/ui.md',
      'docs/adr/0021-x.md',
      'AGENTS.md',
      'packages/ui/AGENTS.md',
      '.claude/skills/merge/SKILL.md',
      'docs/design-system/README.md',
      'docs/design-system/components/Menu/README.md',
      'src/a.ts',
    ];
    expect(decisionFiles(paths)).toEqual(paths.slice(0, 6));
  });
});

describe('staleReferences', () => {
  const moved = [
    { status: 'R' as const, path: 'src/profiles/own-soaks.ts', from: 'src/profiles/soaks.ts' },
    { status: 'D' as const, path: 'src/history/roast-file-dialogs.ts' },
  ];

  it('finds incoming lines that still import or name what this branch moved or deleted', () => {
    const incoming = new Map([
      ['src/profiles/service.test.ts', ["import { setOwnSoaks } from './soaks';"]],
      ['src/main/index.ts', ["import { pick } from './history/roast-file-dialogs';"]],
      ['src/clean.ts', ["import { x } from './own-soaks';"]],
    ]);
    expect(staleReferences(moved, incoming)).toEqual([
      {
        file: 'src/profiles/service.test.ts',
        gone: 'src/profiles/soaks.ts',
        now: 'src/profiles/own-soaks.ts',
        line: "import { setOwnSoaks } from './soaks';",
      },
      {
        file: 'src/main/index.ts',
        gone: 'src/history/roast-file-dialogs.ts',
        now: undefined,
        line: "import { pick } from './history/roast-file-dialogs';",
      },
    ]);
  });

  it('flags an incoming change to the moved file itself', () => {
    const incoming = new Map([['src/profiles/soaks.ts', ['export const a = 1;']]]);
    expect(staleReferences(moved, incoming)).toEqual([
      {
        file: 'src/profiles/soaks.ts',
        gone: 'src/profiles/soaks.ts',
        now: 'src/profiles/own-soaks.ts',
        line: '(changed on the other side)',
      },
    ]);
  });
});

describe('interfaceMembers', () => {
  it('lists each interface with its member names', () => {
    const source = `
export interface ProfileServiceDeps {
  store: ProfileRepository;
  /** A comment: not a member. */
  chosenId: () => ProfileId;
  readonly logger: Logger;
  onDeleted?: () => void;
}

interface Other {
  a: number;
}
`;
    expect(interfaceMembers(source)).toEqual(
      new Map([
        ['ProfileServiceDeps', ['store', 'chosenId', 'logger', 'onDeleted']],
        ['Other', ['a']],
      ]),
    );
  });
});

describe('addedMembers', () => {
  it('says which required members an interface gained; optional ones need no caller change', () => {
    const before = 'interface Deps {\n  store: S;\n}\n';
    const after = 'interface Deps {\n  store: S;\n  roaster: R;\n  onDeleted?: () => void;\n}\n';
    expect(addedMembers(before, after)).toEqual([{ name: 'Deps', members: ['roaster'] }]);
  });

  it('counts a new interface as nothing to pass yet', () => {
    expect(addedMembers('', 'interface New {\n  a: number;\n}\n')).toEqual([]);
  });
});

describe('overSize', () => {
  it('flags code (not tests) that would pass the limit after both sides', () => {
    const lines = new Map([
      ['src/profile-service.ts', 204],
      ['src/profile-service.test.ts', 400],
      ['src/small.ts', 90],
    ]);
    const incoming = new Map([
      ['src/profile-service.ts', { added: 20, removed: 2 }],
      ['src/profile-service.test.ts', { added: 50, removed: 0 }],
      ['src/small.ts', { added: 5, removed: 0 }],
    ]);
    expect(overSize(lines, incoming, 200)).toEqual([
      { file: 'src/profile-service.ts', lines: 222, before: 204 },
    ]);
  });
});

describe('removedDeclarations', () => {
  it('finds names this side took out of a file that the other side still uses, and where they went', () => {
    const ourRemoved = new Map([
      [
        'src/profile-service.ts',
        [
          '  async setOwnSoaks(soakS: number): Promise<Result<number, ProfileError>> {',
          '  // a comment(that) {',
        ],
      ],
      ['src/a.test.ts', ["  it('names a copy', async () => {"]],
      [
        'src/helpers.ts',
        ['export function oldHelper(a: number): number {', 'export const OLD_NAME = 3;'],
      ],
    ]);
    const ourAdded = new Map([
      ['src/own-soaks.ts', ['export async function setOwnSoaks(']],
      ['src/helpers.ts', ['export function oldHelper(a: number, b = 1): number {']],
    ]);
    const incoming = new Map([
      [
        'src/profile-service.test.ts',
        ['    expect(await service.setOwnSoaks(90)).toEqual(ok(2));'],
      ],
      ['src/other.ts', ['const x = OLD_NAME + oldHelper(1);']],
      ['docs/spec/ui.md', ['OLD_NAME in prose is not code']],
    ]);
    expect(removedDeclarations(ourRemoved, ourAdded, incoming)).toEqual([
      {
        file: 'src/profile-service.test.ts',
        name: 'setOwnSoaks',
        from: 'src/profile-service.ts',
        now: 'src/own-soaks.ts',
        line: 'expect(await service.setOwnSoaks(90)).toEqual(ok(2));',
      },
      {
        file: 'src/other.ts',
        name: 'OLD_NAME',
        from: 'src/helpers.ts',
        now: undefined,
        line: 'const x = OLD_NAME + oldHelper(1);',
      },
    ]);
  });
});
