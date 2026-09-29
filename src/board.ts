import { createFeatureClient } from "openclaw/plugin-sdk/feature-contract";
import type { ControlUiHost } from "openclaw/plugin-sdk/control-ui";
import { contract, type Point, type Snapshot, type Stroke } from "./contract.js";

type Tool = "pen" | "eraser";
type BoardOptions = {
  host: ControlUiHost;
  agentId: string;
  sessionKey: string;
  canMutate: boolean;
};

const SVG_NS = "http://www.w3.org/2000/svg";
const COLORS = ["#172b43", "#1769aa", "#c24759", "#ac741c", "#3b8069"] as const;
const WIDTH = 1200;
const HEIGHT = 700;

function html<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  return node;
}

function pathData(points: readonly Point[]): string {
  if (!points.length) return "";
  const [first, ...rest] = points;
  if (!rest.length) return `M ${first.x} ${first.y} l 0.01 0.01`;
  return `M ${first.x} ${first.y} ${rest.map((point) => `L ${point.x} ${point.y}`).join(" ")}`;
}

function pathNode(stroke: Stroke): SVGPathElement {
  const path = document.createElementNS(SVG_NS, "path");
  path.setAttribute("d", pathData(stroke.points));
  path.setAttribute("fill", "none");
  path.setAttribute("stroke", stroke.color);
  path.setAttribute("stroke-width", String(stroke.width));
  path.setAttribute("stroke-linecap", "round");
  path.setAttribute("stroke-linejoin", "round");
  path.dataset.strokeId = stroke.id;
  return path;
}

function pngBlob(strokes: readonly Stroke[]): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const context = canvas.getContext("2d");
  if (!context) return Promise.reject(new Error("Image export is unavailable"));
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, WIDTH, HEIGHT);
  context.lineCap = "round";
  context.lineJoin = "round";
  for (const stroke of strokes) {
    const first = stroke.points[0];
    if (!first) continue;
    context.strokeStyle = stroke.color;
    context.fillStyle = stroke.color;
    context.lineWidth = stroke.width;
    if (stroke.points.length === 1) {
      context.beginPath();
      context.arc(first.x, first.y, stroke.width / 2, 0, Math.PI * 2);
      context.fill();
      continue;
    }
    context.beginPath();
    context.moveTo(first.x, first.y);
    for (const point of stroke.points.slice(1)) context.lineTo(point.x, point.y);
    context.stroke();
  }
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("Could not create PNG image")), "image/png");
  });
}

