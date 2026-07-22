import { useState, useEffect } from 'react';
import { Copy, Check, Clock } from 'lucide-react';
import { generateTOTP, getTOTPTimeRemaining, getTOTPPeriod } from '@/utils/totp';
import { useClipboard } from '@/hooks/useClipboard';

interface TOTPDisplayProps {
  secret: string;
  compact?: boolean;
}

export default function TOTPDisplay({ secret, compact = false }: TOTPDisplayProps) {
  const [code, setCode] = useState('------');
  const [timeRemaining, setTimeRemaining] = useState(30);
  const { copiedField, copyToClipboard } = useClipboard();

  useEffect(() => {
    if (!secret) return;

    const updateCode = async () => {
      const newCode = await generateTOTP(secret);
      setCode(newCode);
    };

    const updateTimer = () => {
      setTimeRemaining(getTOTPTimeRemaining());
    };

    updateCode();
    updateTimer();

    const interval = setInterval(() => {
      updateTimer();
      const remaining = getTOTPTimeRemaining();
      // Regenerate code when period resets
      if (remaining >= getTOTPPeriod() - 1) {
        updateCode();
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [secret]);

  if (!secret) return null;

  const progress = (timeRemaining / getTOTPPeriod()) * 100;
  const isLow = timeRemaining <= 5;
  const formattedCode = code.length === 6 ? `${code.slice(0, 3)} ${code.slice(3)}` : code;

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <div className={`font-mono text-lg font-bold tracking-widest ${isLow ? 'text-red-400' : 'text-emerald-400'}`}>
          {formattedCode}
        </div>
        <div className="flex items-center gap-1">
          <div className="relative w-6 h-6">
            <svg className="w-6 h-6 -rotate-90" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="10" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="2" />
              <circle
                cx="12" cy="12" r="10"
                fill="none"
                stroke={isLow ? '#ef4444' : '#10b981'}
                strokeWidth="2"
                strokeDasharray={`${progress * 0.628} 62.8`}
                strokeLinecap="round"
                className="transition-all duration-1000"
              />
            </svg>
            <span className={`absolute inset-0 flex items-center justify-center text-[9px] font-bold ${isLow ? 'text-red-400' : 'text-emerald-400'}`}>
              {timeRemaining}
            </span>
          </div>
          <button
            onClick={() => copyToClipboard(code, 'totp')}
            className="p-1 hover:bg-white/10 rounded-md transition-colors"
            title="Copy TOTP code"
          >
            {copiedField === 'totp' ? (
              <Check className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <Copy className="w-3.5 h-3.5 text-gray-400" />
            )}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white/5 border border-white/10 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <Clock className="w-4 h-4 text-gray-400" />
        <span className="text-sm font-medium text-gray-300">Two-Factor Code</span>
      </div>
      <div className="flex items-center justify-between">
        <div className={`font-mono text-3xl font-bold tracking-[0.3em] ${isLow ? 'text-red-400' : 'text-emerald-400'} transition-colors`}>
          {formattedCode}
        </div>
        <div className="flex items-center gap-3">
          <div className="relative w-10 h-10">
            <svg className="w-10 h-10 -rotate-90" viewBox="0 0 40 40">
              <circle cx="20" cy="20" r="17" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="3" />
              <circle
                cx="20" cy="20" r="17"
                fill="none"
                stroke={isLow ? '#ef4444' : '#10b981'}
                strokeWidth="3"
                strokeDasharray={`${progress * 1.068} 106.8`}
                strokeLinecap="round"
                className="transition-all duration-1000"
              />
            </svg>
            <span className={`absolute inset-0 flex items-center justify-center text-xs font-bold ${isLow ? 'text-red-400' : 'text-emerald-400'}`}>
              {timeRemaining}
            </span>
          </div>
          <button
            onClick={() => copyToClipboard(code, 'totp')}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
            title="Copy code"
          >
            {copiedField === 'totp' ? (
              <Check className="w-5 h-5 text-emerald-400" />
            ) : (
              <Copy className="w-5 h-5 text-gray-400" />
            )}
          </button>
        </div>
      </div>
      <div className="mt-3 h-1 bg-white/5 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-1000 ${isLow ? 'bg-red-500' : 'bg-emerald-500'}`}
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}
