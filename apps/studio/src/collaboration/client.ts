import { STUDIO_CRDT_CONTRACT_ID, type StudioCrdtV1, type StudioSaveStateV1, type StudioValidationReportV1 } from "@plenum/event-contracts";
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

export class StudioCollaborationClient {
  readonly document = new Y.Doc();
  private readonly pending = new Map<string, string>();
  private readonly listeners = new Set<(state: StudioClientState) => void>();
  private socket: WebSocket | null = null;
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
      this.pending.set(updateId, bytesToBase64(update));
      this.setState({ saveState: "saved_on_device", unsynchronizedChanges: this.pending.size, message: null });
      if (!navigator.onLine) this.socket?.close(1001, "Browser offline");
      else this.flush();
    });
    window.addEventListener("offline", this.offline);
    window.addEventListener("online", this.online);
  }

  connect(): void {
    if (this.socket !== null) return;
    this.stopped = false;
    const scheme = location.protocol === "https:" ? "wss:" : "ws:";
    const socket = new WebSocket(`${scheme}//${location.host}/v1/projects/${this.projectId}/collaboration`);
    this.socket = socket;
    socket.addEventListener("open", () => { if (this.socket === socket) this.setState({ connected: true, message: null }); });
    socket.addEventListener("message", (event) => { if (this.socket === socket) this.receive(JSON.parse(String(event.data)) as StudioCrdtV1); });
    socket.addEventListener("close", () => {
      if (this.socket !== null && this.socket !== socket) return;
      if (this.socket === socket) this.socket = null;
      this.setState({ connected: false, saveState: this.pending.size > 0 ? "saved_on_device" : this.state.saveState,
        message: "Connection lost. Changes remain in this tab and will retry automatically." });
      if (!this.stopped) this.reconnectTimer = window.setTimeout(() => this.connect(), 1000);
    });
  }

  stop(): void {
    this.stopped = true;
    if (this.reconnectTimer !== null) window.clearTimeout(this.reconnectTimer);
    this.socket?.close(1000, "Studio closed");
    window.removeEventListener("offline", this.offline);
    window.removeEventListener("online", this.online);
    this.document.destroy();
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

  setScenarioField(field: "name" | "description", value: string): void {
    const scenario = this.document.getMap("draft").get("scenario");
    if (scenario instanceof Y.Map) scenario.set(field, value);
  }

  markPublished(): void {
    this.setState({ saveState: "published", message: "The frozen Draft was published." });
  }

  private receive(message: StudioCrdtV1): void {
    if (message.contractId !== STUDIO_CRDT_CONTRACT_ID) return;
    if ((message.type === "sync" || message.type === "remote_update") && message.update !== null) {
      Y.applyUpdate(this.document, base64ToBytes(message.update), REMOTE);
    }
    if (message.type === "ack" && message.updateId !== null) this.pending.delete(message.updateId);
    this.setState({
      generation: message.generation,
      validation: message.validation ?? this.state.validation,
      saveState: this.pending.size > 0 ? "saved_on_device" : message.saveState ?? this.state.saveState,
      unsynchronizedChanges: this.pending.size,
      message: message.message
    });
    this.flush();
  }

  private flush(): void {
    if (this.socket?.readyState !== WebSocket.OPEN) return;
    for (const [updateId, update] of this.pending) {
      this.socket.send(JSON.stringify({ contractId: STUDIO_CRDT_CONTRACT_ID, type: "update", updateId,
        generation: this.state.generation, update }));
    }
  }

  private setState(patch: Partial<StudioClientState>): void {
    this.state = { ...this.state, ...patch };
    for (const listener of this.listeners) listener(this.state);
  }
}
