import type { Credential } from '@/types';

/**
 * Parses CSV lines correctly taking care of quotes and commas
 */
function parseCSV(text: string): string[][] {
  const result: string[][] = [];
  let row: string[] = [];
  let inQuotes = false;
  let currentValue = '';

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        currentValue += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      row.push(currentValue.trim());
      currentValue = '';
    } else if ((char === '\r' || char === '\n') && !inQuotes) {
      if (char === '\r' && nextChar === '\n') i++;
      row.push(currentValue.trim());
      result.push(row);
      row = [];
      currentValue = '';
    } else {
      currentValue += char;
    }
  }

  if (currentValue || row.length > 0) {
    row.push(currentValue.trim());
    result.push(row);
  }

  return result.filter(r => r.length > 0 && r.some(cell => cell !== ''));
}

type ImportedCredential = Omit<Credential, 'id' | 'createdAt' | 'updatedAt'>;

// ─── GENERIC CSV IMPORT (40+ Password Managers) ──────────────────────────────

/**
 * Maps dynamically detected headers to SafeVault credential keys.
 * Supports 40+ password managers: Bitwarden, ProtonPass, Brave, Chrome, 
 * Safari, LastPass, 1Password, Dashlane, Keeper, NordPass, RoboForm, etc.
 */
export function importFromCSV(csvText: string): ImportedCredential[] {
  const rows = parseCSV(csvText);
  if (rows.length < 2) throw new Error('CSV file must contain a header row and at least one data row.');

  const headers = rows[0].map(h => h.toLowerCase().trim());
  const dataRows = rows.slice(1);

  let titleIdx = -1, usernameIdx = -1, passwordIdx = -1, urlIdx = -1;
  let notesIdx = -1, totpIdx = -1, categoryIdx = -1;

  const titleKeys    = ['title', 'name', 'login_name', 'label', 'heading', 'item name', 'account name'];
  const usernameKeys = ['username', 'login_username', 'email', 'user', 'user name', 'login', 'id', 'login name'];
  const passwordKeys = ['password', 'login_password', 'pass', 'code', 'secret', 'passwd'];
  const urlKeys      = ['url', 'uri', 'login_uri', 'website', 'web', 'link', 'login_url', 'site'];
  const notesKeys    = ['notes', 'note', 'extra', 'comments', 'description', 'comment'];
  const totpKeys     = ['totp', 'login_totp', 'totp_secret', 'two-factor', 'otp', 'totpsecret', 'authenticator', '2fa'];
  const categoryKeys = ['category', 'folder', 'type', 'group', 'tag', 'collection'];

  headers.forEach((header, index) => {
    if (titleKeys.includes(header)    && titleIdx    === -1) titleIdx    = index;
    else if (usernameKeys.includes(header) && usernameIdx === -1) usernameIdx = index;
    else if (passwordKeys.includes(header) && passwordIdx === -1) passwordIdx = index;
    else if (urlKeys.includes(header)      && urlIdx      === -1) urlIdx      = index;
    else if (notesKeys.includes(header)    && notesIdx    === -1) notesIdx    = index;
    else if (totpKeys.includes(header)     && totpIdx     === -1) totpIdx     = index;
    else if (categoryKeys.includes(header) && categoryIdx === -1) categoryIdx = index;
  });

  // Fuzzy fallback
  headers.forEach((header, index) => {
    if (titleIdx    === -1 && (header.includes('name') || header.includes('title'))) titleIdx    = index;
    if (usernameIdx === -1 && (header.includes('user') || header.includes('mail')))  usernameIdx = index;
    if (passwordIdx === -1 && header.includes('pass'))                                passwordIdx = index;
    if (urlIdx      === -1 && (header.includes('url') || header.includes('site') || header.includes('uri'))) urlIdx = index;
    if (totpIdx     === -1 && (header.includes('totp') || header.includes('otp')))  totpIdx     = index;
  });

  // Position fallback
  if (titleIdx === -1 && passwordIdx === -1) {
    titleIdx = 0; urlIdx = 1; usernameIdx = 2; passwordIdx = 3; notesIdx = 4; totpIdx = 5; categoryIdx = 6;
  }

  return dataRows.map(row => ({
    title:      titleIdx    !== -1 && row[titleIdx]    ? row[titleIdx]    : 'Imported Credential',
    url:        urlIdx      !== -1 && row[urlIdx]      ? row[urlIdx]      : '',
    username:   usernameIdx !== -1 && row[usernameIdx] ? row[usernameIdx] : '',
    password:   passwordIdx !== -1 && row[passwordIdx] ? row[passwordIdx] : '',
    notes:      notesIdx    !== -1 && row[notesIdx]    ? row[notesIdx]    : '',
    totpSecret: totpIdx     !== -1 && row[totpIdx]     ? row[totpIdx].replace(/\s/g, '') : '',
    category:   categoryIdx !== -1 && row[categoryIdx] ? row[categoryIdx] : 'Imported',
    favorite: false,
  }));
}

