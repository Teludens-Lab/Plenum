import { STUDIO_CRDT_CONTRACT_ID, type StudioCrdtV1, type StudioSaveStateV1, type StudioValidationReportV1 } from "@plenum/event-contracts";
import type { CoreDesignV1, ScenarioV1 } from "@plenum/simulation-schema";
import * as Y from "yjs";

export interface StudioClientState {
  connected: boolean;
  generation: number;
  saveState: StudioSaveStateV1;
  unsynchronizedChanges: number;
  validation: StudioValidationReportV1 | null;
  message: string | null;
}

const REMOTE = Symbol("remote");

interface PendingUpdate {
  update: string;
  changeCount: number;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  }
  return btoa(binary);
}

function base64ToBytes(value: string): Uint8Array {
  return Uint8Array.from(atob(value), (character) => character.charCodeAt(0));
}

function toYValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    const result = new Y.Array<unknown>();
    result.push(value.map(toYValue));
    return result;
  }
  if (typeof value === "object" && value !== null) {
    const result = new Y.Map<unknown>();
    for (const [key, child] of Object.entries(value)) result.set(key, toYValue(child));
    return result;
  }
  return value;
}

export class StudioCollaborationClient {
  readonly document = new Y.Doc();
  private readonly undoManager = new Y.UndoManager(this.document.getMap("draft"), {
    trackedOrigins: new Set(["visual-editor"])
  });
  private readonly pending = new Map<string, PendingUpdate>();
  private readonly listeners = new Set<(state: StudioClientState) => void>();
  private socket: WebSocket | null = null;
  private inFlightUpdateId: string | null = null;
  private reconnectTimer: number | null = null;
  private stopped = false;
  private readonly offline = () => {
    const socket = this.socket;
    this.socket = null;
    this.setState({ connected: false, saveState: this.pending.size > 0 ? "saved_on_device" : this.state.saveState,
      message: "Connection lost. Changes remain in this tab and will retry automatically." });
    socket?.close(1001, "Browser offline");
  };
  private readonly online = () => this.socket === null ? this.connect() : this.flush();
  private state: StudioClientState = {
    connected: false, generation: 1, saveState: "saved_on_device", unsynchronizedChanges: 0,
    validation: null, message: "Connecting to the collaboration service."
  };

  constructor(readonly projectId: string) {
    this.document.on("update", (update: Uint8Array, origin: unknown) => {
      if (origin === REMOTE) return;
      const updateId = crypto.randomUUID();
      this.pending.set(updateId, { update: bytesToBase64(update), changeCount: 1 });
      this.setState({ saveState: "saved_on_device", unsynchronizedChanges: this.pendingChangeCount(), message: null });
      if (!navigator.onLine) this.socket?.close(1001, "Browser offline");
      else this.flush();
    });
    window.addEventListener("offline", this.offline);
    window.addEventListener("online", this.online);
  }

  connect(): void {
    this.stopped = false;
    window.addEventListener("offline", this.offline);
    window.addEventListener("online", this.online);
    if (this.socket !== null) return;
    const scheme = location.protocol === "https:" ? "wss:" : "ws:";
    const socket = new WebSocket(`${scheme}//${location.host}/v1/projects/${this.projectId}/collaboration`);
    this.socket = socket;
    socket.addEventListener("open", () => { if (this.socket === socket) this.setState({ connected: true, message: null }); });
    socket.addEventListener("message", (event) => { if (this.socket === socket) this.receive(JSON.parse(String(event.data)) as StudioCrdtV1); });
    socket.addEventListener("close", () => {
      if (this.socket !== null && this.socket !== socket) return;
      if (this.socket === socket) this.socket = null;
      this.inFlightUpdateId = null;
      this.setState({ connected: false, saveState: this.pending.size > 0 ? "saved_on_device" : this.state.saveState,
        message: "Connection lost. Changes remain in this tab and will retry automatically." });
      if (!this.stopped) this.reconnectTimer = window.setTimeout(() => this.connect(), 1000);
    });
  }

  stop(): void {
    this.stopped = true;
    if (this.reconnectTimer !== null) window.clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
    const socket = this.socket;
    this.socket = null;
    socket?.close(1000, "Studio closed");
    window.removeEventListener("offline", this.offline);
    window.removeEventListener("online", this.online);
  }

  subscribe(listener: (state: StudioClientState) => void): () => void {
    this.listeners.add(listener);
    listener(this.state);
    return () => this.listeners.delete(listener);
  }

  scenarioField(field: "name" | "description"): string {
    const value = (this.document.getMap("draft").get("scenario") as Y.Map<unknown> | undefined)?.get(field);
    return typeof value === "string" ? value : "";
  }

  materialization(): { coreDesign: CoreDesignV1; scenario: ScenarioV1 } {
    return this.document.getMap("draft").toJSON() as { coreDesign: CoreDesignV1; scenario: ScenarioV1 };
  }

  transact(change: () => void): void {
    this.document.transact(change, "visual-editor");
  }

