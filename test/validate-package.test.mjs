import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';

const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url)));
const source = await readFile(
	new URL('../nodes/MeetStream/MeetStream.node.ts', import.meta.url),
	'utf8',
);

test('package metadata exposes the MeetStream node and credential', () => {
	assert.equal(pkg.name, 'n8n-nodes-meetstream');
	assert.deepEqual(pkg.n8n.credentials, ['dist/credentials/MeetStreamApi.credentials.js']);
	assert.deepEqual(pkg.n8n.nodes, ['dist/nodes/MeetStream/MeetStream.node.js']);
	assert.equal(
		pkg.dependencies,
		undefined,
		'verified community packages must not ship runtime dependencies',
	);
	assert.equal(pkg.engines.node, '>=24');
});

test('outbound API is pinned and meeting links require HTTPS', () => {
	assert.match(source, /https:\/\/api\.meetstream\.ai\/api\/v1/);
	assert.match(source, /allowedDomains: 'api\.meetstream\.ai'/);
	assert.match(source, /\.protocol === 'https:'/);
	assert.doesNotMatch(source, /process\.env|node:fs|node:child_process/);
});

test('workflow blueprints are valid, connected, and use the MeetStream node', async () => {
	const names = (await readdir(new URL('../templates/', import.meta.url)))
		.filter((name) => name.endsWith('.json'))
		.sort();
	assert.equal(names.length, 5);

	for (const name of names) {
		const workflow = JSON.parse(await readFile(new URL(`../templates/${name}`, import.meta.url)));
		const nodeNames = new Set(workflow.nodes.map((node) => node.name));
		assert.ok(
			workflow.nodes.some((node) => node.type === 'n8n-nodes-meetstream.meetStream'),
			`${name} must demonstrate the MeetStream node`,
		);
		assert.ok(
			workflow.nodes.some((node) => node.type === 'n8n-nodes-base.set'),
			`${name} must include an editable input node`,
		);
		for (const targets of Object.values(workflow.connections)) {
			for (const output of targets.main ?? []) {
				for (const connection of output)
					assert.ok(nodeNames.has(connection.node), `${name} has a connection to a missing node`);
			}
		}
	}
});
