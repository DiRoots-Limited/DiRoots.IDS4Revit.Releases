const PREFIX = 'docs-release:';
const VERSION = /^v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;

function matchesVersion(labels, tag) {
  const versions = labels.map(label => typeof label === 'string' ? label : label.name)
    .filter(name => typeof name === 'string' && name.startsWith(PREFIX));
  return versions.length === 1 && versions[0] === PREFIX + tag;
}

// Always loaded from the reviewed default branch. Never execute PR-authored code.
module.exports = async function handleRelease({ github, core, repository: repositoryContext,
  eventName, event, dryRun = true, expectedActor, docsBranch = 'gh-pages' }) {
  const { owner, repo } = repositoryContext || {};
  if (typeof owner !== 'string' || !owner || typeof repo !== 'string' || !repo)
    throw new Error('The current repository context is required.');
  if (typeof docsBranch !== 'string' || !docsBranch.trim())
    throw new Error('The documentation target branch must be nonempty.');
  const repositoryName = `${owner}/${repo}`;
  const results = [];
  let failed = false;
  const report = (text, blocked = false) => {
    results.push(text);
    if (blocked) { failed = true; core.warning(text); } else core.info(text);
  };
  if (eventName !== 'release' || event?.action !== 'released' ||
      event.repository?.full_name !== repositoryName || !Number.isSafeInteger(event.release?.id)) {
    report('Ignored: not a released event for the current repository.'); return { results, failed };
  }
  const { id: releaseId, tag_name: tag } = event.release;
  if (!VERSION.test(tag)) throw new Error('Unsupported release tag; expected vX.Y.Z.');
  if (!dryRun) {
    if (!expectedActor) throw new Error('Configure RELEASE_DOCS_MERGE_ACTOR before live use.');
    const { data: actor } = await github.rest.users.getAuthenticated();
    if (actor.login.toLowerCase() !== expectedActor.toLowerCase())
      throw new Error('Token owner does not match RELEASE_DOCS_MERGE_ACTOR.');
    const { data: access } = await github.rest.repos.getCollaboratorPermissionLevel({ owner, repo, username: actor.login });
    if (access.permission !== 'write' || !['write', 'maintain'].includes(access.role_name))
      throw new Error('The merge account must have a standard non-admin write/maintain role; refusing possible bypass.');
  }
  const assertStable = async () => {
    const { data } = await github.rest.repos.getRelease({ owner, repo, release_id: releaseId });
    if (data.id !== releaseId || data.tag_name !== tag || data.draft || data.prerelease || !data.published_at)
      throw new Error('The event release is no longer stable and published.');
  };
  await assertStable();
  const pulls = await github.paginate(github.rest.pulls.list,
    { owner, repo, state: 'open', base: docsBranch, per_page: 100 });
  const candidates = pulls.filter(pr => pr.labels.some(label => label.name === PREFIX + tag));
  if (!candidates.length) {
    report(`No open documentation PR has the exact label ${PREFIX + tag}. Nothing merged.`);
    return { results, failed };
  }
  // Capture the discovered SHA once. A concurrent push must never change the merge target.
  for (const candidate of candidates) {
    const number = candidate.number;
    const sha = candidate.head.sha;
    try {
      if (!matchesVersion(candidate.labels, tag)) throw new Error('Ambiguous version labels.');
      const { data: current } = await github.rest.pulls.get({ owner, repo, pull_number: number });
      if (current.merged) { report(`#${number}: already merged.`); continue; }
      if (current.state !== 'open' || current.draft || current.base.ref !== docsBranch ||
          current.head.repo?.full_name !== repositoryName || current.head.sha !== sha ||
          !matchesVersion(current.labels, tag))
        throw new Error('PR scope, version label, draft status or SHA changed.');
      const { repository } = await github.graphql(`query($owner:String!, $repo:String!, $number:Int!) {
        repository(owner:$owner, name:$repo) { pullRequest(number:$number) {
          state isDraft headRefOid baseRefName mergeStateStatus reviewDecision
          headRepository { nameWithOwner }
        } }
      }`, { owner, repo, number });
      const pr = repository?.pullRequest;
      if (!pr || pr.state !== 'OPEN' || pr.isDraft || pr.headRefOid !== sha ||
          pr.baseRefName !== docsBranch || pr.headRepository?.nameWithOwner !== repositoryName)
        throw new Error('PR changed during eligibility checks.');
      if (pr.mergeStateStatus !== 'CLEAN' || pr.reviewDecision !== 'APPROVED')
        throw new Error(`Not ready: mergeStateStatus=${pr.mergeStateStatus}, reviewDecision=${pr.reviewDecision}.`);
      await assertStable();
      if (dryRun) { report(`DRY RUN: would merge #${number} at ${sha} for ${tag}.`); continue; }
      // No retries and no bypass. The server enforces protections and the expected head SHA.
      const { data } = await github.rest.pulls.merge({ owner, repo, pull_number: number,
        sha, merge_method: 'squash' });
      if (!data.merged) throw new Error('GitHub refused the merge.');
      report(`Merged #${number} at ${data.sha} for ${tag}.`);
    } catch (error) {
      report(`#${number}: NOT MERGED. ${error.message} No automatic retry.`, true);
    }
  }
  return { results, failed };
};
