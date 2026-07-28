import { useState, useMemo } from 'react';
import {
  ShieldAlert, AlertTriangle, AlertCircle, RefreshCw, RefreshCcw
} from 'lucide-react';
import { useVaultStore } from '@/stores/vaultStore';
import { evaluatePasswordStrength } from '@/utils/crypto';
import { checkPasswordBreach } from '@/utils/breachCheck';

export default function PasswordHealth() {
  const { credentials, strictOfflineMode, networkApprovedThisSession, approveNetworkThisSession } = useVaultStore();
  const [checkingBreaches, setCheckingBreaches] = useState(false);
  const [breachData, setBreachData] = useState<Record<string, number>>({});
  const [breachError, setBreachError] = useState<string | null>(null);

  // Evaluate Password Metrics
  const healthData = useMemo(() => {
    let totalScore = 0;
    let evalCount = 0;
    const weakList: any[] = [];
    const reusedMap: Record<string, any[]> = {};
    const oldList: any[] = [];
    const missing2fa: any[] = [];

    credentials.forEach(c => {
      if (c.category === 'Payment Card' || c.category === 'Passkey') return;
      if (!c.password) return;

      evalCount++;
      const scoreObj = evaluatePasswordStrength(c.password);
      totalScore += scoreObj.score; // 0 to 4

      // Weak check
      if (scoreObj.score < 3) {
        weakList.push({ ...c, strength: scoreObj });
      }

      // Reused check
      const pwd = c.password;
      if (!reusedMap[pwd]) reusedMap[pwd] = [];
      reusedMap[pwd].push(c);

      // Old check (90 days)
      const ageDays = (Date.now() - c.updatedAt) / (1000 * 60 * 60 * 24);
      if (ageDays > 90) {
        oldList.push({ ...c, ageDays: Math.floor(ageDays) });
      }

      // Missing 2FA
      if (!c.totpSecret) {
        missing2fa.push(c);
      }
    });

    const reusedList = Object.values(reusedMap).filter(arr => arr.length > 1).flat();
    const averageScore = evalCount > 0 ? (totalScore / evalCount) * 25 : 100; // Map 0-4 to 0-100

    return {
      score: Math.round(averageScore),
      weakList,
      reusedList,
      oldList,
      missing2fa,
      evalCount
    };
  }, [credentials]);

  const handleBreachCheck = async () => {
    if (strictOfflineMode) {
      setBreachError('Strict Offline Mode is enabled. Disable it in Settings to perform breach checks.');
      return;
    }
    if (!networkApprovedThisSession) {
      const confirmNetwork = window.confirm(
        "SafeVault is requesting temporary network access to contact api.pwnedpasswords.com to check for leaked passwords using the secure k-Anonymity model.\n\nDo you allow this connection for this session?"
      );
      if (!confirmNetwork) return;
      approveNetworkThisSession();
    }

    setCheckingBreaches(true);
    setBreachError(null);
    const results: Record<string, number> = {};

    try {
      for (const c of credentials) {
        if (!c.password || c.category === 'Payment Card') continue;
        const count = await checkPasswordBreach(c.password);
        if (count > 0) {
          results[c.id] = count;
        }
        // Small delay to prevent rate limits
        await new Promise(r => setTimeout(r, 100));
      }
      setBreachData(results);
    } catch {
      setBreachError('Some checks failed. Verify network connection.');
    } finally {
      setCheckingBreaches(false);
    }
  };

  const getHealthColor = (score: number) => {
    if (score >= 80) return 'text-emerald-400 border-emerald-500/20';
    if (score >= 50) return 'text-amber-400 border-amber-500/20';
    return 'text-rose-400 border-rose-500/20';
  };

  const getHealthBg = (score: number) => {
    if (score >= 80) return 'bg-emerald-500/5';
    if (score >= 50) return 'bg-amber-500/5';
    return 'bg-rose-500/5';
  };

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      {/* Title */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <ShieldAlert className="w-6 h-6 text-emerald-400" />
          <h2 className="text-xl font-bold text-white">Password Health Dashboard</h2>
        </div>
        <button
          onClick={handleBreachCheck}
          disabled={checkingBreaches}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-gray-800 disabled:text-gray-500 text-white text-xs font-semibold rounded-xl transition-all shadow-md"
        >
          {checkingBreaches ? (
            <>
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              Checking...
            </>
          ) : (
            <>
              <RefreshCcw className="w-3.5 h-3.5" />
              Check Breaches (HIBP)
            </>
          )}
        </button>
      </div>

      {breachError && (
        <div className="p-3.5 bg-rose-500/10 border border-rose-500/20 rounded-xl text-xs text-rose-400">
          {breachError}
        </div>
      )}

      {/* Main Stats Card */}
      <div className={`border rounded-2xl p-6 flex flex-col sm:flex-row items-center gap-6 justify-between ${getHealthBg(healthData.score)} ${getHealthColor(healthData.score).split(' ')[1]}`}>
        <div className="space-y-2 text-center sm:text-left">
          <h3 className="text-lg font-bold text-white">Vault Health Score</h3>
          <p className="text-xs text-gray-400 max-w-sm">
            This score evaluates password complexity, reuse rate, age, and 2FA coverage inside your login credentials database.
          </p>
        </div>

        <div className="relative shrink-0 flex items-center justify-center w-24 h-24 rounded-full border-4 border-white/5">
          <span className={`text-3xl font-black font-mono ${getHealthColor(healthData.score).split(' ')[0]}`}>
            {healthData.score}%
          </span>
        </div>
      </div>

      {/* Summary Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Weak Passwords', val: healthData.weakList.length, color: 'text-rose-400', bg: 'bg-rose-500/10' },
          { label: 'Reused Passwords', val: healthData.reusedList.length, color: 'text-amber-400', bg: 'bg-amber-500/10' },
          { label: 'Old (90d+)', val: healthData.oldList.length, color: 'text-blue-400', bg: 'bg-blue-500/10' },
          { label: 'Missing 2FA', val: healthData.missing2fa.length, color: 'text-purple-400', bg: 'bg-purple-500/10' },
        ].map((item, i) => (
          <div key={i} className="bg-white/5 border border-white/5 rounded-xl p-4 flex flex-col justify-between h-24">
            <span className="text-[10px] text-gray-500 uppercase tracking-wider font-bold">{item.label}</span>
            <span className={`text-2xl font-black font-mono ${item.color}`}>{item.val}</span>
          </div>
        ))}
      </div>

      {/* Breached items list */}
      {Object.keys(breachData).length > 0 && (
        <div className="bg-rose-500/5 border border-rose-500/20 rounded-2xl p-5 space-y-3">
          <h3 className="text-sm font-bold text-rose-400 flex items-center gap-2">
            <AlertCircle className="w-4 h-4" /> Leaked Passwords Detected ({Object.keys(breachData).length})
          </h3>
          <p className="text-xs text-gray-400 leading-normal">
            These passwords were found in public data breaches. We recommend changing them immediately to protect your accounts.
          </p>
          <div className="divide-y divide-rose-500/10 max-h-48 overflow-y-auto">
            {Object.entries(breachData).map(([id, count]) => {
              const cred = credentials.find(c => c.id === id);
              if (!cred) return null;
              return (
                <div key={id} className="py-2.5 flex items-center justify-between text-xs">
                  <span className="font-semibold text-white">{cred.title}</span>
                  <span className="text-rose-400 font-mono">Found {count.toLocaleString()} times</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Action lists */}
      <div className="space-y-4">
        {healthData.weakList.length > 0 && (
          <div className="bg-white/3 border border-white/5 rounded-2xl p-5 space-y-3">
            <h4 className="text-sm font-bold text-white flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-400" /> Weak Passwords ({healthData.weakList.length})
            </h4>
            <div className="grid grid-cols-1 gap-2">
              {healthData.weakList.slice(0, 5).map(c => (
                <div key={c.id} className="flex justify-between items-center bg-black/20 p-2.5 rounded-lg text-xs">
                  <div>
                    <span className="font-semibold text-gray-200 block">{c.title}</span>
                    <span className="text-[10px] text-gray-500">{c.username}</span>
                  </div>
                  <span className="text-[10px] bg-rose-500/10 text-rose-400 px-2 py-0.5 rounded font-bold uppercase">
                    {c.strength?.label || 'Weak'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {healthData.reusedList.length > 0 && (
          <div className="bg-white/3 border border-white/5 rounded-2xl p-5 space-y-3">
            <h4 className="text-sm font-bold text-white flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400" /> Reused Passwords ({healthData.reusedList.length})
            </h4>
            <div className="grid grid-cols-1 gap-2">
              {healthData.reusedList.slice(0, 5).map(c => (
                <div key={c.id} className="flex justify-between items-center bg-black/20 p-2.5 rounded-lg text-xs">
                  <div>
                    <span className="font-semibold text-gray-200 block">{c.title}</span>
                    <span className="text-[10px] text-gray-500">{c.username}</span>
                  </div>
                  <span className="text-[10px] bg-amber-500/10 text-amber-400 px-2 py-0.5 rounded font-bold uppercase">
                    Reused
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
