import { AuthSession } from '@/core/store/AuthSession';
import { fail } from '@/core/shared/errors';
import { bindUserData } from '@/core/usecases/dataSession';
import { aUser, fakeAuthGateway } from '../usecases/fakeAuthGateway';
import { fakeBackend } from './fakeSync';

const fakeStore = () => {
  const calls: string[] = [];
  return {
    calls,
    store: { start: async () => void calls.push('start'), stop: () => void calls.push('stop') },
  };
};

const setup = (disconnect = fakeBackend()) => {
  const auth = fakeAuthGateway();
  const session = new AuthSession(auth.gateway);
  const { store, calls } = fakeStore();
  const errors: string[] = [];
  const unbind = bindUserData({
    session,
    store,
    backend: disconnect.backend,
    onError: (error) => errors.push(error.code),
  });
  session.start();
  return { auth, session, store, storeCalls: calls, backendCalls: disconnect.calls, errors, unbind };
};

describe('données liées à la session', () => {
  it('n’ouvre rien tant que personne n’est connecté ou que l’adresse n’est pas confirmée', () => {
    const { auth, storeCalls, backendCalls } = setup();
    auth.emit(null);
    auth.emit(aUser({ emailVerified: false }));
    expect(storeCalls).toEqual([]);
    expect(backendCalls).toEqual([]);
  });

  it('ouvre les données de l’utilisateur connecté, puis démarre le store', () => {
    const { auth, storeCalls, backendCalls } = setup();
    auth.emit(aUser({ id: 'owner-a' }));
    expect(backendCalls).toEqual([{ kind: 'connect', userId: 'owner-a' }]);
    expect(storeCalls).toEqual(['start']);
  });

  it('ne rouvre pas les données pour le même utilisateur', () => {
    const { auth, storeCalls } = setup();
    auth.emit(aUser({ id: 'owner-a' }));
    auth.emit(aUser({ id: 'owner-a', displayName: 'Jean' }));
    expect(storeCalls).toEqual(['start']);
  });

  it('arrête le store et efface les données de l’appareil à la déconnexion', async () => {
    const { auth, storeCalls, backendCalls } = setup();
    auth.emit(aUser({ id: 'owner-a' }));
    auth.emit(null);
    await vi.waitFor(() => expect(backendCalls.at(-1)).toEqual({ kind: 'disconnect' }));
    expect(storeCalls).toEqual(['start', 'stop']);
  });

  it('change de compte sans mélanger les données', async () => {
    const { auth, storeCalls, backendCalls } = setup();
    auth.emit(aUser({ id: 'owner-a' }));
    auth.emit(aUser({ id: 'partner-b' }));
    await vi.waitFor(() =>
      expect(backendCalls).toEqual([
        { kind: 'connect', userId: 'owner-a' },
        { kind: 'disconnect' },
        { kind: 'connect', userId: 'partner-b' },
      ]),
    );
    expect(storeCalls).toEqual(['start', 'stop', 'start']);
  });

  it('signale des données restées sur l’appareil', async () => {
    const { auth, errors } = setup(fakeBackend(fail('sync-local-data-not-cleared')));
    auth.emit(aUser({ id: 'owner-a' }));
    auth.emit(null);
    await vi.waitFor(() => expect(errors).toEqual(['sync-local-data-not-cleared']));
  });

  it('n’écoute plus la session une fois détaché', () => {
    const { auth, storeCalls, unbind } = setup();
    unbind();
    auth.emit(aUser({ id: 'owner-a' }));
    expect(storeCalls).toEqual([]);
  });
});
