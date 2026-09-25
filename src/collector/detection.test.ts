import { describe, expect, it } from 'vitest';
import { classifyUrl } from './detection';

describe('classifyUrl', () => {
  it('recognizes the feed', () => {
    expect(classifyUrl('https://www.linkedin.com/feed/')).toBe('feed');
    expect(classifyUrl('https://www.linkedin.com/feed/update/urn:li:activity:1/')).toBe('feed');
  });

  it('recognizes a checkpoint/CAPTCHA challenge', () => {
    expect(classifyUrl('https://www.linkedin.com/checkpoint/challenge/')).toBe('checkpoint');
    expect(classifyUrl('https://www.linkedin.com/checkpoint/rc/request')).toBe('checkpoint');
  });

  it('recognizes a login wall', () => {
    expect(classifyUrl('https://www.linkedin.com/login')).toBe('login_wall');
    expect(classifyUrl('https://www.linkedin.com/uas/login?session_redirect=%2Ffeed')).toBe(
      'login_wall',
    );
  });

  it('falls back to unknown for anything else', () => {
    expect(classifyUrl('https://www.linkedin.com/mypreferences/d/settings/account')).toBe(
      'unknown',
    );
    expect(classifyUrl('about:blank')).toBe('unknown');
  });
});
