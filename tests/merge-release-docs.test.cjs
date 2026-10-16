const { test } = require('node:test');
const assert = require('node:assert/strict');
const handle = require('../.github/scripts/merge-release-docs.cjs');
const REPO = 'Example-Co/Widget.Releases';
const sha = 'a'.repeat(40);
const copy = obj => JSON.parse(JSON.stringify(obj));
function fixture(repositoryName = REPO, docsBranch = 'gh-pages') {
  const [owner, repo] = repositoryName.split('/');
  const f = { writes: [], warnings: [], reads: [], eventName: 'release', expectedActor: 'docs-service',
    repositoryContext: { owner, repo }, docsBranch,
    actor: { login: 'docs-service' }, access: { permission: 'write', role_name: 'write' },
    event: { action: 'released', repository: { full_name: repositoryName }, release: { id: 123, tag_name: 'v1.2.3' } },
    release: { id: 123, tag_name: 'v1.2.3', prerelease: false, draft: false, published_at: '2026-10-16' },
    pr: { number: 99, state: 'open', merged: false, draft: false,
      labels: [{ name: 'docs-release:v1.2.3' }], base: { ref: docsBranch }, head: { sha, repo: { full_name: repositoryName } } },
    graph: { state: 'OPEN', isDraft: false, headRefOid: sha, baseRefName: docsBranch,
      headRepository: { nameWithOwner: repositoryName }, mergeStateStatus: 'CLEAN', reviewDecision: 'APPROVED' } };
  f.github = { rest: { users: { getAuthenticated: async () => ({ data: f.actor }) },
    repos: { getRelease: async () => ({ data: copy(f.release) }),
      getCollaboratorPermissionLevel: async () => ({ data: f.access }) },
    pulls: { list: () => {}, get: async () => ({ data: copy(f.pr) }),
      merge: async args => { f.writes.push(args); return { data: { merged: true, sha } }; } } },
    paginate: async (method, args) => {
      assert.equal(args.owner, owner); assert.equal(args.repo, repo);
      assert.equal(args.base, f.docsBranch || 'gh-pages'); assert.equal(args.per_page, 100);
      return copy(f.list ?? [f.pr]);
    },
    graphql: async query => { assert.doesNotMatch(query, /branchProtectionRule/); return { repository: { pullRequest: copy(f.graph) } }; } };
  f.run = (dryRun = true) => handle({ github: f.github, core: { info() {}, warning: m => f.warnings.push(m) },
    eventName: f.eventName, event: f.event, dryRun, expectedActor: f.expectedActor,
    repository: f.repositoryContext, docsBranch: f.docsBranch });
  return f;
}
test('exact version label discovers PR and latest SHA; simulation never writes', async () => {
  const f = fixture(); const result = await f.run(); assert.equal(result.failed, false);
  assert.match(result.results[0], new RegExp(`DRY RUN: would merge #99 at ${sha}`)); assert.equal(f.writes.length, 0);
});
test('live merge uses exact discovered SHA, squash, repository and PR', async () => {
  const f = fixture(); await f.run(false); assert.deepEqual(f.writes, [{ owner: 'Example-Co',
    repo: 'Widget.Releases', pull_number: 99, sha, merge_method: 'squash' }]);
});
test('no mandatory CI names are imposed when current protections have none', async () => {
  const f = fixture(); await f.run(false); assert.equal(f.writes.length, 1);
});
for (const [name, mutate] of [
  ['no label', f => f.pr.labels = []], ['other version', f => f.pr.labels[0].name = 'docs-release:v1.2.30'],
  ['generic docs label', f => f.pr.labels[0].name = 'documentation']
]) test(`${name}: no candidate`, async () => {
  const f = fixture(); mutate(f); const result = await f.run(false);
  assert.match(result.results[0], /No open documentation PR/); assert.equal(f.writes.length, 0);
});
for (const [name, mutate] of [
  ['ambiguous versions', f => f.pr.labels.push({ name: 'docs-release:v2.0.0' })],
  ['draft', f => f.pr.draft = true], ['wrong base', f => f.pr.base.ref = 'master'],
  ['fork', f => f.pr.head.repo.full_name = 'other/repo'], ['closed', f => f.pr.state = 'closed'],
  ['unknown mergeability', f => f.graph.mergeStateStatus = 'UNKNOWN'],
  ['red or pending protection', f => f.graph.mergeStateStatus = 'BLOCKED'],
  ['conflict', f => f.graph.mergeStateStatus = 'DIRTY'],
  ['missing approval', f => f.graph.reviewDecision = 'REVIEW_REQUIRED'],
  ['changes requested', f => f.graph.reviewDecision = 'CHANGES_REQUESTED'],
  ['concurrent push during GraphQL', f => f.graph.headRefOid = 'b'.repeat(40)]
]) test(`${name}: reported, no merge or automatic retry`, async () => {
  const f = fixture(); mutate(f); const result = await f.run(false);
  assert.equal(result.failed, true); assert.equal(f.writes.length, 0); assert.match(f.warnings[0], /No automatic retry/);
});
test('push between discovery and REST refresh is refused', async () => {
  const f = fixture(); f.list = [copy(f.pr)]; f.pr.head.sha = 'b'.repeat(40);
  assert.equal((await f.run(false)).failed, true); assert.equal(f.writes.length, 0);
});
test('label removed or retargeted during run is refused', async () => {
  const f = fixture(); f.list = [copy(f.pr)]; f.pr.labels = [{ name: 'docs-release:v1.2.4' }];
  assert.equal((await f.run(false)).failed, true); assert.equal(f.writes.length, 0);
});
test('server SHA/protection rejection is attempted once and reported', async () => {
  const f = fixture(); let calls = 0;
  f.github.rest.pulls.merge = async () => { calls++; throw new Error('409 SHA changed / 405 protection refused'); };
  const result = await f.run(false); assert.equal(calls, 1); assert.equal(result.failed, true); assert.match(result.results[0], /409/);
});
test('server response merged=false is not reported as success', async () => {
  const f = fixture(); f.github.rest.pulls.merge = async () => ({ data: { merged: false } });
  assert.equal((await f.run(false)).failed, true);
});
test('already merged during run: idempotent no-op', async () => {
  const f = fixture(); f.pr.merged = true;
  assert.match((await f.run(false)).results[0], /already merged/); assert.equal(f.writes.length, 0);
});
test('repeat event after merge sees no open candidate', async () => {
  const f = fixture(); await f.run(false); f.list = [];
  await f.run(false); assert.equal(f.writes.length, 1);
});
test('pagination results can contain many unrelated PRs: only exact label selected', async () => {
  const f = fixture(); f.list = [...Array.from({ length: 100 }, (_, i) => ({ ...copy(f.pr), number: i + 1000, labels: [] })), copy(f.pr)];
  await f.run(false); assert.equal(f.writes.length, 1); assert.equal(f.writes[0].pull_number, 99);
});
for (const action of ['edited', 'published', 'prereleased']) test(`${action}: no API calls`, async () => {
  const f = fixture(); f.event.action = action;
  f.github.rest.repos.getRelease = () => { throw new Error('unexpected call'); };
  assert.match((await f.run(false)).results[0], /Ignored/);
});
test('release no longer stable or tag changed: fails before discovery', async () => {
  for (const change of [{ prerelease: true }, { draft: true }, { tag_name: 'v2.0.0' }]) {
    const f = fixture(); Object.assign(f.release, change); await assert.rejects(f.run(false)); assert.equal(f.writes.length, 0);
  }
});
test('release reverted immediately before merge: blocked', async () => {
  const f = fixture(); let calls = 0;
  f.github.rest.repos.getRelease = async () => ({ data: { ...f.release, prerelease: ++calls > 1 } });
  assert.equal((await f.run(false)).failed, true); assert.equal(f.writes.length, 0);
});
test('workflow has only release event, trusted default branch, no manifest, no approval or retry', () => {
  const fs = require('node:fs'); const path = require('node:path');
  const workflow = fs.readFileSync(path.join(__dirname, '../.github/workflows/merge-release-docs.yml'), 'utf8');
  assert.match(workflow, /types: \[released\]/);
  assert.match(workflow, /ref: \$\{\{ github.event.repository.default_branch \}\}/);
  assert.match(workflow, /repository: context.repo/); assert.match(workflow, /retries: 0/);
  assert.doesNotMatch(workflow, /schedule:|workflow_dispatch:|test_docs_trigger|docs-releases.json|createReview/);
});
for (const [name, mutate] of [
  ['unexpected token owner', f => f.actor.login = 'other-account'],
  ['missing expected actor', f => f.expectedActor = ''],
  ['admin account', f => f.access = { permission: 'admin', role_name: 'admin' }],
  ['read-only account', f => f.access = { permission: 'read', role_name: 'read' }],
  ['custom role', f => f.access = { permission: 'write', role_name: 'custom-bypass' }]
]) test(`${name}: live mode fails before any merge`, async () => {
  const f = fixture(); mutate(f); await assert.rejects(f.run(false)); assert.equal(f.writes.length, 0);
});
test('simulation does not require PAT identity or collaborator permission endpoint', async () => {
  const f = fixture(); f.github.rest.users.getAuthenticated = () => { throw new Error('unexpected identity call'); };
  assert.equal((await f.run()).failed, false);
});

