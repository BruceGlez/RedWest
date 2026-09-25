import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { findChrome } from './chrome-path.mjs';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const chromePath = findChrome();
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
const server = createServer(async (request, response) => {
    const pathname = new URL(request.url, 'http://localhost').pathname;
    const filePath = resolve(root, `.${pathname === '/' ? '/index.html' : pathname}`);
    if(filePath !== root && !filePath.startsWith(root + sep)) {
        response.writeHead(403).end();
        return;
    }
    try {
        const content = await readFile(filePath);
        response.writeHead(200, { 'content-type': mime[extname(filePath)] || 'application/octet-stream' }).end(content);
    } catch {
        response.writeHead(404).end();
    }
});
let browser;

try {
    await new Promise(resolveListen => server.listen(0, '127.0.0.1', resolveListen));
    browser = await chromium.launch({ executablePath: chromePath, headless: true, args: ['--enable-webgl', '--use-gl=angle', '--use-angle=swiftshader', '--no-proxy-server'] });
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    page.setDefaultTimeout(15000);
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if(message.type() === 'error') errors.push(message.text()); });
    page.on('requestfailed', request => errors.push(`${request.url()}: ${request.failure()?.errorText}`));
    await page.route('https://fonts.googleapis.com/**', route => route.abort());
    await page.route('https://fonts.gstatic.com/**', route => route.abort());
    await page.route('https://unpkg.com/three@0.160.0/build/three.module.js', async route => {
        const body = await readFile(resolve(root, 'node_modules/three/build/three.module.js'));
        await route.fulfill({ status: 200, contentType: 'text/javascript', headers: { 'access-control-allow-origin': '*' }, body });
    });
    await page.goto(`http://127.0.0.1:${server.address().port}/`, { waitUntil: 'commit', timeout: 30000 });
    await page.waitForTimeout(1000);
    try {
        await page.locator('canvas').waitFor();
    } catch {
        throw new Error(`Static page did not create a canvas: ${errors.join('; ')}`);
    }
    await page.keyboard.down('Space');
    await page.locator('#start-screen').waitFor({ state: 'hidden' });
    await page.keyboard.up('Space');
    assert.deepEqual(errors.filter(error => !error.includes('fonts.googleapis.com') && !error.includes('fonts.gstatic.com') && !error.includes('Failed to load resource')), []);
    console.log('Static-server smoke passed: Three.js loaded and Space starts the game.');
} finally {
    await browser?.close();
    await new Promise(resolveClose => server.close(resolveClose));
}
