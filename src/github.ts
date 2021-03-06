import { Octokit } from '@octokit/core';
import { createAppAuth } from '@octokit/auth-app';
import { readFileSync } from 'fs';
import * as Apify from 'apify';

Apify.main(async () => {
    const auth = createAppAuth({
        appId: 103673,
        privateKey: readFileSync('crawler-issue.2021-03-06.private-key.pem').toString('utf-8'),
        installationId: 15160519,
    });

    const installationAuthentication = await auth({ type: 'installation' });

    const octokit = new Octokit({
        auth: installationAuthentication.token,
    });

    const { data } = await octokit.request('GET /repos/{owner}/{repo}/issues', {
        owner: 'wafflestudio',
        repo: 'snuboard-crawler',
    });

    console.log(data);

    const response = await octokit.request('POST /repos/{owner}/{repo}/issues', {
        owner: 'wafflestudio',
        repo: 'snuboard-crawler',
        title: 'Test Issue from bot',
        body: 'Test body from bot',
    });

    console.log(response.data);
});
