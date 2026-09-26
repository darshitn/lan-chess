import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { copyToClipboard } from './clipboard.js';

describe('clipboard service: copyToClipboard', () => {
  const originalNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  const originalDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');

  function setNavigator(val: unknown) {
    Object.defineProperty(globalThis, 'navigator', {
      value: val,
      configurable: true,
      writable: true,
    });
  }

  function setDocument(val: unknown) {
    Object.defineProperty(globalThis, 'document', {
      value: val,
      configurable: true,
      writable: true,
    });
  }

  function setWindow(val: unknown) {
    Object.defineProperty(globalThis, 'window', {
      value: val,
      configurable: true,
      writable: true,
    });
  }

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    if (originalNavigator) {
      Object.defineProperty(globalThis, 'navigator', originalNavigator);
    } else {
      // @ts-expect-error cleanup
      delete globalThis.navigator;
    }

    if (originalDocument) {
      Object.defineProperty(globalThis, 'document', originalDocument);
    } else {
      // @ts-expect-error cleanup
      delete globalThis.document;
    }

    if (originalWindow) {
      Object.defineProperty(globalThis, 'window', originalWindow);
    } else {
      // @ts-expect-error cleanup
      delete globalThis.window;
    }
  });

  it('rejects empty or non-string input immediately', async () => {
    const resEmpty = await copyToClipboard('');
    expect(resEmpty.success).toBe(false);

    // @ts-expect-error test invalid input
    const resNull = await copyToClipboard(null);
    expect(resNull.success).toBe(false);
  });

  it('uses Electron desktop bridge when available and successful', async () => {
    const copyTextMock = vi.fn().mockResolvedValue(true);
    setWindow({
      desktop: {
        copyText: copyTextMock,
      },
    });
    setNavigator(undefined);
    setDocument(undefined);

    const result = await copyToClipboard('test invite text');
    expect(copyTextMock).toHaveBeenCalledWith('test invite text');
    expect(result).toEqual({ success: true, method: 'desktop' });
  });

  it('falls back to browser clipboard API if Electron copyText returns false', async () => {
    const copyTextMock = vi.fn().mockResolvedValue(false);
    const writeTextMock = vi.fn().mockResolvedValue(undefined);

    setWindow({
      desktop: {
        copyText: copyTextMock,
      },
    });
    setNavigator({
      clipboard: {
        writeText: writeTextMock,
      },
    });

    const result = await copyToClipboard('test text');
    expect(copyTextMock).toHaveBeenCalled();
    expect(writeTextMock).toHaveBeenCalledWith('test text');
    expect(result).toEqual({ success: true, method: 'navigator' });
  });

  it('succeeds via navigator.clipboard.writeText when browser API is functional', async () => {
    setWindow({});
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    setNavigator({
      clipboard: {
        writeText: writeTextMock,
      },
    });

    const result = await copyToClipboard('http://192.168.1.71:3001');
    expect(writeTextMock).toHaveBeenCalledWith('http://192.168.1.71:3001');
    expect(result).toEqual({ success: true, method: 'navigator' });
  });

  it('falls back to document.execCommand when navigator.clipboard.writeText rejects', async () => {
    setWindow({});
    const writeTextMock = vi.fn().mockRejectedValue(new Error('Permission denied'));
    setNavigator({
      clipboard: {
        writeText: writeTextMock,
      },
    });

    const execCommandMock = vi.fn().mockReturnValue(true);
    const dummyTextarea = {
      value: '',
      setAttribute: vi.fn(),
      style: {},
      focus: vi.fn(),
      select: vi.fn(),
      parentNode: {
        removeChild: vi.fn(),
      },
    };
    const createElementMock = vi.fn().mockReturnValue(dummyTextarea);
    const appendChildMock = vi.fn();

    setDocument({
      createElement: createElementMock,
      body: {
        appendChild: appendChildMock,
        removeChild: dummyTextarea.parentNode.removeChild,
      },
      execCommand: execCommandMock,
    });

    const result = await copyToClipboard('fallback text');
    expect(writeTextMock).toHaveBeenCalled();
    expect(createElementMock).toHaveBeenCalledWith('textarea');
    expect(dummyTextarea.value).toBe('fallback text');
    expect(execCommandMock).toHaveBeenCalledWith('copy');
    expect(result).toEqual({ success: true, method: 'legacy' });
  });

  it('returns failure when all clipboard methods fail', async () => {
    setWindow({});
    setNavigator({
      clipboard: {
        writeText: vi.fn().mockRejectedValue(new Error('Blocked')),
      },
    });

    const execCommandMock = vi.fn().mockReturnValue(false);
    const dummyTextarea = {
      value: '',
      setAttribute: vi.fn(),
      style: {},
      focus: vi.fn(),
      select: vi.fn(),
      parentNode: {
        removeChild: vi.fn(),
      },
    };

    setDocument({
      createElement: vi.fn().mockReturnValue(dummyTextarea),
      body: {
        appendChild: vi.fn(),
        removeChild: dummyTextarea.parentNode.removeChild,
      },
      execCommand: execCommandMock,
    });

    const result = await copyToClipboard('fail text');
    expect(result.success).toBe(false);
  });
});