// ─── 1PASSWORD JSON IMPORT ────────────────────────────────────────────────────

interface OnePasswordItem {
  title?: string;
  category?: string;
  urls?: { href?: string }[];
  fields?: {
    id?: string;
    label?: string;
    type?: string;
    value?: string;
    purpose?: string;
  }[];
  notes?: string;
  tags?: string[];
}

interface OnePasswordExport {
  accounts?: { vaults?: { items?: OnePasswordItem[] }[] }[];
  items?: OnePasswordItem[];
}

export function importFrom1Password(jsonText: string): ImportedCredential[] {
  let data: OnePasswordExport;
  try { data = JSON.parse(jsonText); } catch { throw new Error('Invalid 1Password JSON file.'); }

  // 1Password exports: accounts[].vaults[].items[] OR top-level items[]
  let items: OnePasswordItem[] = [];
  if (data.accounts) {
    data.accounts.forEach(acc =>
      acc.vaults?.forEach(vault => { if (vault.items) items.push(...vault.items); })
    );
  } else if (Array.isArray(data.items)) {
    items = data.items;
  } else if (Array.isArray(data)) {
    items = data as unknown as OnePasswordItem[];
  }

  return items.map((item): ImportedCredential => {
    const fields = item.fields || [];
    const getField = (ids: string[]) =>
      fields.find(f => ids.some(id => f.id === id || (f.label?.toLowerCase() ?? '') === id))?.value ?? '';

    const username = getField(['username', 'email']) ||
      fields.find(f => f.purpose === 'USERNAME')?.value || '';
    const password = getField(['password']) ||
      fields.find(f => f.purpose === 'PASSWORD')?.value || '';
    const totp = fields.find(f => f.type === 'OTP')?.value || '';
    const url = item.urls?.[0]?.href || '';
    const category = item.tags?.[0] || item.category || 'Imported';

    return {
      title: item.title || 'Imported',
      url,
      username,
      password,
      notes: item.notes || '',
      totpSecret: totp.replace(/\s/g, ''),
      category,
      favorite: false,
    };
  });
}

// ─── BITWARDEN JSON IMPORT ────────────────────────────────────────────────────

interface BitwardenLogin {
  username?: string | null;
  password?: string | null;
  uris?: { uri?: string }[];
  totp?: string | null;
}

interface BitwardenItem {
  name?: string;
  login?: BitwardenLogin;
  notes?: string | null;
  folderId?: string | null;
  type?: number;
}

interface BitwardenExport {
  items?: BitwardenItem[];
  folders?: { id?: string; name?: string }[];
}

export function importFromBitwarden(jsonText: string): ImportedCredential[] {
  let data: BitwardenExport;
  try { data = JSON.parse(jsonText); } catch { throw new Error('Invalid Bitwarden JSON file.'); }

  if (!data.items) throw new Error('Bitwarden JSON has no items array. Export as unencrypted JSON.');

  // Build folder id→name map
  const folderMap: Record<string, string> = {};
  (data.folders || []).forEach(f => { if (f.id && f.name) folderMap[f.id] = f.name; });

  return data.items
    .filter(item => item.type === 1 || item.login) // type 1 = Login
    .map((item): ImportedCredential => ({
      title:      item.name || 'Imported',
      url:        item.login?.uris?.[0]?.uri || '',
      username:   item.login?.username || '',
      password:   item.login?.password || '',
      notes:      item.notes || '',
      totpSecret: (item.login?.totp || '').replace(/\s/g, ''),
      category:   (item.folderId && folderMap[item.folderId]) || 'Imported',
      favorite: false,
    }));
}

// ─── LASTPASS CSV IMPORT ──────────────────────────────────────────────────────

/**
 * LastPass CSV export format:
 * url,username,password,totp,extra,name,grouping,fav
 */
export function importFromLastPass(csvText: string): ImportedCredential[] {
  const rows = parseCSV(csvText);
  if (rows.length < 2) throw new Error('Invalid LastPass CSV.');

  const headers = rows[0].map(h => h.toLowerCase().trim());
  const dataRows = rows.slice(1);

  const idx = (keys: string[]) => keys.reduce((found, k) => found !== -1 ? found : headers.indexOf(k), -1);

  const urlIdx      = idx(['url']);
  const userIdx     = idx(['username', 'login']);
  const passIdx     = idx(['password', 'pass']);
  const totpIdx     = idx(['totp', 'otp', 'two_factor']);
  const notesIdx    = idx(['extra', 'notes', 'note', 'comment']);
  const nameIdx     = idx(['name', 'title', 'label']);
  const groupIdx    = idx(['grouping', 'folder', 'group', 'category']);

  return dataRows.map((row): ImportedCredential => ({
    title:      nameIdx    >= 0 ? (row[nameIdx] || 'Imported') : 'Imported',
    url:        urlIdx     >= 0 ? (row[urlIdx]  || '') : '',
    username:   userIdx    >= 0 ? (row[userIdx] || '') : '',
    password:   passIdx    >= 0 ? (row[passIdx] || '') : '',
    notes:      notesIdx   >= 0 ? (row[notesIdx] || '') : '',
    totpSecret: totpIdx    >= 0 ? (row[totpIdx]  || '').replace(/\s/g, '') : '',
    category:   groupIdx   >= 0 ? (row[groupIdx] || 'Imported') : 'Imported',
    favorite: false,
  }));
}

