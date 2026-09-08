# Pi setup for this sandbox

Run these commands from your project directory (for example,
`/workspaces/mc-html-home`). Local installs apply to the project where you run
them; moving this guide does not move installed packages.

## Project packages

```bash
pi install --local npm:pi-web-access
pi install --local npm:pi-playwright
pi
```

Restart Pi from the same project directory after installing packages.
`pi-web-access` provides web search/fetch capabilities; individual search
providers may require additional configuration. `pi-playwright` provides a
browser automation skill for testing.

Pi records local packages in `.pi/settings.json`:

```json
{
  "packages": [
    "npm:pi-web-access",
    "npm:pi-playwright"
  ]
}
```

The install commands update this file for you. Preserve any other settings
when editing it manually. Local npm packages live under `.pi/npm/`; the
workspace persists across sandbox invocations. Use `pi list` to check package
registration.

Omit `--local` to install for all projects. This sandbox also persists Pi's
user configuration under `~/.pi/agent`.

## Browser testing

Install Chromium once:

```bash
npx playwright install chromium
```

If Playwright reports missing system libraries, install them from an ordinary
container terminal outside the inner agent sandbox:

```bash
npx playwright install-deps chromium
```

Ask Pi:

> Use the playwright-browser skill to start this app and test its main flow
> in headless Chromium. Check console errors and save screenshots in the
> project's test-artifacts directory.

You can also select the skill explicitly with `/skill:playwright-browser`.

Have Pi start **both the dev server and browser within the same Pi session**.
The network jail has its own localhost, so a server started in an ordinary
terminal is not automatically reachable. Save artifacts in the workspace to
keep them across invocations.

Browser startup has not yet been verified in this sandbox; installing the Pi
package alone does not verify Chromium and its dependencies.

## Qwen3.8-27B and vision

- Functional browser testing does not require vision: Pi can inspect page
  structure, click controls, fill forms, and read assertions and console errors
  through text-based tools.
- Judging screenshots for layout, clipping, or appearance requires image input.
- Qwen3.8-27B supports images, but the local inference server must load and
  expose its vision support, and Pi's model configuration must accept images.
  Vision in the current local setup has not yet been verified.

Start with functional testing, then send a screenshot and verify that the model
can describe its actual contents before relying on visual checks.

## References

- [Pi package installation](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/packages.md)
- [pi-web-access](https://github.com/nicobailon/pi-web-access)
- [pi-playwright setup and usage](https://github.com/guwidoe/pi-playwright)
- [Qwen3.8-27B model card](https://huggingface.co/Qwen/Qwen3.8-27B)
