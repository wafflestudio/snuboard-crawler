import { Octokit } from '@octokit/core';
import { createAppAuth } from '@octokit/auth-app';
import { readFileSync } from 'fs';

const ENV: string = process.env.NODE_ENV ?? 'dev';
let octokit: Octokit | null;

export async function createOctokit(): Promise<Octokit> {
    const auth = createAppAuth({
        appId: 103673,
        privateKey: readFileSync('crawler-issue.2021-03-06.private-key.pem').toString('utf-8'),
        installationId: 15160519,
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
    if (ENV !== 'prod') {
        return 0;
    }

    const response = await getOctokit().request('POST /repos/{owner}/{repo}/issues', {
        owner: 'wafflestudio',
        repo: 'snuboard-crawler',
        title,
        body,
    });
    return response.data.number;
}

export async function appendIssue(issueNumber: number, appendedBody: string): Promise<void> {
    if (ENV !== 'prod') {
        return;
    }

    const response = await getOctokit().request('GET /repos/{owner}/{repo}/issues/{issue_number}', {
        owner: 'wafflestudio',
        repo: 'snuboard-crawler',
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
