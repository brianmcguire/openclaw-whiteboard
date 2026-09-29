import { createHash, randomUUID } from "node:crypto";
import { mkdir, open, readFile, rename, unlink } from "node:fs/promises";
import { dirname, join } from "node:path";
import { resolveStateDir } from "openclaw/plugin-sdk/state-paths";
const MAX_BYTES = 2_000_000;
const MAX_STROKES = 800;
const writes = new Map();
function boardPath(agentId, sessionKey) {
    const hash = createHash("sha256").update(agentId).update("\0").update(sessionKey).digest("hex");
    return join(resolveStateDir(), "plugins", "whiteboard", "boards", `${hash}.json`);
}
async function read(path) {
    let data;
    try {
        data = await readFile(path, "utf8");
    }
    catch (error) {
        if (error.code === "ENOENT")
            return { revision: 0, strokes: [] };
        throw error;
    }
    const parsed = JSON.parse(data);
    if (!Number.isSafeInteger(parsed.revision) || !Array.isArray(parsed.strokes)) {
        throw new Error("Whiteboard storage is invalid");
    }
    return parsed;
}
async function write(path, board) {
    const data = JSON.stringify(board);
    if (Buffer.byteLength(data, "utf8") > MAX_BYTES)
        throw new Error("Whiteboard is full; export an image before adding more strokes");
    await mkdir(dirname(path), { recursive: true, mode: 0o700 });
    const temporary = `${path}.${process.pid}.${randomUUID()}.tmp`;
    try {
        const file = await open(temporary, "wx", 0o600);
        try {
            await file.writeFile(data);
            await file.sync();
        }
        finally {
            await file.close();
        }
        await rename(temporary, path);
    }
    catch (error) {
        await unlink(temporary).catch(() => undefined);
        throw error;
    }
}
export async function getSnapshot(agentId, sessionKey) {
    const path = boardPath(agentId, sessionKey);
    const pending = writes.get(path);
    if (pending)
        await pending;
    return read(path);
}
export async function changeBoard(agentId, sessionKey, mutate) {
    const path = boardPath(agentId, sessionKey);
    const prior = writes.get(path) ?? Promise.resolve();
    let release;
    const next = new Promise((resolve) => { release = resolve; });
    const queue = prior.then(() => next);
    writes.set(path, queue);
    await prior;
    try {
        const current = await read(path);
        const strokes = mutate(current);
        if (strokes === null)
            return { snapshot: current, changed: false };
        if (strokes.length > MAX_STROKES)
            throw new Error("Whiteboard stroke limit reached");
        const snapshot = { revision: current.revision + 1, strokes };
        await write(path, snapshot);
        return { snapshot, changed: true };
    }
    finally {
        release();
        if (writes.get(path) === queue)
            writes.delete(path);
    }
}
