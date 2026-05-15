import fs from 'fs';
import path from 'path';

const HISTORY_FILE = path.resolve('data/history.json');

export function logResult(entry) {
  let history = [];
  if (fs.existsSync(HISTORY_FILE)) {
    try {
      history = JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf8'));
    } catch {
      history = [];
    }
  }
  history.push(entry);
  fs.writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2));
}
