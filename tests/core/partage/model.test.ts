import { invitationExpiry, invitationStatus, type Invitation } from '@/core/partage/model';

const invitation = (patch: Partial<Invitation> = {}): Invitation => ({
  token: 'k3Jd9xQ2mZ7vN4pL8sT1wY6bR0cF5hGa',
  workspaceId: 'commun-ab',
  workspaceName: 'Commun',
  ownerId: 'owner-a',
  expiresAt: '2026-11-21T10:00:00.000Z',
  usedBy: null,
  ...patch,
});

describe('invitation', () => {
  it('expire un peu avant 7 jours, pour tolérer une horloge en avance', () => {
    const now = new Date('2026-11-14T10:00:00.000Z');
    const expiry = invitationExpiry(now);
    const days = (expiry.getTime() - now.getTime()) / 86400000;
    expect(days).toBeLessThan(7);
    expect(days).toBeGreaterThan(6.9);
  });

  it('est valable, expirée ou déjà utilisée', () => {
    expect(invitationStatus(invitation(), new Date('2026-11-20T10:00:00.000Z'))).toBe('valid');
    expect(invitationStatus(invitation(), new Date('2026-11-21T10:00:00.000Z'))).toBe('expired');
    expect(invitationStatus(invitation({ usedBy: 'partner-b' }), new Date('2026-11-15T10:00:00.000Z'))).toBe(
      'used',
    );
  });
});
