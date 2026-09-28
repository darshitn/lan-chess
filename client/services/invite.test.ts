import { describe, it, expect } from 'vitest';
import { buildFullInviteText, buildLinkInviteText, buildRoomInviteUrl, getRoomCodeFromUrl } from './invite.js';

describe('invite service', () => {
  it('constructs full invite text with hostUrl and roomCode', () => {
    const text = buildFullInviteText('UY3J', 'http://192.168.1.71:3001');
    expect(text).toBe(
      'Join my LAN Chess game\n' +
      'Open: http://192.168.1.71:3001\n' +
      'Room code: UY3J\n' +
      'Make sure we are connected to the same Wi-Fi.'
    );
  });

  it('constructs full invite text when hostUrl is null (no IP detected)', () => {
    const text = buildFullInviteText('ABCD', null);
    expect(text).toBe(
      'Join my LAN Chess game\n' +
      'Room code: ABCD\n' +
      'Make sure we are connected to the same Wi-Fi.'
    );
  });

  it('constructs link-only text with hostUrl', () => {
    expect(buildLinkInviteText('http://192.168.1.71:3001')).toBe('http://192.168.1.71:3001');
  });

  it('constructs link-only text as empty string when hostUrl is null', () => {
    expect(buildLinkInviteText(null)).toBe('');
  });

  it('builds a LAN QR link that prefills the Join form', () => {
    expect(buildRoomInviteUrl('uy3j', 'http://192.168.1.71:3001'))
      .toBe('http://192.168.1.71:3001/?room=UY3J');
    expect(getRoomCodeFromUrl('?room=uy3j')).toBe('UY3J');
  });

  it('rejects malformed QR destinations and room query values', () => {
    expect(buildRoomInviteUrl('UY3J', null)).toBeNull();
    expect(buildRoomInviteUrl('UY3J', 'javascript:alert(1)')).toBeNull();
    expect(buildRoomInviteUrl('X', 'http://192.168.1.71:3001')).toBeNull();
    expect(getRoomCodeFromUrl('?room=%3Cscript%3E')).toBeNull();
  });
});
