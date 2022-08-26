// @ts-ignore
import {runStep, spawnChildJob, Workspace} from "runtime/core.ts";
// @ts-ignore
import {readSecrets} from "runtime/secrets.ts";
// @ts-ignore
import * as Docker from "pkg/buildy/docker@1.0/mod.ts";

const RUN_FOR_BRANCHES: string[] = ['master'];

const enum DISCORD_STATUS {
    RUNNING,
    BUILT,
    PUSHED,
    FAILED,
    FINISHED
}

const DISCORD_COLORS = [0x8080ff, 0x80ffff, 0x80ffff, 0xff8080, 0x80ff80];

async function buildImage(ws: Workspace) {
    await Docker.buildImage({
        tag: `pxlapi/pxlapi:${ws.sha}`,
    });
}

async function pushImage(ws: Workspace) {
    const [dockerHubUser, dockerHubToken] = await readSecrets(
        'DOCKER_HUB_USER',
        'DOCKER_HUB_TOKEN'
    );

    await Docker.pushImage(`pxlapi/pxlapi:${ws.sha}`, 'matmen', {
        tag: "pxlapi:latest",
        username: dockerHubUser,
        password: dockerHubToken,
    });
}

async function logWorkspace(ws: Workspace) {
    console.log(ws);
}

async function discordWebhook(ws: Workspace, status: DISCORD_STATUS, pipelineStartTS: number, actionStartTS?: number): Promise<void> {
    const [discordWebhook] = await readSecrets('DISCORD_WEBHOOK');

    const SHA_SHORT = ws.sha.slice(0, 6);

    const description = [
        `Running pipeline for pxlAPI [${SHA_SHORT}](https://github.com/pxlapi/pxlapi/commit/${ws.sha})`,
        actionStartTS && `Build for pxlAPI [${SHA_SHORT}](https://github.com/pxlapi/pxlapi/commit/${ws.sha}) succeeded in ${((Date.now() - actionStartTS) / 1000).toFixed(1)}s`,
        actionStartTS && `Push for pxlAPI [${SHA_SHORT}](https://github.com/pxlapi/pxlapi/commit/${ws.sha}) succeeded in ${((Date.now() - actionStartTS) / 1000).toFixed(1)}s`,
        `Pipeline for pxlAPI [${SHA_SHORT}](https://github.com/pxlapi/pxlapi/commit/${ws.sha}) failed in ${((Date.now() - pipelineStartTS) / 1000).toFixed(1)}s`,
        `Pipeline for pxlAPI [${SHA_SHORT}](https://github.com/pxlapi/pxlapi/commit/${ws.sha}) succeeded in ${((Date.now() - pipelineStartTS) / 1000).toFixed(1)}s`
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
}

async function notInScope(ws: Workspace) {
    console.log(`Branch ${(ws.args.ref as string).split('/')[1] as string} is not in scope, refusing work.`);
}

export async function run(ws: Workspace): Promise<void> {
    if (!RUN_FOR_BRANCHES.map(branch => `heads/${branch}`).includes(ws.args.ref as string)) {
        await runStep(logWorkspace, {name: "Workspace Info"});
        await runStep(notInScope, {name: "Not In Scope"});
        return;
    }

    const pipelineStartTS = Date.now();
    await discordWebhook(ws, DISCORD_STATUS.RUNNING, pipelineStartTS);

    let actionStartTS = Date.now();
    try {
        await runStep(logWorkspace, {name: "Workspace Info"});
        await runStep(buildImage, {name: "Build Docker Image"});

        await discordWebhook(ws, DISCORD_STATUS.BUILT, pipelineStartTS, actionStartTS);

        await spawnChildJob('.ci/docs/pipeline.ts:run', {
            alias: 'Build docs',
            properties: {image: 'node:buster'}
        });

        actionStartTS = Date.now();
        await runStep(pushImage, {
            name: "Push Docker Image",
            skipLocal: true,
        });

        await discordWebhook(ws, DISCORD_STATUS.PUSHED, pipelineStartTS, actionStartTS);
    } catch (err) {
        await discordWebhook(ws, DISCORD_STATUS.FAILED, pipelineStartTS);
        throw err;
    }

    await discordWebhook(ws, DISCORD_STATUS.FINISHED, pipelineStartTS);
}
