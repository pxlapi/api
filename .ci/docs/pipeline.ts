// @ts-ignore
import {runStep, spawnChildJob, Workspace} from "runtime/core.ts";
// @ts-ignore
import {readSecrets} from "runtime/secrets.ts";
// @ts-ignore
import * as Docker from "pkg/buildy/docker@1.0/mod.ts";

const enum DISCORD_STATUS {
    BUILT_DOCS,
    PUSHED_DOCS,
    FAILED,
    CANCELED
}

const DISCORD_COLORS = [0x80ff80, 0x80ff80, 0xff8080, 0x808080];
let docsHash = 'master';
let canceled = false;

async function discordWebhook(ws: Workspace, status: DISCORD_STATUS, actionStartTS?: number): Promise<void> {
    const [discordWebhook] = await readSecrets('DISCORD_WEBHOOK');

    const SHA_SHORT = ws.sha.slice(0, 6);

    const description = [
        actionStartTS && `Docs generation for pxlAPI [${SHA_SHORT}](https://github.com/pxlapi/pxlapi/commit/${ws.sha}) succeeded in ${((Date.now() - actionStartTS) / 1000).toFixed(1)}s`,
        actionStartTS && `Docs push for pxlAPI [${SHA_SHORT}](https://github.com/pxlapi/pxlapi/commit/${ws.sha}) succeeded in ${((Date.now() - actionStartTS) / 1000).toFixed(1)}s\n\n[View diff](https://github.com/pxlapi/docs/commit/${docsHash})`,
        `Docs generation for pxlAPI [${SHA_SHORT}](https://github.com/pxlapi/pxlapi/commit/${ws.sha}) failed`,
        `Docs push for pxlAPI [${SHA_SHORT}](https://github.com/pxlapi/pxlapi/commit/${ws.sha}) canceled`
    ][status];

    await fetch(discordWebhook, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
            username: 'buildyboi',
            avatar_url: 'https://buildyboi.ci/b76b46f9606c1a2e1c6d.png',
            embeds: [{
                title: `pxlAPI pipeline #${ws.job.pipelineId}`,
                url: `https://buildyboi.ci/repo/${ws.repository.id}/pipeline/${ws.job.pipelineId}`,
                description,
                color: DISCORD_COLORS[status]
            }]
        })
    });

    if (status === DISCORD_STATUS.PUSHED_DOCS) {
        const [announcementWebhook] = await readSecrets('DISCORD_ANNOUNCEMENTS_WEBHOOK');

        await fetch(announcementWebhook, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                embeds: [{
                    title: `pxlAPI docs`,
                    url: `https://pxlapi.dev/docs`,
                    description: `pxlAPI docs have been updated by pipeline \`${ws.job.pipelineId}\`\n\n[View diff](https://github.com/pxlapi/docs/commit/${docsHash})`,
                    color: 0x000000
                }]
            })
        });
    }
}

async function runRepoCommand(...cmd: string[]): Promise<void> {
    const proc = Deno.run({cmd});

    const {code} = await proc.status();
    if (code)
        throw new Error(String(code));
}

async function runDocCommand(...cmd: string[]): Promise<string> {
    const proc = Deno.run({cmd, cwd: '/docs/', stdout: 'piped'});

    const {code} = await proc.status();
    if (code)
        throw new Error(String(code));

    return new TextDecoder().decode(await proc.output());
}

async function buildDocs() {
    const [ghUser, ghToken] = await readSecrets('GITHUB_USERNAME', 'GITHUB_TOKEN');
    await runRepoCommand('git', 'config', 'credential.helper', 'store');
    await runRepoCommand('git', 'clone', `https://${ghUser}:${ghToken}@github.com/pxlapi/docs.git`, '../docs/');
    await runRepoCommand('npm', 'i', '-g', 'apidoc@0.25.0');
    await runRepoCommand('npm', 'run', 'docs');
}

async function pushDocs() {
    await runDocCommand('cp', 'favicon.ico', 'img/favicon.ico');
    await runDocCommand('cp', 'css/style.dark.css', 'css/style.css');

    try {
        const dataDiff = await runDocCommand('git', 'diff', 'api_data.json');
        const projectDiff = await runDocCommand('git', 'diff', 'api_project.json');

        let dirty = !!dataDiff.trim();
        if (!dirty) {
            for (const line of projectDiff.split('\n')) {
                if (
                    line.startsWith('+') &&
                    !line.startsWith('+++') &&
                    !line.replace('+', '').trim().startsWith('"time"')
                ) dirty = true;
            }
        }

        if (!dirty) {
            canceled = true;
            throw new Error('No data changes present, not pushing');
        }

        await runDocCommand('git', 'add', '-A');
        await runDocCommand('git', 'status');
        await runDocCommand('git', 'config', '--local', 'user.name', 'buildyboi[bot]');
        await runDocCommand('git', 'config', '--local', 'user.email', 'buildyboi[bot]@users.noreply.github.com');
        await runDocCommand('git', 'commit', '-m', 'Update docs');
        await runDocCommand('git', 'push');
        docsHash = await runDocCommand('git', 'rev-parse', 'HEAD');
    } catch (err) {
        console.log(err?.message ?? 'Nothing to upload.');
    }
}

export async function run(ws: Workspace) {
    let actionStartTS = Date.now();
    try {
        await runStep(buildDocs, {name: "Build Docs"});
        await discordWebhook(ws, DISCORD_STATUS.BUILT_DOCS, actionStartTS);

        actionStartTS = Date.now();
        await runStep(pushDocs, {name: "Push Docs"});
        await discordWebhook(ws, canceled ? DISCORD_STATUS.CANCELED : DISCORD_STATUS.PUSHED_DOCS, actionStartTS);
    } catch (err) {
        await discordWebhook(ws, DISCORD_STATUS.FAILED, actionStartTS);
        throw err;
    }
}
