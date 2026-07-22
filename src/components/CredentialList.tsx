import { useMemo } from 'react';
import { Globe, Star, Key, User } from 'lucide-react';
import { useVaultStore } from '@/stores/vaultStore';
import TOTPDisplay from './TOTPDisplay';

export default function CredentialList() {
  const credentials = useVaultStore(state => state.credentials);
  const selectedCredentialId = useVaultStore(state => state.selectedCredentialId);
  const searchQuery = useVaultStore(state => state.searchQuery);
  const sidebarView = useVaultStore(state => state.sidebarView);
  const setSelectedCredential = useVaultStore(state => state.setSelectedCredential);

  const filteredCredentials = useMemo(() => {
    let filtered = [...credentials];

    // Filter by view
    if (sidebarView === 'favorites') {
      filtered = filtered.filter(c => c.favorite);
    }

    // Filter by search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(c =>
        c.title.toLowerCase().includes(q) ||
        c.url.toLowerCase().includes(q) ||
        c.username.toLowerCase().includes(q) ||
        c.category.toLowerCase().includes(q)
      );
    }

    // Sort: favorites first, then by title
    filtered.sort((a, b) => {
      if (a.favorite !== b.favorite) return a.favorite ? -1 : 1;
      return a.title.localeCompare(b.title);
    });

    return filtered;
  }, [credentials, searchQuery, sidebarView]);

  const getFavicon = (url: string) => {
    try {
      const domain = new URL(url.startsWith('http') ? url : `https://${url}`).hostname;
      return `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;
    } catch {
      return null;
    }
  };

  if (filteredCredentials.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full py-20 px-4 text-center">
        <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center mb-4">
          {searchQuery ? (
            <Globe className="w-8 h-8 text-gray-600" />
          ) : sidebarView === 'favorites' ? (
            <Star className="w-8 h-8 text-gray-600" />
          ) : (
            <Key className="w-8 h-8 text-gray-600" />
          )}
        </div>
        <h3 className="text-lg font-semibold text-gray-400 mb-1">
          {searchQuery ? 'No results found' : sidebarView === 'favorites' ? 'No favorites yet' : 'No credentials yet'}
        </h3>
        <p className="text-sm text-gray-600 max-w-xs">
          {searchQuery
            ? 'Try a different search term'
            : 'Click "+ Add" to store your first credential securely'}
        </p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-white/5">
      {filteredCredentials.map((cred) => {
        const isSelected = selectedCredentialId === cred.id;
        const favicon = cred.url ? getFavicon(cred.url) : null;

        return (
          <button
            key={cred.id}
            onClick={() => setSelectedCredential(cred.id)}
            className={`w-full text-left px-4 py-3.5 flex items-center gap-3.5 transition-all duration-150 hover:bg-white/5 ${
              isSelected ? 'bg-emerald-500/10 border-l-2 border-emerald-500' : 'border-l-2 border-transparent'
            }`}
          >
            {/* Icon */}
            <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center shrink-0 overflow-hidden">
              {favicon ? (
                <img src={favicon} alt="" className="w-5 h-5" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
              ) : (
                <Globe className="w-5 h-5 text-gray-500" />
              )}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-white truncate">{cred.title}</span>
                {cred.favorite && <Star className="w-3 h-3 text-amber-400 fill-amber-400 shrink-0" />}
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                {cred.username && (
                  <span className="text-xs text-gray-500 truncate flex items-center gap-1">
                    <User className="w-3 h-3" />
                    {cred.username}
                  </span>
                )}
              </div>
              {/* Compact TOTP */}
              {cred.totpSecret && (
                <div className="mt-1" onClick={(e) => e.stopPropagation()}>
                  <TOTPDisplay secret={cred.totpSecret} compact />
                </div>
              )}
            </div>

            {/* Category badge */}
            <span className="text-[10px] font-medium text-gray-500 bg-white/5 px-2 py-0.5 rounded-full shrink-0 hidden sm:inline">
              {cred.category}
            </span>
          </button>
        );
      })}
    </div>
  );
}
