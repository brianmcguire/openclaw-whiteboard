# Shared Whiteboard for OpenClaw

An experimental session dashboard widget for collaborative freehand drawing in OpenClaw. It works in the browser Control UI and the macOS app's embedded dashboard when both use the same Gateway.

## Install and add a board

After the ClawHub release is public, install the plugin on your Gateway:

```sh
openclaw plugins install clawhub:@brianmcguire/openclaw-whiteboard
```

Enable **Custom plugin UI** in OpenClaw Settings > Labs and open the Gateway's Control UI over HTTPS or trusted loopback. Native plugin UI runs with the signed-in operator's Gateway permissions, so install it only on a Gateway where you trust this package.

In a Shared session, ask an agent with the `dashboard` tool to put this widget on the dashboard:

```json
{"action":"widget_put","name":"shared-whiteboard","title":"Shared Whiteboard","pluginKind":"whiteboard:board","props":{},"size":"full"}
```

The widget stays with that session. Other sessions need their own board widget. OpenClaw's [session dashboard guide](https://docs.openclaw.ai/web/dashboards) documents the `dashboard` tool's `pluginKind` form.

## What works in the current build

- A board is scoped to one OpenClaw agent and session. Strokes are stored as vector points under the Gateway's state directory and survive a browser reload and Gateway restart.
- Connected dashboard clients receive a content-free change event and fetch the saved board. Two browser clients on an isolated loopback Gateway saw each other's completed strokes without refreshing.
- Pen colors and widths, whole-stroke erasing, undo of strokes drawn **in this window**, and a revision-checked clear action.
- Export a 1200 × 700 PNG and copy the current session link for OpenClaw teammates. On macOS, **Download to share** saves a PNG for Mail, Messages, or another app. On other platforms, **Share image** uses the system share sheet when file sharing is supported and otherwise downloads the PNG.

An isolated Gateway test used two separate synthetic OpenClaw identities. Both drew in the same shared session and saw each other's saved strokes without refreshing; the board survived a collaborator reload. These identities are test headers, not two real people signing in. The test also confirmed that OpenClaw rejects a collaborator's write when the session becomes read-only. In OpenClaw 2026.9.5, that mode also rejects the widget's snapshot request after reload, so read-only board viewing remains a release blocker. Version 0.1.1 rendered in the OpenClaw macOS app against a Mac Mini Gateway over HTTPS; a drawn mark was saved and survived reopening the session. PNG export produced a 1200 × 700 image, and the session link was copied. The macOS file share sheet hung the app in 0.1.0, so later builds use the download path there.

## Sharing

For OpenClaw collaborators, use the chat's **Session sharing** controls to grant access, then send the copied session link. A link alone does not grant access. The board is tied to that session; it is not exposed through a public transcript link. OpenClaw enforces session access and the feature action scopes at the Gateway.

For people outside OpenClaw, export the PNG and attach it to an email. On supported non-Mac platforms, **Share image** can pass the PNG to the system share sheet. This sends a snapshot of the drawing, not an editable live board. The plugin does not send email itself.

## Build and validate

Use Node 24.16+ below 25, or Node 26.1+, with OpenClaw 2026.9.5 available on PATH.

    npm ci
    npm run build
    npm run validate

The native widget kind is `whiteboard:board`.

## Storage and limits

The backend writes one JSON board per agent/session under the OpenClaw state directory at `plugins/whiteboard/boards/`. It commits strokes atomically, serializes writes within one Gateway process, and caps a board at 800 strokes, 512 points per stroke, and 2 MB. Events contain no session key or drawing content. Board files are not automatically removed when a session is deleted; manual retention and cleanup need a later design.

OpenClaw 2026.9.5 does not provide a stable person identity to this feature action handler. Therefore **Undo mine** is limited to strokes remembered by the current browser window, and erasing a stroke is available to any participant permitted to edit the session. Per-person ownership and cross-device undo are not implemented.

## Next acceptance checks

1. Two real, separately signed-in OpenClaw people draw in one shared session; both see the same result after reconnect and restart. Resolve read-only snapshot access so a viewer can see the board without editing it.
2. Open the same session board in a separately authenticated browser Control UI against the Mac Mini Gateway.
3. Check **Share image** on a supported non-Mac platform and the PNG email-attachment path.
4. Finish the public GitHub and ClawHub checks in [RELEASE.md](RELEASE.md).

OpenClaw references: [feature plugins](https://docs.openclaw.ai/plugins/feature-plugins), [session sharing](https://docs.openclaw.ai/web/control-ui/sessions-and-sidebar), and [multi-user mode](https://docs.openclaw.ai/concepts/multi-user).