function download(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = html("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export function mountBoard(container: HTMLElement, options: BoardOptions): { dispose: () => void } {
  const { host, agentId, sessionKey } = options;
  const feature = createFeatureClient(contract, host);
  const root = html("section", "wb-root");
  root.setAttribute("aria-label", "Whiteboard");
  const header = html("header", "wb-header");
  const titles = html("div");
  const heading = html("h2");
  heading.textContent = "Whiteboard";
  const subtitle = html("p");
  subtitle.textContent = "Shared drawing for this OpenClaw session";
  titles.append(heading, subtitle);
  const badge = html("span", "wb-badge");
  badge.textContent = "Connecting…";
  header.append(titles, badge);

  const toolbar = html("div", "wb-toolbar");
  toolbar.setAttribute("role", "toolbar");
  toolbar.setAttribute("aria-label", "Drawing tools");
  const pen = html("button", "wb-tool wb-selected");
  pen.type = "button";
  pen.textContent = "Pen";
  const eraser = html("button", "wb-tool");
  eraser.type = "button";
  eraser.textContent = "Eraser";
  const swatches = html("div", "wb-swatches");
  swatches.setAttribute("role", "group");
  swatches.setAttribute("aria-label", "Pen color");
  const colorButtons = COLORS.map((value, index) => {
    const button = html("button", `wb-swatch${index === 0 ? " wb-active" : ""}`);
    button.type = "button";
    button.style.setProperty("--swatch", value);
    button.setAttribute("aria-label", `Color ${index + 1}`);
    swatches.append(button);
    return button;
  });
  const widthLabel = html("label", "wb-width");
  widthLabel.textContent = "Width";
  const widthInput = html("input");
  widthInput.type = "range";
  widthInput.min = "2";
  widthInput.max = "16";
  widthInput.value = "5";
  widthInput.setAttribute("aria-label", "Pen width");
  widthLabel.append(widthInput);
  const undo = html("button", "wb-secondary");
  undo.type = "button";
  undo.textContent = "Undo mine";
  undo.title = "Undo a stroke drawn in this window";
  const clear = html("button", "wb-secondary");
  clear.type = "button";
  clear.textContent = "Clear board";
  const exportButton = html("button", "wb-secondary");
  exportButton.type = "button";
  exportButton.textContent = "Export PNG";
  const linkButton = html("button", "wb-secondary");
  linkButton.type = "button";
  linkButton.textContent = "Copy session link";
  const shareButton = html("button", "wb-secondary");
  shareButton.type = "button";
  // The macOS OpenClaw WebView can hang while opening navigator.share's file sheet.
  // A downloaded PNG remains shareable through Mail, Messages, and Finder.
  const isMac = /Macintosh|Mac OS X/.test(navigator.userAgent);
  shareButton.textContent = isMac ? "Download to share" : "Share image";
  toolbar.append(pen, eraser, swatches, widthLabel, undo, clear, exportButton, linkButton, shareButton);

  const canvasBox = html("div", "wb-canvas-box");
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.classList.add("wb-canvas");
  svg.setAttribute("viewBox", `0 0 ${WIDTH} ${HEIGHT}`);
  svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
  svg.setAttribute("role", "img");
  svg.setAttribute("aria-label", "Drawing canvas");
  const saved = document.createElementNS(SVG_NS, "g");
  const pendingGroup = document.createElementNS(SVG_NS, "g");
  const draft = document.createElementNS(SVG_NS, "g");
  svg.append(saved, pendingGroup, draft);
  canvasBox.append(svg);

  const footer = html("footer", "wb-footer");
  const hint = html("span");
  hint.textContent = "OpenClaw teammates need session access. For email, share or attach the PNG.";
  const status = html("span", "wb-status");
  status.setAttribute("role", "status");
  status.textContent = "Loading board…";
  footer.append(hint, status);
  root.append(header, toolbar, canvasBox, footer);
  container.append(root);

  let tool: Tool = "pen";
  let color: string = COLORS[0];
  let width = 5;
  let pointerId: number | null = null;
  let current: Stroke | null = null;
  let currentPath: SVGPathElement | null = null;
  let snapshot: Snapshot = { revision: 0, strokes: [] };
  let ready = false;
  let disposed = false;
  let sessionWriteDenied = false;
  const pending = new Map<string, Stroke>();
  let recentOwnIds: string[] = [];
  const editable = options.canMutate && host.connection.canWrite;

  function message(value: string): void { status.textContent = value; }
  function notePermissionError(error: unknown): boolean {
    if (!/session is read-only for this connection/i.test(String(error))) return false;
    sessionWriteDenied = true;
    message("This session is read-only. Ask the owner to enable Shared access, then reload.");
    updateControls();
    return true;
  }
  function updateControls(): void {
    const canDraw = ready && editable && !sessionWriteDenied && host.connection.connected;
    pen.disabled = eraser.disabled = widthInput.disabled = !canDraw;
    colorButtons.forEach((button) => { button.disabled = !canDraw; });
    undo.disabled = !canDraw || recentOwnIds.length === 0;
    clear.disabled = !canDraw || snapshot.strokes.length === 0;
    exportButton.disabled = shareButton.disabled = !ready;
    linkButton.disabled = !ready;
    pen.classList.toggle("wb-selected", tool === "pen");
    eraser.classList.toggle("wb-selected", tool === "eraser");
    pen.setAttribute("aria-pressed", String(tool === "pen"));
    eraser.setAttribute("aria-pressed", String(tool === "eraser"));
    svg.classList.toggle("wb-erasing", tool === "eraser");
    colorButtons.forEach((button, index) => {
      const selected = COLORS[index] === color;
      button.classList.toggle("wb-active", selected);
      button.setAttribute("aria-pressed", String(selected));
    });
    badge.textContent = host.connection.connected ? sessionWriteDenied ? "Read-only" : ready ? editable ? "Shared · saved" : "View only" : "Connecting…" : "Offline";
    badge.classList.toggle("wb-live", host.connection.connected && ready);
  }

  function redraw(): void {
    saved.replaceChildren(...snapshot.strokes.map(pathNode));
    pendingGroup.replaceChildren(...[...pending.values()].filter((stroke) => !snapshot.strokes.some((item) => item.id === stroke.id)).map(pathNode));
    updateControls();
  }

  function applySnapshot(next: Snapshot): void {
    if (disposed || next.revision < snapshot.revision) return;
    sessionWriteDenied = false;
    snapshot = next;
    ready = true;
    recentOwnIds = recentOwnIds.filter((id) => next.strokes.some((stroke) => stroke.id === id));
    redraw();
    message(`Saved revision ${next.revision}`);
  }

  function pointFrom(event: PointerEvent): Point | null {
    const matrix = svg.getScreenCTM();
    if (!matrix) return null;
    const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
    if (point.x < 0 || point.x > WIDTH || point.y < 0 || point.y > HEIGHT) return null;
    return { x: Math.round(point.x * 10) / 10, y: Math.round(point.y * 10) / 10 };
  }

  const stopWatch = feature.watch("snapshot", {}, {
    sessionKey, agentId, events: ["changed"],
    onChange: applySnapshot,
    onError: (error) => {
      if (disposed) return;
      ready = false;
      if (notePermissionError(error)) return;
      message(`Could not load board: ${error.message}`);
      updateControls();
    },
  });
  const stopConnection = host.subscribe(() => { if (!disposed) updateControls(); });

  pen.onclick = () => { tool = "pen"; updateControls(); };
  eraser.onclick = () => { tool = "eraser"; updateControls(); };
  colorButtons.forEach((button, index) => {
    button.onclick = () => { color = COLORS[index]; tool = "pen"; updateControls(); };
  });
  widthInput.oninput = () => { width = Number(widthInput.value); };
  undo.onclick = async () => {
    const id = recentOwnIds.at(-1);
    if (!id) return;
    try {
      applySnapshot(await feature.invoke("erase", { id }, { sessionKey, agentId }));
      recentOwnIds = recentOwnIds.filter((item) => item !== id);
      updateControls();
    } catch (error) { if (!notePermissionError(error)) message(`Undo failed: ${String(error)}`); }
  };
  clear.onclick = async () => {
    if (!window.confirm("Clear every stroke on this shared board?")) return;
    try {
      const result = await feature.invoke("clear", { expectedRevision: snapshot.revision }, { sessionKey, agentId });
      applySnapshot(result.snapshot);
      if (result.conflict) message("Board changed; review it before clearing again");
    }
    catch (error) { if (!notePermissionError(error)) message(`Clear failed: ${String(error)}`); }
  };
  exportButton.onclick = async () => {
    try { download(await pngBlob(snapshot.strokes), "openclaw-whiteboard.png"); message("PNG downloaded"); }
    catch (error) { message(`Export failed: ${String(error)}`); }
  };
  linkButton.onclick = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      message("Session link copied. Grant teammate access with OpenClaw Session sharing.");
    } catch { message("Could not copy the session link"); }
  };
  shareButton.onclick = async () => {
    try {
      const file = new File([await pngBlob(snapshot.strokes)], "openclaw-whiteboard.png", { type: "image/png" });
      if (!isMac && navigator.share && (!navigator.canShare || navigator.canShare({ files: [file] }))) {
        await navigator.share({ files: [file], title: "OpenClaw whiteboard" });
        message("Image shared");
      } else {
        download(file, file.name);
        message("PNG downloaded; attach it to your email");
      }
    } catch (error) {
      if ((error as DOMException).name !== "AbortError") message(`Share failed: ${String(error)}`);
    }
  };

  svg.onpointerdown = (event) => {
    if (!ready || !editable || sessionWriteDenied || !host.connection.connected) return;
    if (event.button !== 0 && event.pointerType !== "touch" && event.pointerType !== "pen") return;
    if (tool === "eraser") {
      const target = event.target instanceof Element ? event.target.closest("[data-stroke-id]") : null;
      const id = target instanceof SVGPathElement ? target.dataset.strokeId : undefined;
      if (id) {
        void feature.invoke("erase", { id }, { sessionKey, agentId })
          .then(applySnapshot, (error) => { if (!notePermissionError(error)) message(`Erase failed: ${String(error)}`); });
      }
      return;
    }
    const point = pointFrom(event);
    if (!point) return;
    event.preventDefault();
    pointerId = event.pointerId;
    svg.setPointerCapture(event.pointerId);
    current = { id: crypto.randomUUID(), points: [point], color, width };
    currentPath = pathNode(current);
    draft.replaceChildren(currentPath);
  };
  svg.onpointermove = (event) => {
    if (event.pointerId !== pointerId || !current || !currentPath) return;
    const point = pointFrom(event);
    if (!point || current.points.length >= 512) return;
    const last = current.points[current.points.length - 1];
    if (Math.hypot(point.x - last.x, point.y - last.y) < 1) return;
    current.points.push(point);
    currentPath.setAttribute("d", pathData(current.points));
  };
  const finish = (event: PointerEvent, commit: boolean) => {
    if (event.pointerId !== pointerId) return;
    if (svg.hasPointerCapture(event.pointerId)) svg.releasePointerCapture(event.pointerId);
    pointerId = null;
    const stroke = current;
    current = null;
    currentPath = null;
    draft.replaceChildren();
    if (!commit || !stroke) return;
    pending.set(stroke.id, stroke);
    redraw();
    void feature.invoke("commit", stroke, { sessionKey, agentId }).then((next) => {
      pending.delete(stroke.id);
      recentOwnIds.push(stroke.id);
      applySnapshot(next);
    }, (error) => {
      pending.delete(stroke.id);
      redraw();
      if (!notePermissionError(error)) message(`Save failed: ${String(error)}`);
    });
  };
  svg.onpointerup = (event) => finish(event, true);
  svg.onpointercancel = (event) => finish(event, false);
  updateControls();

  return {
    dispose: () => {
      if (disposed) return;
      disposed = true;
      stopWatch();
      stopConnection();
      root.remove();
    },
  };
}
