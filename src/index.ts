import * as core from '@actions/core';
import * as github from '@actions/github';
import { analyzeOne } from './analyze.js';
import { diffSnapshots, highestSeverity } from './diff.js';
import { readSitesFile } from './sites.js';
import { readState, writeState } from './state.js';
import { COMMENT_MARKER, renderComment } from './comment.js';
import { maxSeverity, meetsThreshold, type Severity, type SiteResult, type TrackedSnapshot } from './types.js';

async function run() {
  const sitesPath = core.getInput('sites') || 'sites.txt';
  const threshold = (core.getInput('severity') || 'warning') as Severity;
  const apiBase = core.getInput('api-base') || 'https://netrecon.pages.dev';
  const statePath = core.getInput('state-path') || '.netrecon/state.json';
  const commitState = (core.getInput('commit-state') || 'true') === 'true';
  const commentOnPr = (core.getInput('comment-on-pr') || 'true') === 'true';
  const token = core.getInput('github-token');

  const sites = readSitesFile(sitesPath);
  if (sites.length === 0) {
    core.warning(`No sites to check in ${sitesPath}. Exiting.`);
    return;
  }
  core.info(`netrecon: checking ${sites.length} site(s) via ${apiBase}`);

  const prev = readState(statePath);
  const results: SiteResult[] = [];
  const nextSnapshots: Record<string, TrackedSnapshot> = {};
  let overall: Severity = 'none';

  for (const input of sites) {
    try {
      const snapshot = await analyzeOne({ apiBase, input });
      nextSnapshots[input] = snapshot;
      const before = prev?.sites?.[input];
      if (!before) {
        results.push({ input, ok: true, snapshot, changes: [], highestSeverity: 'none', firstRun: true });
        continue;
      }
      const changes = diffSnapshots(before, snapshot);
      const sev = highestSeverity(changes);
      overall = maxSeverity(overall, sev);
      results.push({ input, ok: true, snapshot, changes, highestSeverity: sev, firstRun: false });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      core.warning(`netrecon: ${input} failed — ${msg}`);
      results.push({ input, ok: false, error: msg, changes: [], highestSeverity: 'warning', firstRun: false });
      overall = maxSeverity(overall, 'warning');
    }
  }

  writeState(statePath, nextSnapshots);
  core.info(`state written to ${statePath}`);

  const anyChanged = results.some((r) => r.changes.length > 0);
  core.setOutput('changed', anyChanged ? 'true' : 'false');
  core.setOutput('highest-severity', overall);
  core.setOutput('report', JSON.stringify(results));

  if (commentOnPr && token) {
    await upsertPrComment(token, renderComment(results, apiBase)).catch((e) => {
      core.warning(`could not post PR comment: ${e instanceof Error ? e.message : String(e)}`);
    });
  }

  if (commitState && token) {
    await commitStateFile(token, statePath).catch((e) => {
      core.warning(`could not commit state file: ${e instanceof Error ? e.message : String(e)}`);
    });
  }

  core.info(`netrecon: highest severity = ${overall}`);
  if (meetsThreshold(overall, threshold)) {
    core.setFailed(`netrecon: severity ${overall} meets or exceeds threshold ${threshold}`);
  }
}

async function upsertPrComment(token: string, body: string): Promise<void> {
  const ctx = github.context;
  const prNumber = ctx.payload.pull_request?.number ?? ctx.payload.issue?.number;
  if (!prNumber) {
    core.info('no pull request in context; skipping PR comment.');
    return;
  }
  const octokit = github.getOctokit(token);
  const { owner, repo } = ctx.repo;

  const existing = await octokit.paginate(octokit.rest.issues.listComments, {
    owner,
    repo,
    issue_number: prNumber,
    per_page: 100,
  });
  const marker = existing.find((c) => (c.body ?? '').includes(COMMENT_MARKER));
  if (marker) {
    await octokit.rest.issues.updateComment({ owner, repo, comment_id: marker.id, body });
    core.info(`updated PR comment #${marker.id}`);
  } else {
    const created = await octokit.rest.issues.createComment({ owner, repo, issue_number: prNumber, body });
    core.info(`created PR comment #${created.data.id}`);
  }
}

async function commitStateFile(token: string, statePath: string): Promise<void> {
  const ctx = github.context;
  if (ctx.payload.pull_request) {
    core.info('pull request context; skipping state commit (use push/schedule to maintain state).');
    return;
  }
  const fs = await import('node:fs');
  if (!fs.existsSync(statePath)) return;

  const octokit = github.getOctokit(token);
  const { owner, repo } = ctx.repo;
  const branch = ctx.ref.replace(/^refs\/heads\//, '');
  const content = fs.readFileSync(statePath);

  let sha: string | undefined;
  let existingContent: Buffer | undefined;
  try {
    const existing = await octokit.rest.repos.getContent({ owner, repo, path: statePath, ref: branch });
    if (!Array.isArray(existing.data) && 'sha' in existing.data && 'content' in existing.data) {
      sha = existing.data.sha;
      existingContent = Buffer.from(existing.data.content, 'base64');
    }
  } catch (err) {
    const status = (err as { status?: number }).status;
    if (status !== 404) throw err;
  }

  if (existingContent && existingContent.equals(content)) {
    core.info('state unchanged; skipping commit.');
    return;
  }

  await octokit.rest.repos.createOrUpdateFileContents({
    owner,
    repo,
    path: statePath,
    branch,
    message: 'chore(netrecon): update state [skip ci]',
    content: content.toString('base64'),
    sha,
    committer: { name: 'netrecon-action', email: 'netrecon-action@users.noreply.github.com' },
    author: { name: 'netrecon-action', email: 'netrecon-action@users.noreply.github.com' },
  });
  core.info('state committed.');
}

run().catch((err) => {
  const msg = err instanceof Error ? (err.stack ?? err.message) : String(err);
  core.setFailed(msg);
});
