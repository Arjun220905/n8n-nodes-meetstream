import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url)));
const source = await readFile(new URL('../nodes/MeetStream/MeetStream.node.ts', import.meta.url), 'utf8');

test('package metadata exposes the MeetStream node and credential', () => {
	assert.equal(pkg.name, 'n8n-nodes-meetstream');
	assert.deepEqual(pkg.n8n.credentials, ['dist/credentials/MeetStreamApi.credentials.js']);
	assert.deepEqual(pkg.n8n.nodes, ['dist/nodes/MeetStream/MeetStream.node.js']);
});

test('outbound API is pinned and meeting links require HTTPS', () => {
	assert.match(source, /https:\/\/api\.meetstream\.ai\/api\/v1/);
	assert.match(source, /allowedDomains: 'api\.meetstream\.ai'/);
	assert.match(source, /\.protocol === 'https:'/);
});
