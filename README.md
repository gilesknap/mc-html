# Two Worlds — Astra × Qwen

A static showcase of two single-file Minecraft-style games built from the same prompt.

- **Astra / Wildwood:** one continuous run, approximately 18 minutes, medium effort, as reported by the author. Includes implementation and verification within that run.
- **Qwen / Voxel Craft:** `Qwen3.8-27B-UD-Q4_K_S.gguf`, run locally in pi.dev over several iterations and approximately four full 128K contexts, as reported by the author. Initially no agent internet access; `pi-web-access` was installed later.

The landing page includes playable links, actual browser captures, implementation observations, Qwen’s seven-commit timeline, and locally observed hardware. These runs used different tools and iteration budgets; this is a showcase, without a controlled performance or token-cost benchmark.

## Files

```text
index.html                    Comparison landing page
prompt.html / PROMPT.md        Full prompt, linked to the original Google Doc
astra/index.html              Original Astra game, unchanged
qwen/index.html               Current Qwen working-tree snapshot, unchanged
assets/                       Browser screenshots
evidence/                    Provenance, hashes, history, and source notes
.github/workflows/pages.yml   Static GitHub Pages deployment
.nojekyll                     Static-hosting marker
```

Both games are standalone HTML files. Each loads Three.js from a CDN. The landing page itself requires no CDN, build tools, npm, or JavaScript.

## Local preview

From this directory:

```sh
python3 -m http.server 8000
```

Open `http://localhost:8000/`. Game links open new tabs so pointer lock and GPU rendering work directly. The games target desktop keyboard and mouse input.

## Preserve Qwen’s history when moving to GitHub

The intended repository base is the sibling **`mc-html-home`**. This showcase directory was not initialized as a new Git repository. The original repo has not been modified, committed, pushed, or published by this task.

At capture, the original repository had seven commits, an uncommitted `index.html`, an untracked `PI-SETUP.md`, and no remote. Its current game is already copied to `qwen/index.html` here. The source snapshot and patch are recorded under `evidence/`.

When ready to migrate, first ensure the source game still matches the captured copy:

```sh
cd ../mc-html-home
cmp index.html ../mc-html-astra/qwen/index.html
```

A difference means Qwen continued changing after capture. Refresh the snapshot, evidence, screenshots, and any affected comparison text before proceeding.

Checkpoint the current game and move it into its final folder, preserving ancestry:

```sh
git add -- index.html
git commit -m "Checkpoint final Qwen working-tree game"
mkdir -p qwen
git mv index.html qwen/index.html
```

Skip the checkpoint commit if the game is already committed. Copy the showcase around the moved Qwen file:

```sh
cp ../mc-html-astra/index.html ./index.html
cp ../mc-html-astra/prompt.html ../mc-html-astra/PROMPT.md ./
cp -R ../mc-html-astra/astra ../mc-html-astra/assets ../mc-html-astra/evidence ./
cp ../mc-html-astra/qwen/README.md qwen/README.md
cp ../mc-html-astra/README.md ./README.md
cp ../mc-html-astra/.nojekyll ./.nojekyll
mkdir -p .github/workflows
cp ../mc-html-astra/.github/workflows/pages.yml .github/workflows/pages.yml
```

Keep the original `.gitignore` (which excludes `.pi`) and optionally append `_site/` and `test-artifacts/`. Leave `PI-SETUP.md` and any other local files alone unless you intend to publish them. The deployment workflow explicitly packages only the showcase files, not Pi’s local configuration.

Review and commit the migration with explicit paths:

```sh
git add -- index.html prompt.html PROMPT.md astra qwen assets evidence README.md .nojekyll .github/workflows/pages.yml
git diff --cached --stat
git commit -m "Showcase Astra and Qwen voxel games with original Qwen history"
git log --follow -- qwen/index.html
```

This keeps all original Qwen commits. Avoid copying a `.git` directory from one workspace into another or starting a replacement history.

## GitHub and GitHub Pages

Choose a GitHub owner and repository name when ready to publish; none is assumed here. The included workflow deploys through **GitHub Actions** to GitHub Pages, without a separate generated `gh-pages` branch.

1. Create an empty GitHub repository and add it as the remote of `mc-html-home`.
2. Use `main` as the publishing branch, or change `on.push.branches` in the workflow to the branch you use.
3. In **Settings → Pages → Build and deployment**, select **GitHub Actions**.
4. Push the preserved repository history, then run the included “Publish showcase to GitHub Pages” workflow if the first push preceded enabling Pages.
5. Open the URL shown by the deployment job, normally `https://OWNER.github.io/REPOSITORY/`.

Example commands after choosing the destination:

```sh
git branch -M main
git remote add origin https://github.com/OWNER/REPOSITORY.git
git push -u origin main
```

The workflow assembles `_site/` from an explicit file list and uploads that artifact. Relative links support GitHub project paths and custom domains. No domain or repository-specific base URL is embedded.

## Evidence and verification

See [evidence/README.md](evidence/README.md) for sourcing and limitations, and [evidence/snapshot.json](evidence/snapshot.json) for hashes. Game code is intentionally preserved so the showcase does not quietly improve one contestant during presentation work.
