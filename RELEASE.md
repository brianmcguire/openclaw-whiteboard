# Shared Whiteboard release record

This repository packages the independent `whiteboard` feature plugin for OpenClaw. Its runtime widget kind is `whiteboard:board`; its ClawHub package name is `@brianmcguire/openclaw-whiteboard`. Check the GitHub repository and ClawHub listing for current publication status.

## Verified through September 29, 2026

- Version 0.1.2 built and passed OpenClaw 2026.9.5 plugin validation in an isolated Node 24 environment.
- ClawHub CLI 0.23.3 `package validate` passed with no findings against its OpenClaw 2026.9.6 validation target.
- The production dependency audit reported zero vulnerabilities after pinning the development build tool esbuild to 0.28.2.
- `npm pack` contained the compiled backend and widget, manifest, and README. Installing the archive into a fresh isolated OpenClaw 2026.9.5 state loaded plugin ID `whiteboard` without diagnostics.
- Two synthetic identities on an isolated Gateway drew in one Shared session and saw each other's saved strokes without refresh. Persistence across reload and Gateway restart, revision conflicts, erase, clear, window-local undo, PNG export, and session-link copying were exercised.
- Version 0.1.2 is installed alongside Delivery Lens on the Nexus Mac mini's isolated Gateway. Its widget is pinned in the existing shared Delivery Lens session. A saved test mark survived browser reload, a 1200 × 700 PNG exported, and the temporary mark was cleared. This did not include a fresh two-person live sign-in test.
- The package and source review found no credentials or Gateway state in the archive. The local integration status file and generated reports are excluded from Git.

## Shared-editing beta release checks

The first public version is authorized as a shared-editing beta. In OpenClaw 2026.9.5, switching a session to Read-only blocks a collaborator's write as intended, but also rejects this widget's snapshot request after reload. A read-only viewer therefore cannot see the saved board. The README discloses this limitation.

1. Push the MIT-licensed candidate to GitHub and record its exact SHA. Run `clawhub package validate .` and `clawhub package publish . --family code-plugin --dry-run` against that commit. Inspect resolved owner, scope, package files, compatibility, and source metadata.
2. Publish the tested package with `--wait`. Confirm the release reaches public status after ClawHub security checks, then install it from ClawHub into a fresh isolated OpenClaw state and verify the widget loads. A staged package or pending scan is not a public release.

## Beta follow-up

- Run a fresh real-account acceptance test with two separately signed-in OpenClaw people, including one browser and one macOS app if available. Confirm each sees the other's stroke, a reconnect preserves the board, and session access blocks an uninvited account. The earlier synthetic test proves the collaboration mechanism, not the real sign-in path.
- Implement and test a supported read-only snapshot path.
- Verify an exported PNG can be attached to an email. Test the native image share sheet on a supported non-Mac platform.

## Product limits

- `Undo mine` tracks strokes drawn in the current window. Feature action context has no stable person ID for durable ownership.
- Anyone with edit access to the session can erase any stroke. Board files remain after session deletion until a retention policy is added.
- PNG and system sharing export a static image. Recipients need OpenClaw session access to collaborate on the live board.
- The native widget requires the Gateway's Custom plugin UI setting. Its code runs with the signed-in operator's Gateway permissions.

References: [ClawHub publishing](https://docs.openclaw.ai/clawhub/publishing), [ClawHub CLI](https://docs.openclaw.ai/clawhub/cli), and [session dashboards](https://docs.openclaw.ai/web/dashboards).