  setAtPath(path: readonly (string | number)[], value: unknown): void {
    this.transact(() => {
      const parent = this.resolve(path.slice(0, -1), true);
      const key = path.at(-1);
      if (!(parent instanceof Y.Map) || typeof key !== "string") throw new Error("Studio field path is invalid");
      parent.set(key, toYValue(value));
    });
  }

  deleteAtPath(path: readonly (string | number)[]): void {
    this.transact(() => {
      const parent = this.resolve(path.slice(0, -1));
      const key = path.at(-1);
      if (!(parent instanceof Y.Map) || typeof key !== "string") throw new Error("Studio field path is invalid");
      parent.delete(key);
    });
  }

  appendAtPath(path: readonly (string | number)[], value: unknown): void {
    this.transact(() => {
      let target = this.resolve(path);
      if (target === undefined) {
        const parent = this.resolve(path.slice(0, -1), true);
        const key = path.at(-1);
        if (!(parent instanceof Y.Map) || typeof key !== "string") throw new Error("Studio collection path is invalid");
        target = new Y.Array<unknown>();
        parent.set(key, target);
      }
      if (!(target instanceof Y.Array)) throw new Error("Studio collection path is invalid");
      target.push([toYValue(value)]);
    });
  }

  removeAtPath(path: readonly (string | number)[], index: number): void {
    this.transact(() => {
      const target = this.resolve(path);
      if (!(target instanceof Y.Array) || index < 0 || index >= target.length) throw new Error("Studio collection item is invalid");
      target.delete(index, 1);
    });
  }

  moveAtPath(path: readonly (string | number)[], index: number, direction: -1 | 1): void {
    this.transact(() => {
      const target = this.resolve(path);
      const destination = index + direction;
      if (!(target instanceof Y.Array) || destination < 0 || destination >= target.length) return;
      const value = target.get(index);
      const json = value instanceof Y.AbstractType ? value.toJSON() : value;
      target.delete(index, 1);
      target.insert(destination, [toYValue(json)]);
    });
  }

  undo(): void {
    this.undoManager.stopCapturing();
    this.undoManager.undo();
  }

  setScenarioField(field: "name" | "description", value: string): void {
    const scenario = this.document.getMap("draft").get("scenario");
    if (scenario instanceof Y.Map) scenario.set(field, value);
  }

  markPublished(): void {
    this.setState({ saveState: "published", message: "The frozen Draft was published." });
  }

  private resolve(path: readonly (string | number)[], create = false): unknown {
    let value: unknown = this.document.getMap("draft");
    for (const [index, segment] of path.entries()) {
      let next = typeof segment === "number" && value instanceof Y.Array ? value.get(segment) :
        typeof segment === "string" && value instanceof Y.Map ? value.get(segment) : undefined;
      if (next === undefined && create && typeof segment === "string" && value instanceof Y.Map) {
        next = typeof path[index + 1] === "number" ? new Y.Array<unknown>() : new Y.Map<unknown>();
        value.set(segment, next);
      }
      value = next;
    }
    return value;
  }

  private receive(message: StudioCrdtV1): void {
    if (message.contractId !== STUDIO_CRDT_CONTRACT_ID) return;
    if ((message.type === "sync" || message.type === "remote_update") && message.update !== null) {
      Y.applyUpdate(this.document, base64ToBytes(message.update), REMOTE);
    }
    if (message.type === "ack" && message.updateId !== null) {
      this.pending.delete(message.updateId);
      if (this.inFlightUpdateId === message.updateId) this.inFlightUpdateId = null;
    }
    this.setState({
      generation: message.generation,
      validation: message.validation ?? this.state.validation,
      saveState: this.pending.size > 0 ? "saved_on_device" : message.saveState ?? this.state.saveState,
      unsynchronizedChanges: this.pendingChangeCount(),
      message: message.message
    });
    this.flush();
  }

  private flush(): void {
    if (this.socket?.readyState !== WebSocket.OPEN || this.inFlightUpdateId !== null) return;
    if (this.pending.size > 1) {
      const updates = [...this.pending.values()];
      const updateId = crypto.randomUUID();
      this.pending.clear();
      this.pending.set(updateId, {
        update: bytesToBase64(Y.mergeUpdates(updates.map(({ update }) => base64ToBytes(update)))),
        changeCount: updates.reduce((total, { changeCount }) => total + changeCount, 0)
      });
    }
    const pending = this.pending.entries().next().value as [string, PendingUpdate] | undefined;
    if (pending === undefined) return;
    const [updateId, { update }] = pending;
    this.inFlightUpdateId = updateId;
    this.socket.send(JSON.stringify({ contractId: STUDIO_CRDT_CONTRACT_ID, type: "update", updateId,
      generation: this.state.generation, update }));
  }

  private pendingChangeCount(): number {
    return [...this.pending.values()].reduce((total, { changeCount }) => total + changeCount, 0);
  }

  private setState(patch: Partial<StudioClientState>): void {
    this.state = { ...this.state, ...patch };
    for (const listener of this.listeners) listener(this.state);
  }
}
