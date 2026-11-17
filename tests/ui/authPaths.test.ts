import { emailFrom, noticeFrom } from '@/ui/routing/authPaths';

describe('état transmis entre écrans de connexion', () => {
  it('lit l’adresse transmise', () => {
    expect(emailFrom({ email: 'jean.d@example.com' })).toBe('jean.d@example.com');
    expect(emailFrom(null)).toBe('');
  });

  it('lit un message connu', () => {
    expect(noticeFrom({ notice: 'email-verified' })).toBe('email-verified');
    expect(noticeFrom({ email: 'jean.d@example.com', notice: 'password-reset' })).toBe('password-reset');
  });

  it('ignore un message absent ou inconnu', () => {
    expect(noticeFrom(null)).toBeNull();
    expect(noticeFrom({ email: 'jean.d@example.com' })).toBeNull();
    expect(noticeFrom({ notice: 'autre' })).toBeNull();
    expect(noticeFrom({ notice: 42 })).toBeNull();
  });
});
