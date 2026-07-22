import { useState, useCallback, useEffect } from 'react';
import { RefreshCw, Copy, Check, Sliders } from 'lucide-react';
import { generatePassword, DEFAULT_PASSWORD_OPTIONS } from '@/utils/password';
import { evaluatePasswordStrength } from '@/utils/crypto';
import { useClipboard } from '@/hooks/useClipboard';
import type { PasswordGeneratorOptions } from '@/types';

interface PasswordGeneratorProps {
  onSelect?: (password: string) => void;
  standalone?: boolean;
}

export default function PasswordGenerator({ onSelect, standalone = false }: PasswordGeneratorProps) {
  const [options, setOptions] = useState<PasswordGeneratorOptions>(DEFAULT_PASSWORD_OPTIONS);
  const [generatedPassword, setGeneratedPassword] = useState('');
  const { copiedField, copyToClipboard } = useClipboard();

  const generate = useCallback(() => {
    const pwd = generatePassword(options);
    setGeneratedPassword(pwd);
  }, [options]);

  useEffect(() => {
    generate();
  }, [generate]);

  const strength = evaluatePasswordStrength(generatedPassword);

  const toggleOption = (key: keyof PasswordGeneratorOptions) => {
    if (key === 'length' || key === 'excludeAmbiguous') return;
    const newOptions = { ...options, [key]: !options[key] };
    // Ensure at least one charset is selected
    const hasAny = newOptions.includeUppercase || newOptions.includeLowercase || newOptions.includeNumbers || newOptions.includeSymbols;
    if (!hasAny) return;
    setOptions(newOptions);
  };

  return (
    <div className={`${standalone ? 'p-1' : 'bg-white/5 border border-white/10 rounded-xl p-4'}`}>
      {standalone && (
        <div className="flex items-center gap-2 mb-6">
          <Sliders className="w-5 h-5 text-emerald-400" />
          <h2 className="text-lg font-semibold text-white">Password Generator</h2>
        </div>
      )}

      {/* Generated Password Display */}
      <div className="bg-black/30 border border-white/10 rounded-xl p-4 mb-4">
        <div className="flex items-center gap-2">
          <div className="flex-1 font-mono text-lg text-white break-all leading-relaxed select-all">
            {generatedPassword}
          </div>
          <div className="flex shrink-0 gap-1">
            <button
              onClick={generate}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors"
              title="Regenerate"
            >
              <RefreshCw className="w-4 h-4 text-gray-400" />
            </button>
            <button
              onClick={() => copyToClipboard(generatedPassword, 'generated')}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors"
              title="Copy"
            >
              {copiedField === 'generated' ? (
                <Check className="w-4 h-4 text-emerald-400" />
              ) : (
                <Copy className="w-4 h-4 text-gray-400" />
              )}
            </button>
          </div>
        </div>

        {/* Strength Indicator */}
        <div className="mt-3">
          <div className="flex gap-1 mb-1">
            {[0, 1, 2, 3, 4].map(i => (
              <div
                key={i}
                className="h-1 flex-1 rounded-full transition-all duration-300"
                style={{
                  backgroundColor: i <= strength.score ? strength.color : 'rgba(255,255,255,0.1)',
                }}
              />
            ))}
          </div>
          <p className="text-xs" style={{ color: strength.color }}>{strength.label}</p>
        </div>
      </div>

      {/* Length Slider */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-medium text-gray-300">Length</label>
          <span className="text-sm font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded">
            {options.length}
          </span>
        </div>
        <input
          type="range"
          min="8"
          max="64"
          value={options.length}
          onChange={(e) => setOptions({ ...options, length: parseInt(e.target.value) })}
          className="w-full h-2 bg-white/10 rounded-full appearance-none cursor-pointer accent-emerald-500"
        />
        <div className="flex justify-between text-xs text-gray-600 mt-1">
          <span>8</span>
          <span>64</span>
        </div>
      </div>

      {/* Options */}
      <div className="grid grid-cols-2 gap-2 mb-4">
        {[
          { key: 'includeUppercase' as const, label: 'A-Z' },
          { key: 'includeLowercase' as const, label: 'a-z' },
          { key: 'includeNumbers' as const, label: '0-9' },
          { key: 'includeSymbols' as const, label: '!@#$' },
        ].map(({ key, label }) => (
          <button
            key={key}
            onClick={() => toggleOption(key)}
            className={`py-2 px-3 rounded-lg text-sm font-medium transition-all ${
              options[key]
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                : 'bg-white/5 text-gray-500 border border-white/5 hover:border-white/10'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <label className="flex items-center gap-3 text-sm text-gray-400 mb-4 cursor-pointer">
        <input
          type="checkbox"
          checked={options.excludeAmbiguous}
          onChange={(e) => setOptions({ ...options, excludeAmbiguous: e.target.checked })}
          className="rounded bg-white/10 border-white/20 text-emerald-500 focus:ring-emerald-500/30 w-4 h-4 accent-emerald-500"
        />
        Exclude ambiguous (O, 0, I, l, 1, |)
      </label>

      {onSelect && (
        <button
          onClick={() => onSelect(generatedPassword)}
          className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-medium rounded-xl transition-colors"
        >
          Use This Password
        </button>
      )}
    </div>
  );
}
