import { Octokit } from '@octokit/core';
import { createAppAuth } from '@octokit/auth-app';
import { readFileSync } from 'fs';
import { ENV } from './env';

let octokit: Octokit | null;
if (ENV === 'ci') throw Error('github.ts should not be imported in ci');

const appId: number = +(process.env.GITHUB_APP_ID ?? '-1');
const privateKeyPath: string = process.env.GITHUB_PRIVATE_KEY_PATH ?? '';
const installationId: number = +(process.env.GITHUB_INSTALLATION_ID ?? '-1');
const owner: string = process.env.GITHUB_REPO_OWNER ?? '';
const repo: string = process.env.GITHUB_REPO_NAME ?? '';

if (privateKeyPath === '' || owner === '' || repo === '') {
    throw Error('env is improperly configured');
}
if (appId === -1 || installationId === -1) {
    throw Error('env is improperly configured');
}

export async function createOctokit(): Promise<Octokit> {
    const auth = createAppAuth({
        appId,
        privateKey: readFileSync(privateKeyPath).toString('utf-8'),
        installationId,
    });

    const installationAuthentication = await auth({ type: 'installation' });

    octokit = new Octokit({
        auth: installationAuthentication.token,
    });
    return octokit;
}

export function getOctokit(): Octokit {
    if (octokit === null) {
        throw Error('getOctokit cannot be run before createOctokit');
    }
    return octokit;
}

export async function createIssue(title: string, body: string | undefined): Promise<number> {
    if (ENV !== 'production') {
        return 0;
    }

    const response = await getOctokit().request('POST /repos/{owner}/{repo}/issues', {
        owner,
        repo,
        title,
        body,
    });
    return response.data.number;
}

export async function appendIssue(issueNumber: number, appendedBody: string): Promise<void> {
    if (ENV !== 'production') {
        return;
    }

    const response = await getOctokit().request('GET /repos/{owner}/{repo}/issues/{issue_number}', {
        owner,
        repo,
        issue_number: issueNumber,
    });
    const newBody = `${response.data.body}\n* * *\n${appendedBody}`;
    await getOctokit().request('PATCH /repos/{owner}/{repo}/issues/{issue_number}', {
        owner: 'wafflestudio',
        repo: 'snuboard-crawler',
        issue_number: issueNumber,
        body: newBody,
    });
}
