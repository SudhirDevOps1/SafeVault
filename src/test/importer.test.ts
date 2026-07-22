import { describe, it, expect } from 'vitest';
import { importFromCSV } from '../utils/importer';

describe('Universal CSV Importer', () => {
  it('should parse Bitwarden format CSV exports correctly', () => {
    const csv = `folder,favorite,type,name,notes,fields,reprompt,login_uri,login_username,login_password,login_totp
Socials,0,login,Google Account,My notes here,,0,https://accounts.google.com,testuser@gmail.com,secretpassword123,JBSWY3DPEHPK3PXP`;

    const imported = importFromCSV(csv);
    expect(imported).toHaveLength(1);
    expect(imported[0].title).toBe('Google Account');
    expect(imported[0].url).toBe('https://accounts.google.com');
    expect(imported[0].username).toBe('testuser@gmail.com');
    expect(imported[0].password).toBe('secretpassword123');
    expect(imported[0].totpSecret).toBe('JBSWY3DPEHPK3PXP');
    expect(imported[0].notes).toBe('My notes here');
  });

  it('should parse ProtonPass format CSV exports correctly', () => {
    const csv = `title,username,password,website,notes,totp
Github,devuser,devpass,https://github.com,Work credentials,MNSNK3S467LMN2U`;

    const imported = importFromCSV(csv);
    expect(imported).toHaveLength(1);
    expect(imported[0].title).toBe('Github');
    expect(imported[0].url).toBe('https://github.com');
    expect(imported[0].username).toBe('devuser');
    expect(imported[0].password).toBe('devpass');
    expect(imported[0].totpSecret).toBe('MNSNK3S467LMN2U');
    expect(imported[0].notes).toBe('Work credentials');
  });

  it('should parse Brave / Chrome format CSV exports correctly', () => {
    const csv = `name,url,username,password
Brave Sync,https://brave.com,braveuser,syncpassword999`;

    const imported = importFromCSV(csv);
    expect(imported).toHaveLength(1);
    expect(imported[0].title).toBe('Brave Sync');
    expect(imported[0].url).toBe('https://brave.com');
    expect(imported[0].username).toBe('braveuser');
    expect(imported[0].password).toBe('syncpassword999');
  });
});
