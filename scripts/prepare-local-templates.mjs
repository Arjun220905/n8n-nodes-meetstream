import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const sourceDirectory = resolve(root, 'templates');
const outputDirectory = resolve(root, '.local', 'templates');
const publishedType = 'n8n-nodes-meetstream.meetStream';
const developmentType = 'CUSTOM.meetStream';

await rm(outputDirectory, { recursive: true, force: true });
await mkdir(outputDirectory, { recursive: true });

const templateNames = (await readdir(sourceDirectory))
	.filter((name) => /^\d{2}-.+\.json$/.test(name))
	.sort();

if (templateNames.length !== 5) {
	throw new Error(`Expected 5 publishable templates, found ${templateNames.length}`);
}

for (const name of templateNames) {
	const workflow = JSON.parse(await readFile(resolve(sourceDirectory, name), 'utf8'));
	let replacements = 0;

	for (const node of workflow.nodes ?? []) {
		if (node.type === publishedType) {
			node.type = developmentType;
			replacements += 1;
		}
	}

	if (replacements === 0) {
		throw new Error(`${name} does not contain a MeetStream node`);
	}

	await writeFile(resolve(outputDirectory, name), `${JSON.stringify(workflow, null, 2)}\n`);
}

console.log(`Prepared ${templateNames.length} local-development templates in .local/templates`);
