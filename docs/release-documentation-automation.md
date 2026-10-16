# Merge documentation after a stable release

This workflow is reusable without changing repository names in its source. It reads the current
repository from GitHub's context and loads the operational script from the repository's default
branch. No PR code is checked out or executed.

## Configuration

Repository Actions variables:

- `RELEASE_DOCS_ENABLED=true`: enable the release job. Unset means disabled.
- `RELEASE_DOCS_LIVE=true`: allow merges. Unset means read-only simulation.
- `RELEASE_DOCS_MERGE_ACTOR`: GitHub login owning the PAT, required in live mode.
- `RELEASE_DOCS_BRANCH`: documentation target branch, default `gh-pages`.

The secret is `MERGE_PR_AFTER_RELEASE`. An organization secret must explicitly allow this
repository; a secret limited to private repositories does not cover public release repositories.
A repository secret of the same name also works. Never commit the token or print its value.

Use an authorized PAT owned by a standard non-admin write/maintain account, without any protection
bypass. The script verifies the account login and effective role before a live merge. Admin and
custom roles are refused because their bypass behavior cannot be established by these checks.
A fine-grained PAT needs Contents write, Pull requests write and implicit Metadata read for this
repository, plus organization approval/SSO if required. An existing classic PAT may grant broader
access; review its intended use, expiration and rotation with its owner. Storing it as an
organization secret does not reduce its permissions. No GitHub App is required.

Keep the human approval requirement enabled on the documentation branch. Squash merging must be
allowed. No new CI checks are imposed by the workflow; it respects the repository's existing checks.
The account must not appear on bypass lists; confirm this in repository/organization settings.

## Label the intended documentation PRs

Add exactly one version label, `docs-release:vX.Y.Z`, to each documentation PR intended for that
release. For example, release `v1.1.0` selects only PRs carrying `docs-release:v1.1.0` into the
configured documentation branch. Several PRs can share this label when all belong to the version.
Multiple `docs-release:` labels on one PR are ambiguous and block it. Generic documentation labels,
titles and branch names do not select PRs. No release ID, PR number or head SHA needs copying.

## One event, one attempt

Only `release: released` triggers the workflow. It re-reads the exact release ID/tag and requires
a stable published release. It discovers matching open PRs with pagination and captures their SHAs.
Each PR must still be open, not draft, in the same repository, targeting the configured branch,
with the same label and SHA, and GitHub must report `APPROVED` and `CLEAN`. No approval is created.
Before merging, the release is read again. The merge request supplies the expected SHA and squash
method; GitHub enforces protections. A concurrent push or server refusal is reported, never forced.

Failures appear in annotations and the run summary. A targeted PR that cannot merge makes the run
fail; other explicitly selected PRs are evaluated separately. No candidates means nothing merges.
Already merged PRs are ignored. Multiple merges are not atomic and earlier successes are not undone.

There is no cron, polling, check-event trigger or manual-dispatch trigger. Checks becoming green
later cause no automatic retry. A human can explicitly rerun the release job after resolving a block.

## Migration from the IDS pilot

The previous `IDS_DOCS_PILOT_ENABLED`/`IDS_DOCS_ENABLED` variables become `RELEASE_DOCS_ENABLED`;
`IDS_DOCS_PILOT_LIVE`/`IDS_DOCS_LIVE` become `RELEASE_DOCS_LIVE`; `IDS_DOCS_MERGE_ACTOR` becomes
`RELEASE_DOCS_MERGE_ACTOR`. None of the old variables activates this workflow. The old release
manifest and App configuration are unused. `MERGE_PR_AFTER_RELEASE` is unchanged.

Leave the new variables unset during review. After installation on the default branch, use enabled
with live unset for simulation. Confirm token ownership, repository access, protections and labeling
before setting live to true. Setting enabled to false stops future jobs, not an in-flight merge.

## Local tests, run only on demand

The release workflow runs no test suite and installs no test dependencies. Operational eligibility
checks remain in `.github/scripts/merge-release-docs.cjs`; they are not optional unit tests.
Simulation reads actual GitHub data without writing and is separate from the mocked local tests.

From the repository root, with Node.js 20 or later:

```sh
node --test tests/merge-release-docs.test.cjs
```

There is no automatic test workflow. Tests cover exact/ambiguous/changed labels, multiple repositories,
configurable branches, pagination, identity/roles, approval/protection failures, SHA races, API refusal,
idempotence and the lack of retries or product-specific production constants.

## Test the candidate before merging this installation PR

The production YAML deliberately checks out the default branch. Merely targeting a release at the
PR branch would run its YAML but load the default-branch script, which is absent before installation.
That would not test the candidate script.

For a deliberate live test in this existing repository, a human can:

1. Note the full SHA of the candidate PR commit to test. Create a separate temporary trusted branch
   from it. In that temporary branch only, replace the checkout `ref` expression with that exact SHA
   and commit the YAML change. Do not include this test reference in the production PR.
2. Confirm secret access, the PAT owner's `RELEASE_DOCS_MERGE_ACTOR`, non-admin permissions and no
   bypass. Set enabled=true. Leave live unset for simulation or set live=true only to authorize an
   actual documentation merge. These are repository variables, so consider any existing workflow
   using them before changing them.
3. Prepare a separate minor documentation PR into the documentation branch, give it the exact test
   version label and obtain the required human approval/checks. Never use this installation PR as
   the documentation merge target.
4. Create a pre-release for a distinct test tag targeting the temporary branch, then promote it
   manually to stable without selecting it as latest. This creates public release metadata even
   without changing latest; only the release owner should perform this step. Do not toggle or
   retag an existing customer release. No release/tag is created by this PR or by its authoring agent.
5. Verify the run checks out the pinned candidate SHA. Simulation should say `DRY RUN`; live mode
   must show the actual merge commit. Then separately verify the Pages build/deployment for that
   commit and the site. Remove the temporary workflow branch/reference after review of the result;
   management of test release metadata remains a human release-owner action.

This tests the candidate operational script and release trigger using a temporary checkout override,
not the production default-branch checkout. That final checkout path is exercised after installation.
The historical pilot already validated a promotion-triggered simulation in this repository:
https://github.com/DiRoots-Limited/DiRoots.IDS4Revit.Releases/actions/runs/38904344271/attempts/2 .
It did not validate this generic version's live merge or Pages deployment. The PAT owner and the
organization secret's repository visibility have not yet been verified; these block activation,
not review of the code.

## Limits and deployment verification

`released` includes direct stable publications as well as promotions. Matching labeled PRs are
eligible in either case; the payload alone does not prove a prior pre-release or a human actor.
The workflow must exist in the commit associated with a future release; do not move existing tags.
`CLEAN` follows GitHub's treatment of required checks, including acceptable neutral/skipped checks;
it does not require optional checks to pass. Approval freshness follows existing repository settings.
Labels/release reads and merging are not one transaction; GitHub atomically rechecks the head SHA
and its protections, but release/label changes after their last read remain possible.

A PAT merge can trigger Pages; commits made with the automatic `GITHUB_TOKEN` do not trigger a
Pages build. A successful merge is not proof of successful publication: inspect the deployment and
site separately. This workflow neither publishes product releases nor modifies tags/assets/latest.

References: [release events](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#release),
[merge API](https://docs.github.com/en/rest/pulls/pulls#merge-a-pull-request),
[organization secrets](https://docs.github.com/en/actions/how-tos/write-workflows/choose-what-workflows-do/use-secrets),
[Pages builds](https://docs.github.com/en/pages/getting-started-with-github-pages/creating-a-github-pages-site).
