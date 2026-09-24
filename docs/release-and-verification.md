# Release, verification, and publication checklist

This repository is technically ready only when every local and CI gate below passes. The product goal is complete only after the external npm, n8n, template-library, and MeetStream documentation steps are also complete.

## Local release gate

Use Node.js 24 or newer from a clean branch:

```bash
npm ci
npm run lint
npm test
npm pack --dry-run
npm audit --omit=dev
git diff --check
```

Confirm that the package contains only the built node/credential assets, has no runtime dependencies, contains no secrets or customer data, and that the five templates import in the current n8n release.

## First npm release

1. Keep the repository public and confirm `package.json` repository, homepage, author, license, and keywords are correct.
2. In npm, configure a trusted publisher for this GitHub repository and `.github/workflows/publish.yml`.
3. If the repository has moved to `meetstream-ai`, update `package.json`, GitHub links, branch protection, and the npm trusted publisher before tagging.
4. Run `npm run release` from a clean `main` branch. The version commit and tag start the provenance-enabled GitHub Actions publish job.
5. Verify the public npm page, provenance badge/attestation, tarball contents, and installation into a fresh n8n instance.
6. Run `npx @n8n/scan-community-package n8n-nodes-meetstream` against the published package and save the passing output.

## n8n verification

Submit or update `n8n-nodes-meetstream` in the n8n Creator Portal. Keep the submission ID, npm version, source commit, CI URL, scanner output, and reviewer correspondence together. Review feedback should be fixed by the repository maintainer; MeetStream must name that owner before submission so comments do not stall.

The **Publish** button inside the local n8n workflow editor does not publish an npm package or a template. It only activates/publishes that workflow in that n8n instance.

## Five template submissions

For each file in `templates/`:

1. Import it into a clean current n8n instance.
2. Confirm no node is unknown and all expressions resolve with representative fixture data.
3. Connect test credentials and perform an end-to-end run using accounts and meetings you control.
4. Remove execution data, credential references, bot IDs, meeting links, transcripts, and signed media URLs before export.
5. Add a clear title, problem statement, setup steps, required credentials, and a screenshot.
6. Submit it separately through the n8n template creator flow and record the resulting template URL.

The goal requires five public template-library URLs; five JSON files in GitHub are preparation, not publication.

## MeetStream-side documentation

Publish the usage material from `README.md`, `quickstart.md`, `templates/README.md`, and `docs/webhook-security.md` on MeetStream's documentation site. Link back to the verified n8n listing and the five public template URLs. Repository documentation alone does not prove that the MeetStream-owned docs site was updated.

## Ownership and rollback

- **Review feedback owner:** the maintainer with write access to this repository and npm package.
- **MeetStream API questions:** MeetStream API owner/support.
- **Template content and screenshots:** template submitter/marketing owner.
- **Rollback:** deprecate a bad npm version, publish a corrected patch, and update the Creator Portal submission. Never reuse or move an existing npm version tag.