for (const repositoryName of ['Example-Co/Widget.Releases', 'Another-Team/Documentation'])
  test(`reusable for ${repositoryName} without source edits`, async () => {
    const f = fixture(repositoryName); await f.run(false);
    assert.equal(f.writes.length, 1);
    assert.equal(`${f.writes[0].owner}/${f.writes[0].repo}`, repositoryName);
  });
test('configured documentation branch is used for discovery and both eligibility reads', async () => {
  const f = fixture('Another-Team/Documentation', 'docs/published'); await f.run(false);
  assert.equal(f.writes.length, 1);
  f.graph.baseRefName = 'gh-pages';
  assert.equal((await f.run(false)).failed, true); assert.equal(f.writes.length, 1);
});
test('omitting documentation branch keeps gh-pages default', async () => {
  const f = fixture(); f.docsBranch = undefined; await f.run(false); assert.equal(f.writes.length, 1);
});
test('event from another repository is ignored before API access', async () => {
  const f = fixture(); f.event.repository.full_name = 'Another-Team/Documentation';
  f.github.rest.repos.getRelease = () => { throw new Error('unexpected call'); };
  assert.match((await f.run(false)).results[0], /Ignored/); assert.equal(f.writes.length, 0);
});
test('missing repository context or empty documentation branch fails closed', async () => {
  const f = fixture(); f.repositoryContext = undefined; await assert.rejects(f.run(false));
  const other = fixture(); other.docsBranch = ''; await assert.rejects(other.run(false));
});
test('production source contains no pilot product names or deprecated variable names', () => {
  const fs = require('node:fs'); const path = require('node:path');
  for (const file of ['scripts/merge-release-docs.cjs', 'workflows/merge-release-docs.yml']) {
    const source = fs.readFileSync(path.join(__dirname, '../.github', file), 'utf8');
    assert.doesNotMatch(source, /IDS|ids|DiRoots-Limited|test_docs_trigger|ref: master/);
  }
});
