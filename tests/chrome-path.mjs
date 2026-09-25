import { existsSync } from 'node:fs';

const CANDIDATES = {
    win32: ['C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe'],
    darwin: ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/Applications/Chromium.app/Contents/MacOS/Chromium'],
    linux: ['/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser']
};

export function findChrome() {
    if(process.env.CHROME_PATH) return process.env.CHROME_PATH;
    const found = (CANDIDATES[process.platform] || []).find(path => existsSync(path));
    if(!found) throw new Error('No Chrome or Chromium found; set CHROME_PATH to a Chromium executable.');
    return found;
}