// ─── KEEPASS XML IMPORT ───────────────────────────────────────────────────────

export function importFromKeePass(xmlText: string): ImportedCredential[] {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlText, 'text/xml');

    if (doc.querySelector('parsererror')) throw new Error('Invalid XML');

    const entries = Array.from(doc.querySelectorAll('Entry'));

    return entries.map((entry): ImportedCredential => {
      const getVal = (key: string) =>
        Array.from(entry.querySelectorAll('String'))
          .find(s => s.querySelector('Key')?.textContent?.toLowerCase() === key.toLowerCase())
          ?.querySelector('Value')?.textContent || '';

      // KeePass group path as category
      const groupEl = entry.closest('Group');
      const category = groupEl?.querySelector(':scope > Name')?.textContent || 'Imported';

      return {
        title:      getVal('Title') || 'Imported',
        url:        getVal('URL'),
        username:   getVal('UserName'),
        password:   getVal('Password'),
        notes:      getVal('Notes'),
        totpSecret: getVal('TOTP') || getVal('otp') || '',
        category,
        favorite: false,
      };
    }).filter(c => c.title !== 'Imported' || c.password !== ''); // Filter empty entries
  } catch {
    throw new Error('Invalid KeePass XML file. Export as KeePass XML format.');
  }
}

// ─── CHROME / EDGE JSON IMPORT ────────────────────────────────────────────────

interface ChromePasswordEntry {
  name?: string;
  url?: string;
  username?: string;
  password?: string;
  note?: string;
}

export function importFromChrome(jsonText: string): ImportedCredential[] {
  let data: ChromePasswordEntry[];
  try { data = JSON.parse(jsonText); } catch { throw new Error('Invalid Chrome JSON file.'); }
  if (!Array.isArray(data)) throw new Error('Chrome JSON should be an array of passwords.');

  return data.map((item): ImportedCredential => ({
    title:      item.name || item.url || 'Imported',
    url:        item.url || '',
    username:   item.username || '',
    password:   item.password || '',
    notes:      item.note || '',
    totpSecret: '',
    category:   'Imported',
    favorite: false,
  }));
}

// ─── AUTO-DETECT FORMAT ───────────────────────────────────────────────────────

export type ImportFormat = 'csv' | '1password' | 'bitwarden' | 'lastpass' | 'keepass' | 'chrome';

export function detectFormat(text: string, filename: string): ImportFormat {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  const textStart = text.slice(0, 500).toLowerCase();

  // KeePass XML
  if (ext === 'xml' || textStart.includes('<?xml') && textStart.includes('keepass')) return 'keepass';

  // JSON formats
  if (ext === 'json' || textStart.startsWith('{') || textStart.startsWith('[')) {
    if (textStart.includes('"accounts"') || textStart.includes('"vaults"') || textStart.includes('"1password"')) return '1password';
    if (textStart.includes('"items"') && (textStart.includes('"folderId"') || textStart.includes('"reprompt"') || textStart.includes('"collectionIds"'))) return 'bitwarden';
    if (textStart.includes('"username"') && textStart.includes('"url"') && textStart.includes('"password"')) return 'chrome';
    return 'bitwarden'; // default JSON fallback
  }

  // CSV formats
  if (ext === 'csv' || textStart.includes(',')) {
    // LastPass signature: starts with "url,username,password"
    if (textStart.startsWith('url,username,password') || textStart.includes('grouping,fav')) return 'lastpass';
    return 'csv';
  }

  return 'csv';
}

/**
 * Master import function — auto-detects format and routes to correct parser
 */
export function detectAndImport(text: string, filename: string): ImportedCredential[] {
  const format = detectFormat(text, filename);

  switch (format) {
    case '1password':  return importFrom1Password(text);
    case 'bitwarden':  return importFromBitwarden(text);
    case 'lastpass':   return importFromLastPass(text);
    case 'keepass':    return importFromKeePass(text);
    case 'chrome':     return importFromChrome(text);
    default:           return importFromCSV(text);
  }
}
