import React, { useState, useEffect } from 'react';
import { Mail, Plus, Trash2, Wand2, Copy, Check, Save, Info, Sparkles, User, RefreshCw } from 'lucide-react';
import { useVaultStore } from '../stores/vaultStore';
import { useClipboard } from '../hooks/useClipboard';

export default function EmailAliases() {
  const { baseEmails, addBaseEmail, removeBaseEmail, addCredential, setSidebarView } = useVaultStore();
  const { copiedField, copyToClipboard } = useClipboard();

  // Manage State
  const [newBaseEmail, setNewBaseEmail] = useState('');
  
  // Generation Configuration
  const [selectedBase, setSelectedBase] = useState(baseEmails[0] || 'Sudhir@gmail.com');
  const [serviceUrl, setServiceUrl] = useState('');
  const [parsedHandle, setParsedHandle] = useState('');
  const [aliasFormat, setAliasFormat] = useState<'plus' | 'dot'>('plus');
  const [aliasPrefixType, setAliasPrefixType] = useState<'standard' | 'anonymous'>('standard');
  const [passwordLength, setPasswordLength] = useState(27);

  // Generated Outputs
  const [generatedAlias, setGeneratedAlias] = useState('');
  const [generatedUsername, setGeneratedUsername] = useState('');
  const [generatedPassword, setGeneratedPassword] = useState('');
  
  // Fake Identity State
  const [generateProfile, setGenerateProfile] = useState(true);
  const [profileData, setProfileData] = useState<{
    firstName: string;
    lastName: string;
    gender: 'Male' | 'Female';
    birthdate: string;
  } | null>(null);

  // UI Status
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Names Lists for Fake Identity Generation
  const femaleFirstNames = ['Sylvia', 'Mary', 'Patricia', 'Linda', 'Barbara', 'Elizabeth', 'Jennifer', 'Maria', 'Susan', 'Margaret', 'Dorothy', 'Lisa', 'Nancy', 'Karen', 'Betty', 'Helen', 'Sandra', 'Donna', 'Carol', 'Ruth'];
  const maleFirstNames = ['James', 'John', 'Robert', 'Michael', 'William', 'David', 'Richard', 'Joseph', 'Thomas', 'Charles', 'Christopher', 'Daniel', 'Matthew', 'Anthony', 'Mark', 'Donald', 'Steven', 'Paul', 'Andrew', 'Joshua'];
  const lastNames = ['Payne', 'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson', 'Thomas', 'Taylor', 'Moore', 'Jackson'];

  // Helper to generate a fake profile
  const handleGenerateFakeProfile = () => {
    const isFemale = Math.random() > 0.5;
    const gender = isFemale ? 'Female' : 'Male';
    const firstName = isFemale 
      ? femaleFirstNames[Math.floor(Math.random() * femaleFirstNames.length)]
      : maleFirstNames[Math.floor(Math.random() * maleFirstNames.length)];
    const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];
    
    // Random birthdate between 1950 and 2000
    const startYear = 1950;
    const endYear = 2000;
    const year = Math.floor(startYear + Math.random() * (endYear - startYear + 1));
    const month = String(Math.floor(1 + Math.random() * 12)).padStart(2, '0');
    const day = String(Math.floor(1 + Math.random() * 28)).padStart(2, '0');
    const birthdate = `${year}-${month}-${day}`;

    setProfileData({ firstName, lastName, gender, birthdate });
    
    // Auto-generate username from fake name (e.g. sylviap1962)
    const shortFirst = firstName.toLowerCase();
    const shortLastChar = lastName.charAt(0).toLowerCase();
    setGeneratedUsername(`${shortFirst}${shortLastChar}${year}`);
  };

  // Generate initial fake profile once component loads
  useEffect(() => {
    if (!profileData) {
      handleGenerateFakeProfile();
    }
  }, []);

  // Sync selected base email if the list changes
  useEffect(() => {
    if (baseEmails.length > 0 && !baseEmails.includes(selectedBase)) {
      setSelectedBase(baseEmails[0]);
    }
  }, [baseEmails, selectedBase]);

  // Helper to extract domain/title handle
  const extractDomainHandle = (urlStr: string): string => {
    if (!urlStr.trim()) return '';
    try {
      let tempUrl = urlStr.trim();
      if (!tempUrl.startsWith('http://') && !tempUrl.startsWith('https://')) {
        tempUrl = 'https://' + tempUrl;
      }
      const hostname = new URL(tempUrl).hostname;
      let part = hostname.replace('www.', '');
      
      if (part.endsWith('.pages.dev')) {
        return part.replace('.pages.dev', '');
      }
      if (part.endsWith('.github.io')) {
        return part.replace('.github.io', '');
      }

      const parts = part.split('.');
      if (parts.length > 1) {
        return parts[0];
      }
      return part;
    } catch {
      return urlStr.toLowerCase().replace(/[^a-z0-9]/g, '');
    }
  };

  // Update parsed handle and generate alias on inputs change
  useEffect(() => {
    const handle = extractDomainHandle(serviceUrl);
    setParsedHandle(handle);

    if (!selectedBase) {
      setGeneratedAlias('');
      return;
    }

    const [user, domain] = selectedBase.split('@');
    if (!user || !domain) {
      setGeneratedAlias('');
      return;
    }

    // Determine the alias prefix to use
    let prefix = handle;
    if (aliasPrefixType === 'anonymous' && profileData) {
      const birthYear = profileData.birthdate.split('-')[0];
      prefix = `${profileData.firstName.toLowerCase()}${profileData.lastName.toLowerCase()}-${birthYear.slice(2)}`;
    }

    if (!prefix) {
      setGeneratedAlias('');
      return;
    }

    // Check if the base email is actually a catch-all custom domain (starts with @)
    const isCatchAll = selectedBase.startsWith('@');

    if (isCatchAll) {
      // If catch-all (e.g. @sudhir.com), generate prefix@domain.com
      const cleanDomain = selectedBase.replace('@', '');
      setGeneratedAlias(`${prefix}@${cleanDomain}`);
    } else {
      // Standard subaddressing
      if (aliasFormat === 'plus') {
        setGeneratedAlias(`${user}+${prefix}@${domain}`);
      } else {
        setGeneratedAlias(`${user}.${prefix}@${domain}`);
      }
    }
  }, [serviceUrl, selectedBase, aliasFormat, aliasPrefixType, profileData]);

  // Generate password helper
  const handleGeneratePassword = () => {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+-=[]{}|';
    let pass = '';
    for (let i = 0; i < passwordLength; i++) {
      pass += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setGeneratedPassword(pass);
  };

  // Re-generate password when length changes or handle becomes active
  useEffect(() => {
    if (parsedHandle) {
      handleGeneratePassword();
    } else {
      setGeneratedPassword('');
    }
  }, [parsedHandle, passwordLength]);

  const handleAddBase = (e: React.FormEvent) => {
    e.preventDefault();
    const email = newBaseEmail.trim();
    if (!email || (!email.includes('@') && !email.startsWith('@'))) {
      setStatusMessage({ type: 'error', text: 'Enter a valid email address or catch-all domain (e.g. @sudhir.com).' });
      return;
    }
    addBaseEmail(email);
    setNewBaseEmail('');
    setStatusMessage({ type: 'success', text: `Added base registry: ${email}` });
    setTimeout(() => setStatusMessage(null), 3000);
  };

  const handleSaveToVault = async () => {
    if (!generatedAlias) {
      setStatusMessage({ type: 'error', text: 'Please fill in a Website URL to generate the alias.' });
      return;
    }

    const rawTitle = parsedHandle || 'Email Alias';
    const formattedTitle = rawTitle.charAt(0).toUpperCase() + rawTitle.slice(1);

    let notesContent = `Auto-generated Email Alias from base: ${selectedBase}`;
    if (generateProfile && profileData) {
      notesContent += `\n\n--- Associated Profile Suffix Identity ---\n`;
      notesContent += `First Name: ${profileData.firstName}\n`;
      notesContent += `Last Name: ${profileData.lastName}\n`;
      notesContent += `Gender: ${profileData.gender}\n`;
      notesContent += `Birthdate: ${profileData.birthdate}\n`;
      notesContent += `Username: ${generatedUsername}`;
    }

    try {
      await addCredential({
        title: formattedTitle,
        username: aliasPrefixType === 'anonymous' ? generatedUsername : generatedAlias,
        password: generatedPassword,
        url: serviceUrl.trim(),
        notes: notesContent,
        favorite: false,
        totpSecret: '',
        category: 'Login'
      });

      setStatusMessage({ type: 'success', text: 'Alias saved successfully to your vault!' });
      
      setTimeout(() => {
        setStatusMessage(null);
        setSidebarView('all');
      }, 1500);
    } catch (err) {
      setStatusMessage({ type: 'error', text: 'Failed to save credential card.' });
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <Mail className="w-5 h-5 text-emerald-400" />
          Email & Identity Alias Generator
        </h2>
        <p className="text-xs text-gray-400 mt-1">
          Create secure, sub-addressed email cards and fake profile credentials dynamically.
        </p>
      </div>

      {statusMessage && (
        <div className={`p-3.5 rounded-xl border flex items-center gap-2.5 text-xs transition-all ${
          statusMessage.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-rose-500/10 border-rose-500/20 text-rose-400'
        }`}>
          <Info className="w-4 h-4 shrink-0" />
          <span>{statusMessage.text}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Manage Base Emails */}
        <div className="bg-[#121212]/80 border border-white/5 rounded-2xl p-5 backdrop-blur-xl h-fit space-y-4">
          <span className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5" />
            1. Base Registries
          </span>
          <p className="text-[11px] text-gray-500 leading-normal">
            Configure primary emails or catch-all domains (e.g. `@aliasvault.net`).
          </p>

          <form onSubmit={handleAddBase} className="flex gap-2">
            <input
              type="text"
              placeholder="e.g. Sudhir@gmail.com or @domain.com"
              value={newBaseEmail}
              onChange={(e) => setNewBaseEmail(e.target.value)}
              className="flex-1 px-3 py-2 bg-white/5 border border-white/5 rounded-xl text-xs text-white placeholder-gray-600 focus:outline-none focus:border-emerald-500/30 transition-all font-mono"
            />
            <button
              type="submit"
              className="p-2 bg-emerald-600 hover:bg-emerald-500 text-slate-900 rounded-xl transition-all"
            >
              <Plus className="w-4 h-4" />
            </button>
          </form>

          <div className="space-y-1.5 max-h-48 overflow-y-auto">
            {baseEmails.map((email) => (
              <div key={email} className="flex items-center justify-between p-2 bg-white/5 border border-white/5 rounded-xl text-xs font-mono">
                <span className="text-gray-300 truncate pr-2">{email}</span>
                {baseEmails.length > 1 && (
                  <button
                    onClick={() => removeBaseEmail(email)}
                    className="p-1 hover:bg-red-500/10 text-gray-500 hover:text-red-400 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Right Column: Generator Options & Outputs */}
        <div className="lg:col-span-2 bg-[#121212]/80 border border-white/5 rounded-2xl p-5 backdrop-blur-xl space-y-5">
          <span className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
            <Wand2 className="w-3.5 h-3.5" />
            2. Suffix Design & Credentials
          </span>

          <div className="space-y-4">
            {/* Base Email selection */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-400">Select Base Registry</label>
                <select
                  value={selectedBase}
                  onChange={(e) => setSelectedBase(e.target.value)}
                  className="w-full px-3 py-2.5 bg-white/5 border border-white/5 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500/30 transition-all font-mono"
                >
                  {baseEmails.map(email => (
                    <option key={email} value={email} className="bg-[#121212] text-white">
                      {email}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-400">Target Website URL</label>
                <input
                  type="text"
                  placeholder="e.g. https://icedrive.net/plans"
                  value={serviceUrl}
                  onChange={(e) => setServiceUrl(e.target.value)}
                  className="w-full px-4 py-2.5 bg-white/5 border border-white/5 rounded-xl text-xs text-white placeholder-gray-600 focus:outline-none focus:border-emerald-500/30 transition-all font-mono"
                />
              </div>
            </div>

            {/* Config selectors */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-400 block">Alias Naming Format</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setAliasPrefixType('standard')}
                    className={`flex-1 py-2 px-3 rounded-xl border text-xs font-semibold transition-all ${
                      aliasPrefixType === 'standard'
                        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                        : 'bg-white/5 border-white/5 text-gray-400 hover:text-white'
                    }`}
                  >
                    Website Name Suffix
                  </button>
                  <button
                    type="button"
                    onClick={() => setAliasPrefixType('anonymous')}
                    className={`flex-1 py-2 px-3 rounded-xl border text-xs font-semibold transition-all ${
                      aliasPrefixType === 'anonymous'
                        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                        : 'bg-white/5 border-white/5 text-gray-400 hover:text-white'
                    }`}
                  >
                    Anonymous Name Suffix
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-400 block">Sub-addressing Suffix</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={selectedBase.startsWith('@')}
                    onClick={() => setAliasFormat('plus')}
                    className={`flex-1 py-2 px-3 rounded-xl border text-xs font-semibold transition-all disabled:opacity-30 ${
                      aliasFormat === 'plus'
                        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                        : 'bg-white/5 border-white/5 text-gray-400 hover:text-white'
                    }`}
                  >
                    Plus (+) Suffix
                  </button>
                  <button
                    type="button"
                    disabled={selectedBase.startsWith('@')}
                    onClick={() => setAliasFormat('dot')}
                    className={`flex-1 py-2 px-3 rounded-xl border text-xs font-semibold transition-all disabled:opacity-30 ${
                      aliasFormat === 'dot'
                        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                        : 'bg-white/5 border-white/5 text-gray-400 hover:text-white'
                    }`}
                  >
                    Dot (.) Suffix
                  </button>
                </div>
              </div>
            </div>

            {/* Password configuration */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs font-semibold text-gray-400">
                <span>Password Length</span>
                <span className="text-emerald-400 font-mono">{passwordLength} chars</span>
              </div>
              <input
                type="range"
                min={8}
                max={64}
                value={passwordLength}
                onChange={(e) => setPasswordLength(Number(e.target.value))}
                className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-emerald-500"
              />
            </div>

            {/* Profile Identity toggle */}
            <div className="flex items-center justify-between p-3.5 bg-white/5 border border-white/5 rounded-xl">
              <div>
                <span className="text-xs font-semibold text-white block">Generate Fake Identity</span>
                <span className="text-[10px] text-gray-500">Auto-create profile metadata for this alias</span>
              </div>
              <input
                type="checkbox"
                checked={generateProfile}
                onChange={(e) => setGenerateProfile(e.target.checked)}
                className="w-4.5 h-4.5 rounded border-white/10 text-emerald-600 focus:ring-emerald-500/50 focus:ring-offset-0 bg-white/5 cursor-pointer accent-emerald-500"
              />
            </div>

            {/* Profile Identity generation panel */}
            {generateProfile && (
              <div className="p-4 bg-white/5 border border-white/5 rounded-2xl space-y-3 animate-fade-in">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-gray-300 flex items-center gap-1.5">
                    <User className="w-4 h-4 text-emerald-400" />
                    Generate Fake Suffix Identity Profile
                  </span>
                  <button
                    type="button"
                    onClick={handleGenerateFakeProfile}
                    className="p-1 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 transition-colors"
                    title="Generate New Profile"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                  </button>
                </div>

                {profileData && (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs font-mono">
                    <div className="p-2.5 bg-black/40 border border-white/5 rounded-xl">
                      <span className="text-[10px] text-gray-500 block">First Name</span>
                      <span className="text-white font-semibold">{profileData.firstName}</span>
                    </div>
                    <div className="p-2.5 bg-black/40 border border-white/5 rounded-xl">
                      <span className="text-[10px] text-gray-500 block">Last Name</span>
                      <span className="text-white font-semibold">{profileData.lastName}</span>
                    </div>
                    <div className="p-2.5 bg-black/40 border border-white/5 rounded-xl">
                      <span className="text-[10px] text-gray-500 block">Gender</span>
                      <span className="text-white font-semibold">{profileData.gender}</span>
                    </div>
                    <div className="p-2.5 bg-black/40 border border-white/5 rounded-xl">
                      <span className="text-[10px] text-gray-500 block">Birthdate</span>
                      <span className="text-white font-semibold">{profileData.birthdate}</span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Final outputs rendering */}
            {generatedAlias && (
              <div className="pt-4 border-t border-white/5 space-y-4 animate-fade-in">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Alias Output */}
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Generated Alias Email</span>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        readOnly
                        value={generatedAlias}
                        className="flex-1 px-3 py-2 bg-emerald-500/5 border border-emerald-500/10 rounded-xl text-xs text-emerald-300 font-mono focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => copyToClipboard(generatedAlias, 'alias')}
                        className="p-2 bg-white/5 hover:bg-white/10 rounded-xl transition-all text-gray-400 hover:text-white"
                      >
                        {copiedField === 'alias' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>

                  {/* Username Output */}
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Generated Username</span>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        readOnly
                        value={generatedUsername}
                        className="flex-1 px-3 py-2 bg-white/5 border border-white/5 rounded-xl text-xs text-gray-300 font-mono focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => copyToClipboard(generatedUsername, 'usr')}
                        className="p-2 bg-white/5 hover:bg-white/10 rounded-xl transition-all text-gray-400 hover:text-white"
                      >
                        {copiedField === 'usr' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Password Output */}
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Generated Password</span>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      readOnly
                      value={generatedPassword}
                      className="flex-1 px-3 py-2 bg-white/5 border border-white/5 rounded-xl text-xs text-gray-300 font-mono focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => copyToClipboard(generatedPassword, 'pass')}
                      className="p-2 bg-white/5 hover:bg-white/10 rounded-xl transition-all text-gray-400 hover:text-white"
                    >
                      {copiedField === 'pass' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                {/* Save to Vault Action */}
                <button
                  onClick={handleSaveToVault}
                  className="w-full py-3 bg-emerald-500 hover:bg-emerald-400 text-slate-900 rounded-xl text-xs font-bold transition-all shadow-lg flex items-center justify-center gap-2"
                >
                  <Save className="w-4 h-4" />
                  Save as Card in Vault
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
