import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';

const ROOT = resolve(__dirname, '..');

function resolveShellPath(entry: string): string {
  const relative = entry === '/' ? 'public/index.html' : `public${entry}`;
  return resolve(ROOT, relative);
}

describe('service worker precache list', () => {
  it('every SHELL_FILES entry resolves to a file that exists on disk', () => {
    const swSource = readFileSync(resolve(ROOT, 'public/sw.js'), 'utf8');

    const arrayMatch = swSource.match(/SHELL_FILES\s*=\s*\[([\s\S]*?)\]/);
    expect(arrayMatch).not.toBeNull();

    const listBody = arrayMatch![1];
    const entries = [...listBody.matchAll(/'([^']+)'/g)].map((m) => m[1]);

    expect(entries.length).toBeGreaterThan(0);

    for (const entry of entries) {
      const filePath = resolveShellPath(entry);
      expect(existsSync(filePath), `expected ${filePath} (from SHELL_FILES entry "${entry}") to exist`).toBe(true);
    }
  });
});

describe('manifest icons', () => {
  it('every icon file exists and its real PNG dimensions match its declared sizes', () => {
    const manifestSource = readFileSync(resolve(ROOT, 'public/manifest.webmanifest'), 'utf8');
    const manifest = JSON.parse(manifestSource) as {
      icons: Array<{ src: string; sizes: string }>;
    };

    expect(manifest.icons.length).toBeGreaterThan(0);

    for (const icon of manifest.icons) {
      const filePath = resolve(ROOT, `public${icon.src}`);
      expect(existsSync(filePath), `expected icon file ${filePath} to exist`).toBe(true);

      const buffer = readFileSync(filePath);
      const width = buffer.readUInt32BE(16);
      const height = buffer.readUInt32BE(20);

      const [declaredWidth, declaredHeight] = icon.sizes.split('x').map(Number);

      expect(
        `${width}x${height}`,
        `icon ${icon.src} declares sizes "${icon.sizes}" but actual PNG dimensions are ${width}x${height}`,
      ).toBe(`${declaredWidth}x${declaredHeight}`);
    }
  });
});
