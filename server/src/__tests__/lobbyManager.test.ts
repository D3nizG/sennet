import { describe, it, expect } from 'vitest';
import { LobbyManager } from '../services/lobbyManager.js';

const player = (id: string) => ({
  userId: id,
  socketId: `s-${id}`,
  displayName: `User ${id}`,
  houseColor: '#334455',
});

describe('LobbyManager', () => {
  it('creates lobbies and maps host by user', () => {
    const lm = new LobbyManager();
    const lobby = lm.create(player('host'));
    expect(lobby.host.userId).toBe('host');
    expect(lobby.status).toBe('waiting');
    expect(lm.getByUser('host')?.id).toBe(lobby.id);
    expect(lm.getByCode(lobby.code)?.id).toBe(lobby.id);
  });

  it('joins by code and transitions waiting -> ready', () => {
    const lm = new LobbyManager();
    const lobby = lm.create(player('host'));

    const joined = lm.joinByCode(lobby.code, player('guest'));
    expect(joined).not.toBeNull();
    expect(joined?.guest?.userId).toBe('guest');
    expect(joined?.status).toBe('ready');
    expect(lm.getByUser('guest')?.id).toBe(lobby.id);
  });

  it('rejects invalid join attempts', () => {
    const lm = new LobbyManager();
    const lobby = lm.create(player('host'));

    expect(lm.joinByCode('BADCODE', player('guest'))).toBeNull();
    expect(lm.joinByCode(lobby.code, player('host'))).toBeNull();

    lm.joinByCode(lobby.code, player('guest'));
    expect(lm.joinByCode(lobby.code, player('third'))).toBeNull();
  });

  it('starts games only when guest exists', () => {
    const lm = new LobbyManager();
    const noGuest = lm.create(player('h1'));
    expect(lm.startGame(noGuest.id)).toBeNull();

    const lobby = lm.create(player('h2'));
    lm.joinByCode(lobby.code, player('g2'));
    const started = lm.startGame(lobby.id);
    expect(started?.status).toBe('starting');
  });

  it('removes users and cleans up mappings correctly', () => {
    const lm = new LobbyManager();
    const lobby = lm.create(player('host'));
    lm.joinByCode(lobby.code, player('guest'));

    lm.removeUser('guest');
    const afterGuestLeave = lm.get(lobby.id)!;
    expect(afterGuestLeave.guest).toBeNull();
    expect(afterGuestLeave.status).toBe('waiting');

    lm.removeUser('host');
    expect(lm.get(lobby.id)).toBeNull();
    expect(lm.getByCode(lobby.code)).toBeNull();
  });

  it('removes full lobby explicitly', () => {
    const lm = new LobbyManager();
    const lobby = lm.create(player('host'));
    lm.joinByCode(lobby.code, player('guest'));
    lm.removeLobby(lobby.id);
    expect(lm.get(lobby.id)).toBeNull();
    expect(lm.getByUser('host')).toBeNull();
    expect(lm.getByUser('guest')).toBeNull();
  });
});
