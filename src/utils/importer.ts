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
        // Escaped quote "" -> "
        currentValue += '"';
        i++;
      } else {
        // Toggle quote state
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      row.push(currentValue.trim());
      currentValue = '';
    } else if ((char === '\r' || char === '\n') && !inQuotes) {
      if (char === '\r' && nextChar === '\n') {
        i++;
      }
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

/**
 * Maps dynamically detected headers to SafeVault credential keys
 */
export function importFromCSV(csvText: string): Omit<Credential, 'id' | 'createdAt' | 'updatedAt'>[] {
  const rows = parseCSV(csvText);
  if (rows.length < 2) {
    throw new Error('CSV file must contain a header row and at least one data row.');
  }

  const headers = rows[0].map(h => h.toLowerCase().trim());
  const dataRows = rows.slice(1);

  // Field mapping indices
  let titleIdx = -1;
  let usernameIdx = -1;
  let passwordIdx = -1;
  let urlIdx = -1;
  let notesIdx = -1;
  let totpIdx = -1;
  let categoryIdx = -1;

  // Header mappings for 40+ password managers (Bitwarden, ProtonPass, Brave, DuckDuckGo, Chrome, Safari, LastPass, 1Password, Dashlane etc.)
  const titleKeys = ['title', 'name', 'login_name', 'label', 'heading'];
  const usernameKeys = ['username', 'login_username', 'email', 'user', 'user name', 'login', 'id'];
  const passwordKeys = ['password', 'login_password', 'pass', 'code', 'secret'];
  const urlKeys = ['url', 'uri', 'login_uri', 'website', 'web', 'link', 'login_url'];
  const notesKeys = ['notes', 'note', 'extra', 'comments', 'description'];
  const totpKeys = ['totp', 'login_totp', 'totp_secret', 'two-factor', 'otp', 'totpsecret', 'authenticator'];
  const categoryKeys = ['category', 'folder', 'type', 'group', 'tag'];

  headers.forEach((header, index) => {
    if (titleKeys.includes(header) && titleIdx === -1) titleIdx = index;
    else if (usernameKeys.includes(header) && usernameIdx === -1) usernameIdx = index;
    else if (passwordKeys.includes(header) && passwordIdx === -1) passwordIdx = index;
    else if (urlKeys.includes(header) && urlIdx === -1) urlIdx = index;
    else if (notesKeys.includes(header) && notesIdx === -1) notesIdx = index;
    else if (totpKeys.includes(header) && totpIdx === -1) totpIdx = index;
    else if (categoryKeys.includes(header) && categoryIdx === -1) categoryIdx = index;
  });

  // Fallback matching if exact keys are not found
  headers.forEach((header, index) => {
    if (titleIdx === -1 && (header.includes('name') || header.includes('title'))) titleIdx = index;
    if (usernameIdx === -1 && (header.includes('user') || header.includes('mail'))) usernameIdx = index;
    if (passwordIdx === -1 && header.includes('pass')) passwordIdx = index;
    if (urlIdx === -1 && (header.includes('url') || header.includes('site') || header.includes('link') || header.includes('uri'))) urlIdx = index;
    if (totpIdx === -1 && (header.includes('totp') || header.includes('otp') || header.includes('authenticator'))) totpIdx = index;
  });

  // Check minimum requirement
  if (titleIdx === -1 && passwordIdx === -1) {
    // If no mapped headers, fallback to column order assumption: [Title, URL, Username, Password, Notes, TOTP, Category]
    titleIdx = 0;
    urlIdx = headers.length > 1 ? 1 : -1;
    usernameIdx = headers.length > 2 ? 2 : -1;
    passwordIdx = headers.length > 3 ? 3 : -1;
    notesIdx = headers.length > 4 ? 4 : -1;
    totpIdx = headers.length > 5 ? 5 : -1;
    categoryIdx = headers.length > 6 ? 6 : -1;
  }

  return dataRows.map(row => {
    const title = titleIdx !== -1 && row[titleIdx] ? row[titleIdx] : 'Imported Credential';
    const url = urlIdx !== -1 && row[urlIdx] ? row[urlIdx] : '';
    const username = usernameIdx !== -1 && row[usernameIdx] ? row[usernameIdx] : '';
    const password = passwordIdx !== -1 && row[passwordIdx] ? row[passwordIdx] : '';
    const notes = notesIdx !== -1 && row[notesIdx] ? row[notesIdx] : '';
    const totpSecret = totpIdx !== -1 && row[totpIdx] ? row[totpIdx].replace(/\s/g, '') : '';
    const category = categoryIdx !== -1 && row[categoryIdx] ? row[categoryIdx] : 'Imported';

    return {
      title,
      url,
      username,
      password,
      notes,
      totpSecret,
      category,
      favorite: false
    };
  });
}
