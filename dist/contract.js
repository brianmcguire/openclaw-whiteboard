import { Type } from "typebox";
import { defineFeatureContract } from "openclaw/plugin-sdk/feature-contract";
const point = Type.Object({
    x: Type.Number({ minimum: 0, maximum: 1200 }),
    y: Type.Number({ minimum: 0, maximum: 700 }),
}, { additionalProperties: false });
const stroke = Type.Object({
    id: Type.String({ pattern: "^[0-9a-fA-F-]{36}$" }),
    points: Type.Array(point, { minItems: 1, maxItems: 512 }),
    color: Type.String({ pattern: "^#[0-9a-fA-F]{6}$" }),
    width: Type.Number({ minimum: 2, maximum: 16 }),
}, { additionalProperties: false });
const snapshot = Type.Object({
    revision: Type.Integer({ minimum: 0 }),
    strokes: Type.Array(stroke, { maxItems: 800 }),
}, { additionalProperties: false });
const empty = Type.Object({}, { additionalProperties: false });
export const contract = defineFeatureContract({
    pluginId: "whiteboard",
    operations: {
        snapshot: {
            kind: "query", description: "Read the current session whiteboard",
            input: empty, output: snapshot,
        },
        commit: {
            kind: "action", description: "Add one whiteboard stroke",
            input: stroke, output: snapshot,
        },
        erase: {
            kind: "action", description: "Erase one whiteboard stroke",
            input: Type.Object({ id: stroke.properties.id }, { additionalProperties: false }),
            output: snapshot,
        },
        clear: {
            kind: "action", description: "Clear the whiteboard at a known revision",
            input: Type.Object({ expectedRevision: Type.Integer({ minimum: 0 }) }, { additionalProperties: false }),
            output: Type.Object({
                snapshot,
                cleared: Type.Boolean(),
                conflict: Type.Boolean(),
            }, { additionalProperties: false }),
        },
    },
    // Operator-wide events carry no session key or drawing content.
    events: { changed: empty },
});
