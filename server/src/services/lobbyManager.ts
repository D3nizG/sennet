import { generateCode } from '../utils/rng.js';

export interface LobbyPlayer {
  userId: string;
  socketId: string;
  displayName: string;
  houseColor: string;
}

export interface Lobby {
  id: string;
  code: string;
  host: LobbyPlayer;
  guest: LobbyPlayer | null;
  status: 'waiting' | 'ready' | 'starting';
  createdAt: number;
}

export class LobbyManager {
  private lobbies = new Map<string, Lobby>();
  private codeToId = new Map<string, string>();
  private userToLobby = new Map<string, string>();

  create(host: LobbyPlayer): Lobby {
    // Remove from any existing lobby first
    this.removeUser(host.userId);

    const id = crypto.randomUUID();
    const code = generateCode();
    const lobby: Lobby = {
      id,
      code,
      host,
      guest: null,
      status: 'waiting',
      createdAt: Date.now(),
    };
    this.lobbies.set(id, lobby);
    this.codeToId.set(code, id);
    this.userToLobby.set(host.userId, id);
    return lobby;
  }

  joinByCode(code: string, guest: LobbyPlayer): Lobby | null {
    const id = this.codeToId.get(code);
    if (!id) return null;
    const lobby = this.lobbies.get(id);
    if (!lobby || lobby.guest || lobby.status !== 'waiting') return null;
    if (lobby.host.userId === guest.userId) return null;

    this.removeUser(guest.userId);
    lobby.guest = guest;
    lobby.status = 'ready';
    this.userToLobby.set(guest.userId, id);
    return lobby;
  }

  get(lobbyId: string): Lobby | null {
    return this.lobbies.get(lobbyId) ?? null;
  }

  getByUser(userId: string): Lobby | null {
    const id = this.userToLobby.get(userId);
    return id ? this.lobbies.get(id) ?? null : null;
  }

  getByCode(code: string): Lobby | null {
    const id = this.codeToId.get(code);
    return id ? this.lobbies.get(id) ?? null : null;
  }

  startGame(lobbyId: string): Lobby | null {
    const lobby = this.lobbies.get(lobbyId);
    if (!lobby || !lobby.guest) return null;
    lobby.status = 'starting';
    return lobby;
  }

  removeUser(userId: string): void {
    const lobbyId = this.userToLobby.get(userId);
    if (!lobbyId) return;

    const lobby = this.lobbies.get(lobbyId);
    if (!lobby) return;

    if (lobby.host.userId === userId) {
      // Host left — destroy lobby
      if (lobby.guest) {
        this.userToLobby.delete(lobby.guest.userId);
      }
      this.lobbies.delete(lobbyId);
      this.codeToId.delete(lobby.code);
    } else if (lobby.guest?.userId === userId) {
      lobby.guest = null;
      lobby.status = 'waiting';
    }
    this.userToLobby.delete(userId);
  }

  removeLobby(lobbyId: string): void {
    const lobby = this.lobbies.get(lobbyId);
    if (!lobby) return;
    this.userToLobby.delete(lobby.host.userId);
    if (lobby.guest) this.userToLobby.delete(lobby.guest.userId);
    this.codeToId.delete(lobby.code);
    this.lobbies.delete(lobbyId);
  }
}
