import { randomUUID } from "node:crypto";
import type { IncomingMessage } from "node:http";
import type { Duplex } from "node:stream";

import { STUDIO_CRDT_CONTRACT_ID, type StudioCrdtV1 } from "@plenum/event-contracts";
import type { Pool } from "pg";
import { WebSocketServer, WebSocket, type RawData } from "ws";

import { AuthorizationError } from "../../errors.js";
import type { AuthenticatedPrincipal } from "../../identity/login.js";
import { applyStudioUpdate, assertStudioSyncAccess, getCollaborativeDraft, studioSyncEnvelope } from "./service.js";

const MAX_SOCKET_MESSAGE_BYTES = 384 * 1024;
const projectPath = /^\/v1\/projects\/([0-9a-f-]+)\/collaboration$/iu;

interface Peer {
  socket: WebSocket;
  principal: AuthenticatedPrincipal;
  projectId: string;
  documentId: string;
  connectionId: string;
}

export interface StudioCollaborationGatewayOptions {
  pool: Pool;
  authenticate(request: IncomingMessage, correlationId: string): Promise<AuthenticatedPrincipal>;
}

function send(socket: WebSocket, message: StudioCrdtV1): void {
  if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message));
}

function rejectUpgrade(socket: Duplex, status: 401 | 404): void {
  socket.write(`HTTP/1.1 ${status} ${status === 401 ? "Unauthorized" : "Not Found"}\r\nConnection: close\r\n\r\n`);
  socket.destroy();
}

function updateMessage(value: RawData): { updateId: string; generation: number; update: string } {
  const parsed: unknown = JSON.parse(value.toString());
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) throw new Error("object required");
  const message = parsed as Record<string, unknown>;
  if (message.type !== "update" || typeof message.updateId !== "string" || typeof message.update !== "string" ||
      !Number.isSafeInteger(message.generation)) throw new Error("update envelope required");
  return { updateId: message.updateId, generation: Number(message.generation), update: message.update };
}

export function createStudioCollaborationGateway(options: StudioCollaborationGatewayOptions) {
  const webSockets = new WebSocketServer({ noServer: true, maxPayload: MAX_SOCKET_MESSAGE_BYTES, perMessageDeflate: false });
  const peers = new Map<string, Set<Peer>>();

  async function broadcast(sender: Peer, message: StudioCrdtV1): Promise<void> {
    for (const peer of peers.get(sender.documentId) ?? []) {
      if (peer === sender) continue;
      try {
        await assertStudioSyncAccess(options.pool, peer.principal, peer.projectId, randomUUID());
        send(peer.socket, message);
      } catch {
        peer.socket.close(1008, "Studio access revoked");
      }
    }
  }

  function connected(socket: WebSocket, principal: AuthenticatedPrincipal, projectId: string,
    documentId: string, sync: StudioCrdtV1): void {
    const peer: Peer = { socket, principal, projectId, documentId, connectionId: randomUUID() };
    const documentPeers = peers.get(documentId) ?? new Set<Peer>();
    documentPeers.add(peer);
    peers.set(documentId, documentPeers);
    send(socket, sync);
    socket.on("message", async (raw) => {
      const correlationId = randomUUID();
      try {
        const message = updateMessage(raw);
        const state = await applyStudioUpdate(options.pool, principal, {
          projectId, updateId: message.updateId, connectionId: peer.connectionId,
          expectedGeneration: message.generation, update: message.update
        }, correlationId);
        const ack: StudioCrdtV1 = {
          contractId: STUDIO_CRDT_CONTRACT_ID, type: "ack", documentId, generation: state.generation,
          updateId: message.updateId, update: null, stateVector: state.stateVector,
          saveState: state.validation.valid ? "synchronized" : "validation_required",
          unsynchronizedChanges: 0, validation: state.validation, message: null
        };
        send(socket, ack);
        await broadcast(peer, { ...ack, type: "remote_update", updateId: null, update: message.update });
      } catch (error) {
        send(socket, {
          contractId: STUDIO_CRDT_CONTRACT_ID, type: "error", documentId, generation: 1,
          updateId: null, update: null, stateVector: null, saveState: null, unsynchronizedChanges: 0,
          validation: null, message: error instanceof AuthorizationError ? error.envelope.error.message : "The Studio update was rejected."
        });
        socket.close(1008, "Invalid or unauthorized Studio update");
      }
    });
    socket.on("close", () => {
      documentPeers.delete(peer);
      if (documentPeers.size === 0) peers.delete(documentId);
    });
    socket.on("error", () => undefined);
  }

  return {
    async handleUpgrade(request: IncomingMessage, socket: Duplex, head: Buffer): Promise<boolean> {
      const match = new URL(request.url ?? "/", "http://localhost").pathname.match(projectPath);
      if (match === null) return false;
      const projectId = match[1];
      if (projectId === undefined) { rejectUpgrade(socket, 404); return true; }
      const correlationId = randomUUID();
      try {
        const principal = await options.authenticate(request, correlationId);
        await assertStudioSyncAccess(options.pool, principal, projectId, correlationId);
        const state = await getCollaborativeDraft(options.pool, principal, projectId, correlationId);
        webSockets.handleUpgrade(request, socket, head, (webSocket) => connected(
          webSocket, principal, projectId, state.documentId, studioSyncEnvelope(state)
        ));
      } catch {
        rejectUpgrade(socket, 401);
      }
      return true;
    },
    close(): Promise<void> {
      for (const client of webSockets.clients) client.close(1001, "Server shutting down");
      return new Promise((resolve) => webSockets.close(() => resolve()));
    }
  };
}
