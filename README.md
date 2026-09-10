# composer.kiyoshi.dev

A deployment of [better-lyrics/composer](https://github.com/better-lyrics/composer), built and
published to GitHub Pages, so that Kodama can frame it as an extension.

**There is no Composer source in this repo.** The workflow checks out upstream at the commit named
in `.composer-version`, builds it, and publishes the result. That is the whole point: Kodama used
to carry a modified copy, which meant every upgrade had to be re-applied by hand against a baseline
nobody had recorded, and it sat sixteen minor versions behind as a result.

## Upgrading

Change the commit in `.composer-version`, push. The workflow rebuilds and deploys.

To find the newest commit:

```bash
gh api repos/better-lyrics/composer/commits/master --jq '.sha'
```

Upstream publishes no tags, so a commit hash is the only thing that pins a build. The comment in
`.composer-version` records which release number that commit called itself.

## What this repo adds

`bootstrap.js`, injected into every built page. It does two things, and only when the page is
framed by Kodama:

1. Points the Composer's audio bridge at `http://localhost:9847/composer-bridge`, the one Kodama
   serves, and turns on the setting that uses it. Without this you would have to type the address
   into the Composer's own settings by hand.
2. Paints the Composer in the colours of whatever theme Kodama is wearing, asked for over the
   extension bridge rather than reached in from outside.

Opened directly in a browser, the bootstrap does nothing at all and the site behaves exactly like
upstream.

## Licence

Composer is AGPL-3.0, which permits self-hosting. This repo carries the recipe rather than the
code; the source is at
[better-lyrics/composer](https://github.com/better-lyrics/composer) at the commit named in
`.composer-version`.

`bootstrap.js` is part of Kodama and shares its licence.
