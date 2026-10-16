const REPO = 'DiRoots-Limited/DiRoots.IDS4Revit.Releases';

// Only load reviewed configuration. Never execute code from a documentation PR.
module.exports = async function handleRelease({
  github, core, config, eventName, event, dryRun = true
}) {
  const [owner, repo] = REPO.split('/');
  const results = [];

  const report = (message, blocked = false) => {
    results.push(message);
    if (blocked) core.warning(message);
    else core.info(message);
  };

  if (
    eventName !== 'release' ||
    event?.action !== 'released' ||
    event.repository?.full_name !== REPO ||
    !Number.isSafeInteger(event.release?.id)
  ) {
    report('Ignored: not a released event for this repository');
    return results;
  }

  if (!Array.isArray(config.releases)) {
    throw new Error('Invalid release manifest');
  }

  const entries = config.releases.filter(
    entry => entry.id === event.release.id
  );

  if (!entries.length) {
    report('Ignored: this release has no explicitly enrolled documentation PRs');
    return results;
  }

  if (entries.length !== 1) {
    throw new Error('Ambiguous release enrollment');
  }

  for (const entry of entries) {
    if (
      !Number.isSafeInteger(entry.id) ||
      !/^v\d+\.\d+\.\d+$/.test(entry.tag) ||
      entry.observedPrerelease !== true ||
      !Array.isArray(entry.prs) ||
      !entry.prs.length
    ) {
      throw new Error('Invalid or unenrolled release');
    }

    const { data: release } = await github.rest.repos.getRelease({
      owner,
      repo,
      release_id: entry.id
    });

    if (
      release.tag_name !== entry.tag ||
      event.release.tag_name !== entry.tag
    ) {
      throw new Error('Release identity changed');
    }

    if (release.draft || release.prerelease || !release.published_at) {
      report(
        `${entry.tag}: not merged; release is not stable and published. No automatic retry.`,
        true
      );
      continue;
    }

    if (!config.requiredChecks?.length) {
      throw new Error('Select mandatory documentation checks before merging');
    }

    for (const target of entry.prs) {
      if (
        !Number.isSafeInteger(target.number) ||
        !/^[a-f0-9]{40}$/.test(target.sha)
      ) {
        throw new Error('Invalid PR identity');
      }

      const result = await github.graphql(`
        query($owner:String!, $repo:String!, $number:Int!) {
          repository(owner:$owner, name:$repo) {
            pullRequest(number:$number) {
              state
              isDraft
              headRefOid
              baseRefName
              mergeStateStatus
              reviewDecision
              headRepository {
                nameWithOwner
              }
              baseRef {
                branchProtectionRule {
                  requiredStatusCheckContexts
                }
              }
            }
          }
        }
      `, { owner, repo, number: target.number });

      const pr = result.repository.pullRequest;

      if (!pr) throw new Error('PR not found');

      if (pr.state === 'MERGED') {
        report(`#${target.number}: already merged`);
        continue;
      }

      if (
        pr.state !== 'OPEN' ||
        pr.isDraft ||
        pr.baseRefName !== 'gh-pages' ||
        pr.headRepository?.nameWithOwner !== REPO ||
        pr.headRefOid !== target.sha
      ) {
        throw new Error(`#${target.number}: PR identity or scope changed`);
      }

      const required =
        pr.baseRef?.branchProtectionRule?.requiredStatusCheckContexts || [];

      if (!config.requiredChecks.every(name => required.includes(name))) {
        throw new Error(
          'Configured checks must be enforced by gh-pages branch protection'
        );
      }

      if (
        pr.mergeStateStatus !== 'CLEAN' ||
        pr.reviewDecision !== 'APPROVED'
      ) {
        report(
          `#${target.number}: not merged; mergeStateStatus=${pr.mergeStateStatus}, reviewDecision=${pr.reviewDecision}. No automatic retry.`,
          true
        );
        continue;
      }

      const { data: current } = await github.rest.repos.getRelease({
        owner,
        repo,
        release_id: entry.id
      });

      if (
        current.tag_name !== entry.tag ||
        current.draft ||
        current.prerelease ||
        !current.published_at
      ) {
        throw new Error('Release is no longer stable');
      }

      if (dryRun) {
        report(`DRY RUN: would merge #${target.number} at ${target.sha}`);
        continue;
      }

      const { data } = await github.rest.pulls.merge({
        owner,
        repo,
        pull_number: target.number,
        sha: target.sha,
        merge_method: 'squash'
      });

      if (!data.merged) {
        throw new Error(`Merge refused for #${target.number}`);
      }

      report(`Merged #${target.number}: ${data.sha}`);
    }
  }

  return results;
};
