import { defineFeaturePlugin } from "openclaw/plugin-sdk/feature-plugin";
import { contract } from "./contract.js";
import { changeBoard, getSnapshot } from "./store.js";
function session(context) {
    if (context.source !== "session-action" || !context.action?.sessionKey || !context.action.agentId) {
        throw new Error("A session dashboard is required");
    }
    return { agentId: context.action.agentId, sessionKey: context.action.sessionKey };
}
export default defineFeaturePlugin({
    contract,
    name: "Shared Whiteboard",
    description: "A collaborative drawing board for OpenClaw session dashboards.",
    setup(api, events) {
        api.session.controls.registerControlUiDescriptor({
            id: "board",
            surface: "widget",
            label: "Whiteboard",
            description: "Draw together in this session.",
            requiredScopes: ["operator.read"],
        });
        return {
            snapshot(_input, context) {
                const { agentId, sessionKey } = session(context);
                return getSnapshot(agentId, sessionKey);
            },
            async commit(stroke, context) {
                const { agentId, sessionKey } = session(context);
                const result = await changeBoard(agentId, sessionKey, (board) => {
                    if (board.strokes.some((existing) => existing.id === stroke.id))
                        return null;
                    return [...board.strokes, stroke];
                });
                if (result.changed)
                    events.emit("changed", {});
                return result.snapshot;
            },
            async erase({ id }, context) {
                const { agentId, sessionKey } = session(context);
                const result = await changeBoard(agentId, sessionKey, (board) => {
                    if (!board.strokes.some((stroke) => stroke.id === id))
                        return null;
                    return board.strokes.filter((stroke) => stroke.id !== id);
                });
                if (result.changed)
                    events.emit("changed", {});
                return result.snapshot;
            },
            async clear({ expectedRevision }, context) {
                const { agentId, sessionKey } = session(context);
                let conflict = false;
                const result = await changeBoard(agentId, sessionKey, (board) => {
                    if (board.revision !== expectedRevision) {
                        conflict = true;
                        return null;
                    }
                    return board.strokes.length ? [] : null;
                });
                if (result.changed)
                    events.emit("changed", {});
                return { snapshot: result.snapshot, cleared: result.changed, conflict };
            },
        };
    },
});
