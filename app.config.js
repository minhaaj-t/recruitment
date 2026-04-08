import 'dotenv/config';
import fs from 'fs';
import path from 'path';

/** Resolve env even if process.env was not populated before this file runs. */
function readEnvValue(key) {
  const fromProc = process.env[key]?.trim();
  if (fromProc) return fromProc;
  try {
    const envPath = path.join(process.cwd(), '.env');
    const text = fs.readFileSync(envPath, 'utf8');
    for (const line of text.split('\n')) {
      const s = line.trim();
      if (!s || s.startsWith('#')) continue;
      const i = s.indexOf('=');
      if (i === -1) continue;
      const k = s.slice(0, i).trim();
      if (k !== key) continue;
      let v = s.slice(i + 1).trim();
      if (
        (v.startsWith('"') && v.endsWith('"')) ||
        (v.startsWith("'") && v.endsWith("'"))
      ) {
        v = v.slice(1, -1);
      }
      return v;
    }
  } catch {
    /* no .env */
  }
  return '';
}

export default ({ config }) => ({
  ...config,
  extra: {
    ...config.extra,
    apiUrl: readEnvValue('EXPO_PUBLIC_API_URL'),
    socketUrl: readEnvValue('EXPO_PUBLIC_SOCKET_URL'),
  },
  plugins: [
    ...(config.plugins || []),
    [
      'expo-notifications',
      {
        icon: './assets/icon.png',
        color: '#1a237e',
        sounds: [],
      },
    ],
  ],
});
