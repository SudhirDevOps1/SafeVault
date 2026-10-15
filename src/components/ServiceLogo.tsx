import { useState, useMemo } from 'react';
import { useVaultStore } from '@/stores/vaultStore';
import {
  Globe, Key, Lock, Mail, Shield, Server, Database,
  CreditCard, Smartphone, ShoppingBag, Terminal, Wifi, Cloud, Gamepad, Folder,
  Star, User
} from 'lucide-react';

interface ServiceLogoProps {
  url?: string;
  title: string;
  category?: string;
  customIcon?: string;
  customColor?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

export const ICON_OPTIONS: { id: string; label: string; icon: any }[] = [
  { id: 'globe', label: 'Website', icon: Globe },
  { id: 'key', label: 'Key', icon: Key },
  { id: 'lock', label: 'Lock', icon: Lock },
  { id: 'mail', label: 'Email', icon: Mail },
  { id: 'shield', label: 'Shield', icon: Shield },
  { id: 'server', label: 'Server', icon: Server },
  { id: 'database', label: 'Database', icon: Database },
  { id: 'card', label: 'Card', icon: CreditCard },
  { id: 'mobile', label: 'Mobile', icon: Smartphone },
  { id: 'shopping', label: 'Shopping', icon: ShoppingBag },
  { id: 'terminal', label: 'Terminal', icon: Terminal },
  { id: 'wifi', label: 'WiFi', icon: Wifi },
  { id: 'cloud', label: 'Cloud', icon: Cloud },
  { id: 'gamepad', label: 'Gaming', icon: Gamepad },
  { id: 'folder', label: 'Folder', icon: Folder },
  { id: 'user', label: 'User', icon: User },
  { id: 'star', label: 'Star', icon: Star },
];

export const COLOR_OPTIONS: { id: string; name: string; bg: string; text: string; border: string; ring: string }[] = [
  { id: 'emerald', name: 'Emerald', bg: 'from-emerald-500/20 to-teal-700/30', text: 'text-emerald-400', border: 'border-emerald-500/30', ring: 'ring-emerald-500' },
  { id: 'indigo', name: 'Indigo', bg: 'from-indigo-500/20 to-blue-700/30', text: 'text-indigo-400', border: 'border-indigo-500/30', ring: 'ring-indigo-500' },
  { id: 'violet', name: 'Violet', bg: 'from-violet-500/20 to-purple-700/30', text: 'text-violet-400', border: 'border-violet-500/30', ring: 'ring-violet-500' },
  { id: 'amber', name: 'Amber', bg: 'from-amber-500/20 to-orange-700/30', text: 'text-amber-400', border: 'border-amber-500/30', ring: 'ring-amber-500' },
  { id: 'rose', name: 'Rose', bg: 'from-rose-500/20 to-red-700/30', text: 'text-rose-400', border: 'border-rose-500/30', ring: 'ring-rose-500' },
  { id: 'cyan', name: 'Cyan', bg: 'from-cyan-500/20 to-sky-700/30', text: 'text-cyan-400', border: 'border-cyan-500/30', ring: 'ring-cyan-500' },
  { id: 'fuchsia', name: 'Fuchsia', bg: 'from-fuchsia-500/20 to-pink-700/30', text: 'text-fuchsia-400', border: 'border-fuchsia-500/30', ring: 'ring-fuchsia-500' },
  { id: 'slate', name: 'Slate', bg: 'from-slate-700/40 to-slate-800/40', text: 'text-slate-300', border: 'border-slate-600/40', ring: 'ring-slate-400' },
];

export default function ServiceLogo({
  url,
  title,
  category,
  customIcon,
  customColor,
  size = 'md',
  className = ''
}: ServiceLogoProps) {
  const [imageErrorLevel, setImageErrorLevel] = useState<number>(0);

  const domain = useMemo(() => {
    if (!url) return '';
    try {
      let host = url.trim();
      if (!host.includes('://')) host = 'https://' + host;
      return new URL(host).hostname.replace(/^www\./, '');
    } catch {
      return '';
    }
  }, [url]);

  // Color scheme resolution
  const colorTheme = useMemo(() => {
    if (customColor) {
      const found = COLOR_OPTIONS.find(c => c.id === customColor);
      if (found) return found;
    }
    // Deterministic palette based on title
    const hash = (title || 'S').split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return COLOR_OPTIONS[hash % COLOR_OPTIONS.length];
  }, [customColor, title]);

  // Custom icon resolution
  const CustomIconComponent = useMemo(() => {
    if (!customIcon) return null;
    const found = ICON_OPTIONS.find(i => i.id === customIcon);
    return found ? found.icon : null;
  }, [customIcon]);

  // Category fallback icon
  const CategoryIconComponent = useMemo(() => {
    if (category === 'Cards' || category === 'Payment Card') return CreditCard;
    if (category === 'Email' || category === 'Alias') return Mail;
    if (category === 'Server') return Server;
    if (category === 'WiFi') return Wifi;
    return Globe;
  }, [category]);

  const sizeClasses = {
    xs: { box: 'w-6 h-6 rounded-md', icon: 'w-3.5 h-3.5', text: 'text-[10px]', img: 'w-4 h-4' },
    sm: { box: 'w-8 h-8 rounded-lg', icon: 'w-4 h-4', text: 'text-xs', img: 'w-5 h-5' },
    md: { box: 'w-10 h-10 rounded-xl', icon: 'w-5 h-5', text: 'text-sm', img: 'w-6 h-6' },
    lg: { box: 'w-12 h-12 rounded-xl', icon: 'w-6 h-6', text: 'text-base font-bold', img: 'w-7 h-7' },
    xl: { box: 'w-14 h-14 rounded-2xl', icon: 'w-7 h-7', text: 'text-lg font-bold', img: 'w-9 h-9' },
  }[size];

  const disableRemoteFavicons = useVaultStore(state => state.disableRemoteFavicons);

  // Favicon URLs: Tier 1 = Google S2 (high res 128px), Tier 2 = DuckDuckGo
  const faviconUrl = useMemo(() => {
    if (!domain || disableRemoteFavicons) return null;
    if (imageErrorLevel === 0) {
      return `https://www.google.com/s2/favicons?domain=${domain}&sz=128`;
    } else if (imageErrorLevel === 1) {
      return `https://icons.duckduckgo.com/ip3/${domain}.ico`;
    }
    return null;
  }, [domain, disableRemoteFavicons, imageErrorLevel]);

  // If user explicitly chose a custom icon, prioritize that
  if (CustomIconComponent) {
    return (
      <div
        className={`${sizeClasses.box} bg-gradient-to-br ${colorTheme.bg} border ${colorTheme.border} flex items-center justify-center shrink-0 shadow-sm ${className}`}
      >
        <CustomIconComponent className={`${sizeClasses.icon} ${colorTheme.text}`} />
      </div>
    );
  }

  // Real logo from domain
  if (faviconUrl) {
    return (
      <div
        className={`${sizeClasses.box} bg-slate-900/90 border border-white/10 flex items-center justify-center shrink-0 overflow-hidden shadow-sm ${className}`}
      >
        <img
          src={faviconUrl}
          alt={title}
          className={`${sizeClasses.img} object-contain rounded-sm`}
          onError={() => setImageErrorLevel(prev => prev + 1)}
          loading="lazy"
        />
      </div>
    );
  }

  // Rich Monogram Initial or Category Icon fallback
  const initial = (title || 'S').trim().charAt(0).toUpperCase();

  return (
    <div
      className={`${sizeClasses.box} bg-gradient-to-br ${colorTheme.bg} border ${colorTheme.border} flex items-center justify-center shrink-0 shadow-sm ${className}`}
    >
      {initial.match(/[A-Z0-9]/i) ? (
        <span className={`${sizeClasses.text} font-bold ${colorTheme.text} uppercase`}>
          {initial}
        </span>
      ) : (
        <CategoryIconComponent className={`${sizeClasses.icon} ${colorTheme.text}`} />
      )}
    </div>
  );
}
