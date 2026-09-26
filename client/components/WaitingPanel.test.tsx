import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { WaitingPanel } from './WaitingPanel.js';

describe('WaitingPanel component', () => {
  it('renders host URL and room code when hostUrl is provided', () => {
    const html = renderToStaticMarkup(
      <WaitingPanel roomCode="UY3J" hostUrl="http://192.168.1.71:3001" />
    );

    expect(html).toContain('UY3J');
    expect(html).toContain('http://192.168.1.71:3001');
    expect(html).toContain('Waiting for an opponent');
    expect(html).toContain('Connect the other device to the same Wi-Fi');
    expect(html).toContain('Guest or public Wi-Fi networks may block communication');
    expect(html).not.toContain('No local network IP detected');
  });

  it('renders fallback explanation when hostUrl is null', () => {
    const html = renderToStaticMarkup(
      <WaitingPanel roomCode="K9XZ" hostUrl={null} />
    );

    expect(html).toContain('K9XZ');
    expect(html).toContain('No local network IP detected. Ensure this host device is connected to Wi-Fi or Ethernet.');
    expect(html).not.toContain('http://192.168.1.71:3001');
  });

  it('displays custom fallback port if server used a fallback port', () => {
    const html = renderToStaticMarkup(
      <WaitingPanel roomCode="TEST" hostUrl="http://192.168.1.55:54321" />
    );

    expect(html).toContain('http://192.168.1.55:54321');
  });
});
