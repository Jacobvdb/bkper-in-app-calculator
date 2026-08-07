import { describe, expect, it } from 'bun:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const logos = ['logo-light.svg', 'logo-dark.svg'];
const logoDirectory = resolve(process.cwd(), 'client/public/images');

function readLogo(name: string): string {
    return readFileSync(resolve(logoDirectory, name), 'utf8');
}

describe('calculator logos', () => {
    it('uses the four-color rounded diamond mark in both themes', () => {
        for (const name of logos) {
            const svg = readLogo(name);

            expect((svg.match(/transform="rotate\(45/g) ?? []).length).toBe(4);
            expect(svg).toContain('fill="#168bd1"');
            expect(svg).toContain('fill="#e84d36"');
            expect(svg).toContain('fill="#f4c20d"');
            expect(svg).toContain('fill="#3ab54a"');
        }
    });
});
