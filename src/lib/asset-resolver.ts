/**
 * Asset Resolver — resolves a semantic concept name to a visual asset.
 *
 * Priority:
 *  1. Local SVG catalog  (educational illustrations, hardcoded)
 *  2. Iconify API        (tech / brand icons fetched on demand, then cached)
 *  3. Emoji fallback     (always succeeds)
 */

// ── SVG Sanitizer ─────────────────────────────────────────────────────────────

export function sanitizeSvg(raw: string): string {
  return raw
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<iframe[\s\S]*?<\/iframe>/gi, "")
    .replace(/<object[\s\S]*?<\/object>/gi, "")
    .replace(/<embed[^>]*>/gi, "")
    .replace(/\s+on\w+="[^"]*"/gi, "")
    .replace(/\s+on\w+='[^']*'/gi, "")
    .replace(/javascript:/gi, "");
}

// ── Local SVG Catalog ─────────────────────────────────────────────────────────
// Simple, clean educational illustrations. No external dependencies.

const LOCAL_SVG: Record<string, string> = {
  // ── Astronomy ──
  sun: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <circle cx="50" cy="50" r="22" fill="#FCD34D" stroke="#F59E0B" stroke-width="2"/>
    <line x1="77" y1="50" x2="88" y2="50" stroke="#F59E0B" stroke-width="3" stroke-linecap="round"/>
    <line x1="23" y1="50" x2="12" y2="50" stroke="#F59E0B" stroke-width="3" stroke-linecap="round"/>
    <line x1="50" y1="23" x2="50" y2="12" stroke="#F59E0B" stroke-width="3" stroke-linecap="round"/>
    <line x1="50" y1="77" x2="50" y2="88" stroke="#F59E0B" stroke-width="3" stroke-linecap="round"/>
    <line x1="69" y1="69" x2="77" y2="77" stroke="#F59E0B" stroke-width="3" stroke-linecap="round"/>
    <line x1="31" y1="31" x2="23" y2="23" stroke="#F59E0B" stroke-width="3" stroke-linecap="round"/>
    <line x1="69" y1="31" x2="77" y2="23" stroke="#F59E0B" stroke-width="3" stroke-linecap="round"/>
    <line x1="31" y1="69" x2="23" y2="77" stroke="#F59E0B" stroke-width="3" stroke-linecap="round"/>
  </svg>`,

  earth: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <circle cx="50" cy="50" r="38" fill="#3B82F6" stroke="#1D4ED8" stroke-width="1.5"/>
    <ellipse cx="44" cy="34" rx="13" ry="9" fill="#22C55E" opacity="0.9"/>
    <ellipse cx="58" cy="52" rx="19" ry="12" fill="#22C55E" opacity="0.9"/>
    <ellipse cx="34" cy="58" rx="9" ry="6" fill="#22C55E" opacity="0.8"/>
    <ellipse cx="62" cy="32" rx="6" ry="4" fill="#22C55E" opacity="0.7"/>
  </svg>`,

  moon: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <circle cx="50" cy="50" r="36" fill="#D1D5DB" stroke="#9CA3AF" stroke-width="1.5"/>
    <circle cx="62" cy="50" r="36" fill="#F9FAFB"/>
    <circle cx="36" cy="36" r="5" fill="#9CA3AF" opacity="0.5"/>
    <circle cx="52" cy="62" r="4" fill="#9CA3AF" opacity="0.4"/>
    <circle cx="44" cy="50" r="3" fill="#9CA3AF" opacity="0.35"/>
  </svg>`,

  mercury: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <circle cx="50" cy="50" r="28" fill="#B87333" stroke="#92400E" stroke-width="1.5"/>
    <circle cx="38" cy="42" r="6" fill="#92400E" opacity="0.45"/>
    <circle cx="60" cy="56" r="8" fill="#92400E" opacity="0.4"/>
    <circle cx="48" cy="64" r="4" fill="#92400E" opacity="0.35"/>
  </svg>`,

  venus: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <circle cx="50" cy="50" r="34" fill="#FDE68A" stroke="#D97706" stroke-width="1.5"/>
    <ellipse cx="45" cy="40" rx="16" ry="10" fill="#FCD34D" opacity="0.5" transform="rotate(-20 45 40)"/>
    <ellipse cx="58" cy="58" rx="14" ry="8" fill="#FCD34D" opacity="0.5" transform="rotate(15 58 58)"/>
  </svg>`,

  mars: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <circle cx="50" cy="50" r="30" fill="#EF4444" stroke="#B91C1C" stroke-width="1.5"/>
    <circle cx="38" cy="44" r="7" fill="#B91C1C" opacity="0.4"/>
    <circle cx="60" cy="58" r="5" fill="#B91C1C" opacity="0.4"/>
    <ellipse cx="50" cy="28" rx="12" ry="5" fill="#FECACA" opacity="0.6"/>
  </svg>`,

  jupiter: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <circle cx="50" cy="50" r="38" fill="#D4A76A" stroke="#B8860B" stroke-width="1.5"/>
    <ellipse cx="50" cy="37" rx="38" ry="6" fill="#C68642" opacity="0.55"/>
    <ellipse cx="50" cy="50" rx="38" ry="5" fill="#E8C99A" opacity="0.45"/>
    <ellipse cx="50" cy="63" rx="38" ry="6" fill="#C68642" opacity="0.55"/>
    <ellipse cx="63" cy="56" rx="9" ry="5" fill="#CC4400" opacity="0.75"/>
  </svg>`,

  saturn: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <ellipse cx="50" cy="52" rx="46" ry="11" fill="none" stroke="#C8A96E" stroke-width="7" opacity="0.45"/>
    <circle cx="50" cy="50" r="26" fill="#E8D5A3" stroke="#C8A96E" stroke-width="1.5"/>
    <ellipse cx="50" cy="44" rx="26" ry="6" fill="#D4B896" opacity="0.38"/>
    <path d="M 4 52 A 46 11 0 0 0 96 52" fill="none" stroke="#C8A96E" stroke-width="7" opacity="0.72"/>
  </svg>`,

  uranus: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <circle cx="50" cy="50" r="32" fill="#7DE8E8" stroke="#0EA5E9" stroke-width="1.5"/>
    <ellipse cx="50" cy="44" rx="32" ry="8" fill="#A5F3F3" opacity="0.4"/>
    <ellipse cx="50" cy="50" rx="46" ry="8" fill="none" stroke="#67E8F9" stroke-width="3" opacity="0.6"/>
  </svg>`,

  neptune: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <circle cx="50" cy="50" r="30" fill="#3B6FCC" stroke="#1D4ED8" stroke-width="1.5"/>
    <ellipse cx="44" cy="42" rx="13" ry="7" fill="#60A5FA" opacity="0.45" transform="rotate(-20 44 42)"/>
    <ellipse cx="58" cy="60" rx="10" ry="5" fill="#93C5FD" opacity="0.35"/>
  </svg>`,

  planet: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <ellipse cx="50" cy="50" rx="50" ry="16" fill="none" stroke="#A78BFA" stroke-width="2" opacity="0.65"/>
    <circle cx="50" cy="50" r="28" fill="#8B5CF6" stroke="#6D28D9" stroke-width="1.5"/>
  </svg>`,

  star: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <polygon points="50,10 61,37 90,37 67,57 76,84 50,67 24,84 33,57 10,37 39,37"
      fill="#FCD34D" stroke="#F59E0B" stroke-width="1.5"/>
  </svg>`,

  satellite: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <rect x="38" y="38" width="24" height="24" rx="4" fill="#94A3B8" stroke="#475569" stroke-width="2"/>
    <rect x="8" y="44" width="26" height="12" rx="2" fill="#3B82F6" opacity="0.85"/>
    <rect x="66" y="44" width="26" height="12" rx="2" fill="#3B82F6" opacity="0.85"/>
    <line x1="34" y1="50" x2="38" y2="50" stroke="#475569" stroke-width="2"/>
    <line x1="62" y1="50" x2="66" y2="50" stroke="#475569" stroke-width="2"/>
  </svg>`,

  // ── Science ──
  plant: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <rect x="46" y="55" width="8" height="38" rx="4" fill="#92400E"/>
    <ellipse cx="50" cy="38" rx="22" ry="26" fill="#22C55E" stroke="#15803D" stroke-width="1.5"/>
    <ellipse cx="29" cy="56" rx="15" ry="10" fill="#4ADE80" stroke="#16A34A" stroke-width="1" transform="rotate(-35 29 56)"/>
    <ellipse cx="71" cy="56" rx="15" ry="10" fill="#4ADE80" stroke="#16A34A" stroke-width="1" transform="rotate(35 71 56)"/>
    <line x1="50" y1="55" x2="50" y2="38" stroke="#15803D" stroke-width="1.5" stroke-dasharray="3 2"/>
  </svg>`,

  cell: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <ellipse cx="50" cy="50" rx="43" ry="36" fill="#FEF3C7" stroke="#D97706" stroke-width="2" stroke-dasharray="5 2"/>
    <circle cx="50" cy="50" r="15" fill="#FDE68A" stroke="#D97706" stroke-width="1.5"/>
    <circle cx="50" cy="50" r="6" fill="#F59E0B" opacity="0.8"/>
    <circle cx="28" cy="38" r="5" fill="#FCD34D" stroke="#D97706" stroke-width="1" opacity="0.7"/>
    <circle cx="68" cy="62" r="4.5" fill="#FCD34D" stroke="#D97706" stroke-width="1" opacity="0.7"/>
    <circle cx="64" cy="34" r="3.5" fill="#FCD34D" stroke="#D97706" stroke-width="1" opacity="0.6"/>
    <circle cx="35" cy="66" r="3" fill="#FCD34D" stroke="#D97706" stroke-width="1" opacity="0.6"/>
  </svg>`,

  dna: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <path d="M30 8 Q70 28 30 50 Q70 72 30 92" fill="none" stroke="#7C3AED" stroke-width="3" stroke-linecap="round"/>
    <path d="M70 8 Q30 28 70 50 Q30 72 70 92" fill="none" stroke="#EC4899" stroke-width="3" stroke-linecap="round"/>
    <line x1="30" y1="8" x2="70" y2="8" stroke="#94A3B8" stroke-width="2"/>
    <line x1="30" y1="50" x2="70" y2="50" stroke="#94A3B8" stroke-width="2"/>
    <line x1="30" y1="92" x2="70" y2="92" stroke="#94A3B8" stroke-width="2"/>
    <line x1="22" y1="29" x2="78" y2="29" stroke="#94A3B8" stroke-width="1.5" stroke-dasharray="4 2"/>
    <line x1="22" y1="71" x2="78" y2="71" stroke="#94A3B8" stroke-width="1.5" stroke-dasharray="4 2"/>
  </svg>`,

  molecule: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <circle cx="50" cy="50" r="16" fill="#6366F1" stroke="#4338CA" stroke-width="1.5"/>
    <circle cx="18" cy="34" r="11" fill="#F87171" stroke="#DC2626" stroke-width="1.5"/>
    <circle cx="82" cy="34" r="11" fill="#F87171" stroke="#DC2626" stroke-width="1.5"/>
    <line x1="50" y1="50" x2="22" y2="38" stroke="#475569" stroke-width="2"/>
    <line x1="50" y1="50" x2="78" y2="38" stroke="#475569" stroke-width="2"/>
    <text x="50" y="55" text-anchor="middle" fill="white" font-size="10" font-weight="bold" font-family="sans-serif">C</text>
    <text x="18" y="38" text-anchor="middle" fill="white" font-size="8" font-weight="bold" font-family="sans-serif">O</text>
    <text x="82" y="38" text-anchor="middle" fill="white" font-size="8" font-weight="bold" font-family="sans-serif">O</text>
  </svg>`,

  atom: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <ellipse cx="50" cy="50" rx="44" ry="14" fill="none" stroke="#6366F1" stroke-width="2"/>
    <ellipse cx="50" cy="50" rx="44" ry="14" fill="none" stroke="#6366F1" stroke-width="2" transform="rotate(60 50 50)"/>
    <ellipse cx="50" cy="50" rx="44" ry="14" fill="none" stroke="#6366F1" stroke-width="2" transform="rotate(120 50 50)"/>
    <circle cx="50" cy="50" r="9" fill="#6366F1"/>
  </svg>`,

  mitochondria: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <ellipse cx="50" cy="50" rx="42" ry="26" fill="#FEF3C7" stroke="#D97706" stroke-width="2"/>
    <ellipse cx="50" cy="50" rx="36" ry="20" fill="none" stroke="#F59E0B" stroke-width="1" stroke-dasharray="4 2"/>
    <path d="M20 50 Q 35 35 50 50 Q 65 65 80 50" fill="none" stroke="#D97706" stroke-width="1.5"/>
    <path d="M20 50 Q 35 60 50 50 Q 65 40 80 50" fill="none" stroke="#D97706" stroke-width="1.5"/>
  </svg>`,

  chloroplast: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <ellipse cx="50" cy="50" rx="40" ry="24" fill="#D1FAE5" stroke="#059669" stroke-width="2"/>
    <ellipse cx="33" cy="50" rx="11" ry="18" fill="#34D399" stroke="#059669" stroke-width="1"/>
    <ellipse cx="50" cy="50" rx="11" ry="18" fill="#34D399" stroke="#059669" stroke-width="1"/>
    <ellipse cx="67" cy="50" rx="11" ry="18" fill="#34D399" stroke="#059669" stroke-width="1"/>
  </svg>`,

  water: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <path d="M50 10 Q70 45 70 62 A20 20 0 0 1 30 62 Q30 45 50 10Z" fill="#60A5FA" stroke="#2563EB" stroke-width="1.5"/>
    <ellipse cx="50" cy="64" rx="18" ry="10" fill="#93C5FD" opacity="0.6"/>
  </svg>`,

  ocean: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <rect x="0" y="40" width="100" height="60" fill="#1D4ED8"/>
    <path d="M0 42 Q12 34 25 42 Q38 50 50 42 Q62 34 75 42 Q88 50 100 42 L100 100 L0 100Z" fill="#2563EB"/>
    <path d="M0 54 Q12 46 25 54 Q38 62 50 54 Q62 46 75 54 Q88 62 100 54 L100 100 L0 100Z" fill="#3B82F6" opacity="0.7"/>
    <circle cx="18" cy="24" r="8" fill="#FCD34D" stroke="#F59E0B" stroke-width="1.5" opacity="0.9"/>
    <line x1="18" y1="12" x2="18" y2="6" stroke="#F59E0B" stroke-width="2" stroke-linecap="round"/>
    <line x1="30" y1="24" x2="36" y2="24" stroke="#F59E0B" stroke-width="2" stroke-linecap="round"/>
    <line x1="27" y1="15" x2="31" y2="11" stroke="#F59E0B" stroke-width="1.5" stroke-linecap="round"/>
  </svg>`,

  rain: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <ellipse cx="34" cy="32" rx="20" ry="14" fill="#93C5FD" stroke="#3B82F6" stroke-width="1.5"/>
    <ellipse cx="60" cy="26" rx="26" ry="16" fill="#BFDBFE" stroke="#3B82F6" stroke-width="1.5"/>
    <ellipse cx="78" cy="36" rx="16" ry="12" fill="#93C5FD" stroke="#3B82F6" stroke-width="1.5"/>
    <rect x="8" y="48" width="100" height="10" fill="#BFDBFE" stroke="none"/>
    <line x1="28" y1="58" x2="22" y2="76" stroke="#60A5FA" stroke-width="2.5" stroke-linecap="round"/>
    <line x1="44" y1="58" x2="38" y2="80" stroke="#60A5FA" stroke-width="2.5" stroke-linecap="round"/>
    <line x1="60" y1="58" x2="54" y2="76" stroke="#60A5FA" stroke-width="2.5" stroke-linecap="round"/>
    <line x1="76" y1="58" x2="70" y2="80" stroke="#60A5FA" stroke-width="2.5" stroke-linecap="round"/>
  </svg>`,

  precipitation: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <ellipse cx="34" cy="30" rx="20" ry="14" fill="#93C5FD" stroke="#3B82F6" stroke-width="1.5"/>
    <ellipse cx="60" cy="24" rx="26" ry="16" fill="#BFDBFE" stroke="#3B82F6" stroke-width="1.5"/>
    <ellipse cx="78" cy="34" rx="16" ry="12" fill="#93C5FD" stroke="#3B82F6" stroke-width="1.5"/>
    <rect x="8" y="46" width="100" height="8" fill="#BFDBFE" stroke="none"/>
    <path d="M30 56 L26 70 L30 70 L26 84" stroke="#3B82F6" stroke-width="2" fill="none" stroke-linecap="round"/>
    <path d="M50 56 L46 70 L50 70 L46 84" stroke="#3B82F6" stroke-width="2" fill="none" stroke-linecap="round"/>
    <path d="M70 56 L66 70 L70 70 L66 84" stroke="#3B82F6" stroke-width="2" fill="none" stroke-linecap="round"/>
  </svg>`,

  vapor: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <path d="M30 80 Q 28 65 40 55 Q 30 42 38 30 Q 46 18 56 28 Q 66 16 72 28 Q 82 22 82 36 Q 94 42 88 54 Q 96 66 84 74 Q 80 86 66 82 Q 60 92 48 86 Q 38 92 30 80Z" fill="#E0F2FE" stroke="#7DD3FC" stroke-width="1.5" opacity="0.8"/>
    <text x="50" y="58" text-anchor="middle" fill="#0284C7" font-size="11" font-family="sans-serif" font-style="italic">H₂O vapor</text>
  </svg>`,

  water_vapor: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <path d="M30 80 Q 28 65 40 55 Q 30 42 38 30 Q 46 18 56 28 Q 66 16 72 28 Q 82 22 82 36 Q 94 42 88 54 Q 96 66 84 74 Q 80 86 66 82 Q 60 92 48 86 Q 38 92 30 80Z" fill="#E0F2FE" stroke="#7DD3FC" stroke-width="1.5" opacity="0.8"/>
    <text x="50" y="58" text-anchor="middle" fill="#0284C7" font-size="11" font-family="sans-serif" font-style="italic">H₂O vapor</text>
  </svg>`,

  evaporation: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <path d="M10 80 Q30 70 50 72 Q70 70 90 80 L90 90 L10 90Z" fill="#3B82F6" opacity="0.7"/>
    <path d="M28 68 Q 30 52 36 40" stroke="#93C5FD" stroke-width="2" fill="none" stroke-linecap="round" stroke-dasharray="3 3"/>
    <path d="M50 70 Q 50 52 50 36" stroke="#93C5FD" stroke-width="2" fill="none" stroke-linecap="round" stroke-dasharray="3 3"/>
    <path d="M72 68 Q 70 52 64 40" stroke="#93C5FD" stroke-width="2" fill="none" stroke-linecap="round" stroke-dasharray="3 3"/>
    <path d="M33 34 L36 40 L39 34" fill="#93C5FD" stroke="none"/>
    <path d="M47 30 L50 36 L53 30" fill="#93C5FD" stroke="none"/>
    <path d="M61 34 L64 40 L67 34" fill="#93C5FD" stroke="none"/>
    <ellipse cx="50" cy="22" rx="22" ry="14" fill="#DBEAFE" stroke="#60A5FA" stroke-width="1.5" opacity="0.75"/>
  </svg>`,

  condensation: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <ellipse cx="34" cy="26" rx="20" ry="13" fill="#BFDBFE" stroke="#3B82F6" stroke-width="1.5"/>
    <ellipse cx="62" cy="20" rx="26" ry="15" fill="#93C5FD" stroke="#3B82F6" stroke-width="1.5"/>
    <ellipse cx="78" cy="30" rx="16" ry="11" fill="#BFDBFE" stroke="#3B82F6" stroke-width="1.5"/>
    <rect x="8" y="40" width="100" height="6" fill="#BFDBFE" stroke="none"/>
    <path d="M40 50 Q42 60 38 68" stroke="#60A5FA" stroke-width="2" fill="none" stroke-linecap="round"/>
    <circle cx="37" cy="71" r="3.5" fill="#3B82F6"/>
    <path d="M60 50 Q62 60 58 68" stroke="#60A5FA" stroke-width="2" fill="none" stroke-linecap="round"/>
    <circle cx="57" cy="71" r="3.5" fill="#3B82F6"/>
    <path d="M75 50 Q77 60 73 68" stroke="#60A5FA" stroke-width="2" fill="none" stroke-linecap="round"/>
    <circle cx="72" cy="71" r="3.5" fill="#3B82F6"/>
  </svg>`,

  mountain: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <polygon points="50,8 82,72 18,72" fill="#64748B" stroke="#475569" stroke-width="1.5"/>
    <polygon points="50,8 62,34 38,34" fill="#F1F5F9"/>
    <polygon points="28,44 52,80 4,80" fill="#94A3B8" stroke="#64748B" stroke-width="1"/>
    <polygon points="28,44 36,58 20,58" fill="#E2E8F0"/>
    <rect x="0" y="80" width="100" height="20" fill="#86EFAC" stroke="none" rx="2"/>
  </svg>`,

  // ── Software / Tech ──
  user: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <circle cx="50" cy="30" r="20" fill="#93C5FD" stroke="#3B82F6" stroke-width="2"/>
    <path d="M12 92 Q12 62 50 62 Q88 62 88 92" fill="#93C5FD" stroke="#3B82F6" stroke-width="2"/>
  </svg>`,

  browser: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <rect x="5" y="14" width="90" height="75" rx="6" fill="#F0F9FF" stroke="#0EA5E9" stroke-width="2"/>
    <rect x="5" y="14" width="90" height="22" rx="6" fill="#0EA5E9"/>
    <rect x="5" y="25" width="90" height="11" fill="#0EA5E9"/>
    <circle cx="17" cy="25" r="4" fill="#F87171"/>
    <circle cx="29" cy="25" r="4" fill="#FCD34D"/>
    <circle cx="41" cy="25" r="4" fill="#4ADE80"/>
    <rect x="52" y="19" width="35" height="12" rx="6" fill="#BAE6FD"/>
    <rect x="14" y="46" width="72" height="8" rx="3" fill="#BAE6FD" opacity="0.5"/>
    <rect x="14" y="60" width="50" height="8" rx="3" fill="#BAE6FD" opacity="0.4"/>
    <rect x="14" y="74" width="60" height="8" rx="3" fill="#BAE6FD" opacity="0.3"/>
  </svg>`,

  frontend: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <rect x="5" y="14" width="90" height="72" rx="6" fill="#F0F9FF" stroke="#0EA5E9" stroke-width="2"/>
    <rect x="5" y="14" width="90" height="18" rx="6" fill="#0EA5E9"/>
    <rect x="5" y="22" width="90" height="10" fill="#0EA5E9"/>
    <text x="50" y="60" text-anchor="middle" fill="#0EA5E9" font-size="22" font-weight="bold" font-family="monospace">&lt;/&gt;</text>
  </svg>`,

  server: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <rect x="14" y="8" width="72" height="22" rx="4" fill="#1E293B" stroke="#475569" stroke-width="1.5"/>
    <rect x="14" y="34" width="72" height="22" rx="4" fill="#1E293B" stroke="#475569" stroke-width="1.5"/>
    <rect x="14" y="60" width="72" height="22" rx="4" fill="#1E293B" stroke="#475569" stroke-width="1.5"/>
    <circle cx="74" cy="19" r="4" fill="#4ADE80"/>
    <circle cx="82" cy="19" r="4" fill="#4ADE80"/>
    <circle cx="74" cy="45" r="4" fill="#4ADE80"/>
    <circle cx="82" cy="45" r="4" fill="#60A5FA"/>
    <circle cx="74" cy="71" r="4" fill="#FCD34D"/>
    <circle cx="82" cy="71" r="4" fill="#4ADE80"/>
    <rect x="20" y="15" width="44" height="8" rx="2" fill="#334155"/>
  </svg>`,

  api_server: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <rect x="14" y="14" width="72" height="72" rx="8" fill="#F0FDF4" stroke="#16A34A" stroke-width="2"/>
    <text x="50" y="45" text-anchor="middle" fill="#16A34A" font-size="14" font-weight="bold" font-family="monospace">API</text>
    <rect x="22" y="52" width="56" height="8" rx="4" fill="#D1FAE5"/>
    <rect x="22" y="64" width="40" height="8" rx="4" fill="#D1FAE5"/>
    <circle cx="78" cy="22" r="6" fill="#4ADE80" stroke="#16A34A" stroke-width="1"/>
  </svg>`,

  backend: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <rect x="14" y="20" width="72" height="60" rx="6" fill="#1E293B" stroke="#334155" stroke-width="2"/>
    <text x="50" y="54" text-anchor="middle" fill="#4ADE80" font-size="12" font-weight="bold" font-family="monospace">{code}</text>
    <circle cx="24" cy="30" r="4" fill="#F87171"/>
    <circle cx="36" cy="30" r="4" fill="#FCD34D"/>
    <circle cx="48" cy="30" r="4" fill="#4ADE80"/>
  </svg>`,

  database: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <ellipse cx="50" cy="24" rx="36" ry="12" fill="#0EA5E9" stroke="#0284C7" stroke-width="1.5"/>
    <rect x="14" y="24" width="72" height="52" fill="#BAE6FD" stroke="#0284C7" stroke-width="1.5"/>
    <ellipse cx="50" cy="76" rx="36" ry="12" fill="#0EA5E9" stroke="#0284C7" stroke-width="1.5"/>
    <ellipse cx="50" cy="50" rx="36" ry="9" fill="none" stroke="#0284C7" stroke-width="1" stroke-dasharray="4 2"/>
  </svg>`,

  cloud: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <circle cx="34" cy="58" r="22" fill="#BFDBFE" stroke="#3B82F6" stroke-width="1.5"/>
    <circle cx="58" cy="50" r="26" fill="#BFDBFE" stroke="#3B82F6" stroke-width="1.5"/>
    <circle cx="76" cy="60" r="18" fill="#BFDBFE" stroke="#3B82F6" stroke-width="1.5"/>
    <rect x="16" y="60" width="68" height="22" rx="2" fill="#BFDBFE" stroke="none"/>
  </svg>`,

  jwt: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <rect x="8" y="18" width="84" height="64" rx="8" fill="#1E1B4B" stroke="#4F46E5" stroke-width="2"/>
    <rect x="8" y="18" width="28" height="64" rx="4" fill="#DC2626" opacity="0.75"/>
    <rect x="36" y="18" width="28" height="64" fill="#6D28D9" opacity="0.75"/>
    <rect x="64" y="18" width="28" height="64" rx="4" fill="#0369A1" opacity="0.75"/>
    <text x="50" y="58" text-anchor="middle" fill="white" font-size="13" font-weight="bold" font-family="monospace">JWT</text>
  </svg>`,

  cache: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <rect x="10" y="20" width="80" height="60" rx="6" fill="#FEF3C7" stroke="#D97706" stroke-width="2"/>
    <text x="50" y="52" text-anchor="middle" fill="#92400E" font-size="11" font-weight="bold" font-family="monospace">CACHE</text>
    <circle cx="22" cy="32" r="5" fill="#FCD34D"/>
    <circle cx="34" cy="32" r="5" fill="#FCD34D"/>
    <circle cx="46" cy="32" r="5" fill="#FCD34D"/>
  </svg>`,

  queue: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <rect x="8" y="28" width="84" height="44" rx="6" fill="#F0FDF4" stroke="#16A34A" stroke-width="2"/>
    <rect x="14" y="35" width="18" height="30" rx="3" fill="#4ADE80"/>
    <rect x="36" y="35" width="18" height="30" rx="3" fill="#4ADE80"/>
    <rect x="58" y="35" width="18" height="30" rx="3" fill="#4ADE80"/>
    <path d="M82 50 L92 50" stroke="#16A34A" stroke-width="2.5" stroke-linecap="round"/>
    <path d="M88 44 L94 50 L88 56" fill="none" stroke="#16A34A" stroke-width="2" stroke-linecap="round"/>
  </svg>`,

  // ── Industry / History ──
  factory: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <rect x="10" y="42" width="80" height="48" rx="2" fill="#94A3B8" stroke="#475569" stroke-width="1.5"/>
    <rect x="18" y="22" width="10" height="26" rx="2" fill="#64748B" stroke="#475569" stroke-width="1"/>
    <rect x="38" y="28" width="10" height="20" rx="2" fill="#64748B" stroke="#475569" stroke-width="1"/>
    <rect x="58" y="18" width="10" height="30" rx="2" fill="#64748B" stroke="#475569" stroke-width="1"/>
    <circle cx="23" cy="18" r="4" fill="#CBD5E1" opacity="0.75"/>
    <circle cx="43" cy="24" r="3.5" fill="#CBD5E1" opacity="0.65"/>
    <circle cx="63" cy="14" r="4" fill="#CBD5E1" opacity="0.75"/>
    <rect x="16" y="52" width="16" height="14" rx="2" fill="#BAE6FD"/>
    <rect x="42" y="52" width="16" height="14" rx="2" fill="#BAE6FD"/>
    <rect x="68" y="52" width="16" height="14" rx="2" fill="#BAE6FD"/>
    <rect x="38" y="70" width="24" height="20" rx="2" fill="#78350F"/>
  </svg>`,

  train: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <rect x="6" y="28" width="70" height="40" rx="8" fill="#1E40AF" stroke="#1E3A8A" stroke-width="1.5"/>
    <rect x="70" y="33" width="20" height="30" rx="4" fill="#1D4ED8" stroke="#1E3A8A" stroke-width="1.5"/>
    <rect x="12" y="34" width="16" height="12" rx="2" fill="#BAE6FD"/>
    <rect x="32" y="34" width="16" height="12" rx="2" fill="#BAE6FD"/>
    <rect x="52" y="34" width="14" height="12" rx="2" fill="#BAE6FD"/>
    <rect x="74" y="36" width="12" height="10" rx="2" fill="#BAE6FD"/>
    <circle cx="22" cy="72" r="9" fill="#374151" stroke="#111827" stroke-width="1.5"/>
    <circle cx="50" cy="72" r="9" fill="#374151" stroke="#111827" stroke-width="1.5"/>
    <circle cx="78" cy="72" r="7" fill="#374151" stroke="#111827" stroke-width="1.5"/>
    <circle cx="22" cy="72" r="3" fill="#9CA3AF"/>
    <circle cx="50" cy="72" r="3" fill="#9CA3AF"/>
    <circle cx="78" cy="72" r="2.5" fill="#9CA3AF"/>
    <line x1="2" y1="81" x2="98" y2="81" stroke="#6B7280" stroke-width="2"/>
  </svg>`,

  ship: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <path d="M8 54 L16 76 Q50 86 84 76 L92 54 Z" fill="#1E40AF" stroke="#1E3A8A" stroke-width="1.5"/>
    <rect x="12" y="34" width="76" height="22" rx="4" fill="#3B82F6" stroke="#1D4ED8" stroke-width="1.5"/>
    <rect x="28" y="16" width="44" height="22" rx="4" fill="#60A5FA" stroke="#3B82F6" stroke-width="1.5"/>
    <rect x="34" y="20" width="10" height="8" rx="2" fill="#BAE6FD"/>
    <rect x="56" y="20" width="10" height="8" rx="2" fill="#BAE6FD"/>
    <line x1="50" y1="6" x2="50" y2="16" stroke="#D97706" stroke-width="2"/>
    <polygon points="50,6 64,11 50,16" fill="#EF4444"/>
    <path d="M2 80 Q20 74 38 80 Q56 86 74 80 Q90 74 98 80" fill="none" stroke="#7DD3FC" stroke-width="2.5" stroke-linecap="round"/>
  </svg>`,

  steam_engine: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <rect x="4" y="34" width="68" height="36" rx="6" fill="#475569" stroke="#334155" stroke-width="2"/>
    <rect x="72" y="40" width="20" height="24" rx="3" fill="#64748B" stroke="#334155" stroke-width="1.5"/>
    <rect x="28" y="18" width="10" height="20" rx="3" fill="#334155" stroke="#1E293B" stroke-width="1"/>
    <circle cx="33" cy="14" r="4" fill="#CBD5E1" opacity="0.75"/>
    <circle cx="33" cy="9" r="3" fill="#CBD5E1" opacity="0.5"/>
    <circle cx="18" cy="72" r="10" fill="#1E293B" stroke="#0F172A" stroke-width="1.5"/>
    <circle cx="18" cy="72" r="4" fill="#64748B"/>
    <circle cx="50" cy="72" r="10" fill="#1E293B" stroke="#0F172A" stroke-width="1.5"/>
    <circle cx="50" cy="72" r="4" fill="#64748B"/>
    <line x1="2" y1="82" x2="98" y2="82" stroke="#374151" stroke-width="2"/>
  </svg>`,

  leaf: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <path d="M50 88 Q22 68 16 40 Q12 18 50 10 Q88 18 84 40 Q78 68 50 88Z" fill="#4ADE80" stroke="#15803D" stroke-width="2"/>
    <line x1="50" y1="88" x2="50" y2="18" stroke="#15803D" stroke-width="1.5"/>
    <line x1="50" y1="68" x2="32" y2="52" stroke="#15803D" stroke-width="1" opacity="0.7"/>
    <line x1="50" y1="58" x2="30" y2="44" stroke="#15803D" stroke-width="1" opacity="0.6"/>
    <line x1="50" y1="68" x2="68" y2="52" stroke="#15803D" stroke-width="1" opacity="0.7"/>
    <line x1="50" y1="58" x2="70" y2="44" stroke="#15803D" stroke-width="1" opacity="0.6"/>
    <line x1="50" y1="48" x2="68" y2="36" stroke="#15803D" stroke-width="1" opacity="0.5"/>
    <line x1="50" y1="48" x2="32" y2="36" stroke="#15803D" stroke-width="1" opacity="0.5"/>
  </svg>`,

  energy: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <polygon points="58,6 28,50 48,50 38,94 72,50 52,50" fill="#FCD34D" stroke="#D97706" stroke-width="2"/>
  </svg>`,

  lightning: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <polygon points="58,6 28,50 48,50 38,94 72,50 52,50" fill="#FCD34D" stroke="#D97706" stroke-width="2"/>
  </svg>`,

  electricity: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <polygon points="58,6 28,50 48,50 38,94 72,50 52,50" fill="#FCD34D" stroke="#D97706" stroke-width="2"/>
  </svg>`,

  gear: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <path d="M42 8 L38 18 Q32 20 26 24 L16 20 L8 28 L12 38 Q10 44 10 50 L0 54 L0 66 L10 70 Q10 76 12 82 L8 92 L16 100 L26 96 Q32 100 38 102 L42 112 L58 112 L62 102 Q68 100 74 96 L84 100 L92 92 L88 82 Q90 76 90 70 L100 66 L100 54 L90 50 Q90 44 88 38 L92 28 L84 20 L74 24 Q68 20 62 18 L58 8 Z" fill="none"/>
    <circle cx="50" cy="50" r="30" fill="#CBD5E1" stroke="#64748B" stroke-width="2"/>
    <rect x="44" y="4" width="12" height="18" rx="3" fill="#94A3B8" stroke="#64748B" stroke-width="1"/>
    <rect x="44" y="78" width="12" height="18" rx="3" fill="#94A3B8" stroke="#64748B" stroke-width="1"/>
    <rect x="4" y="44" width="18" height="12" rx="3" fill="#94A3B8" stroke="#64748B" stroke-width="1"/>
    <rect x="78" y="44" width="18" height="12" rx="3" fill="#94A3B8" stroke="#64748B" stroke-width="1"/>
    <rect x="16" y="16" width="12" height="18" rx="3" fill="#94A3B8" stroke="#64748B" stroke-width="1" transform="rotate(45 22 25)"/>
    <rect x="72" y="16" width="12" height="18" rx="3" fill="#94A3B8" stroke="#64748B" stroke-width="1" transform="rotate(-45 78 25)"/>
    <rect x="16" y="66" width="12" height="18" rx="3" fill="#94A3B8" stroke="#64748B" stroke-width="1" transform="rotate(-45 22 75)"/>
    <rect x="72" y="66" width="12" height="18" rx="3" fill="#94A3B8" stroke="#64748B" stroke-width="1" transform="rotate(45 78 75)"/>
    <circle cx="50" cy="50" r="14" fill="#F1F5F9" stroke="#64748B" stroke-width="1.5"/>
  </svg>`,

  tool: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <path d="M72 8 Q84 6 88 18 L78 28 L72 22 Z" fill="#94A3B8" stroke="#64748B" stroke-width="1.5"/>
    <rect x="18" y="58" width="56" height="14" rx="7" fill="#94A3B8" stroke="#64748B" stroke-width="1.5" transform="rotate(-45 46 65)"/>
    <circle cx="24" cy="78" r="12" fill="#CBD5E1" stroke="#64748B" stroke-width="2"/>
    <circle cx="24" cy="78" r="5" fill="#94A3B8"/>
  </svg>`,

  hand_tools: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <path d="M72 8 Q84 6 88 18 L78 28 L72 22 Z" fill="#94A3B8" stroke="#64748B" stroke-width="1.5"/>
    <rect x="18" y="58" width="56" height="14" rx="7" fill="#94A3B8" stroke="#64748B" stroke-width="1.5" transform="rotate(-45 46 65)"/>
    <circle cx="24" cy="78" r="12" fill="#CBD5E1" stroke="#64748B" stroke-width="2"/>
    <circle cx="24" cy="78" r="5" fill="#94A3B8"/>
  </svg>`,

  // ── Mathematics / Geography ──
  venn_diagram: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <circle cx="36" cy="50" r="30" fill="#DBEAFE" stroke="#3B82F6" stroke-width="2" fill-opacity="0.7"/>
    <circle cx="64" cy="50" r="30" fill="#FCE7F3" stroke="#EC4899" stroke-width="2" fill-opacity="0.7"/>
    <text x="22" y="54" text-anchor="middle" fill="#1D4ED8" font-size="11" font-weight="bold" font-family="sans-serif">A</text>
    <text x="78" y="54" text-anchor="middle" fill="#9D174D" font-size="11" font-weight="bold" font-family="sans-serif">B</text>
    <text x="50" y="54" text-anchor="middle" fill="#4B5563" font-size="12" font-family="sans-serif">∩</text>
  </svg>`,

  number_line: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <line x1="8" y1="50" x2="92" y2="50" stroke="#374151" stroke-width="2.5" stroke-linecap="round"/>
    <path d="M88 44 L94 50 L88 56" fill="#374151"/>
    <path d="M12 44 L6 50 L12 56" fill="#374151"/>
    <line x1="25" y1="43" x2="25" y2="57" stroke="#374151" stroke-width="1.5"/>
    <line x1="50" y1="40" x2="50" y2="60" stroke="#374151" stroke-width="2"/>
    <line x1="75" y1="43" x2="75" y2="57" stroke="#374151" stroke-width="1.5"/>
    <text x="25" y="70" text-anchor="middle" fill="#374151" font-size="9" font-family="sans-serif">-1</text>
    <text x="50" y="70" text-anchor="middle" fill="#374151" font-size="9" font-family="sans-serif">0</text>
    <text x="75" y="70" text-anchor="middle" fill="#374151" font-size="9" font-family="sans-serif">1</text>
    <circle cx="63" cy="50" r="5" fill="#EF4444"/>
    <text x="63" y="36" text-anchor="middle" fill="#EF4444" font-size="10" font-weight="bold" font-family="sans-serif">x</text>
    <line x1="63" y1="38" x2="63" y2="45" stroke="#EF4444" stroke-width="1.5" stroke-dasharray="2 2"/>
  </svg>`,

  map_region: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <path d="M18 28 L34 16 L56 20 L74 14 L82 26 L78 42 L86 56 L80 70 L66 74 L50 80 L34 72 L20 62 L12 46 Z"
      fill="#D1FAE5" stroke="#059669" stroke-width="2"/>
    <path d="M38 28 L56 20 L60 38 L44 46 Z" fill="#A7F3D0" stroke="#059669" stroke-width="1"/>
    <path d="M44 46 L60 38 L74 52 L58 62 Z" fill="#6EE7B7" stroke="#059669" stroke-width="1"/>
    <circle cx="34" cy="40" r="3" fill="#065F46"/>
    <circle cx="60" cy="54" r="3" fill="#065F46"/>
    <circle cx="48" cy="66" r="2.5" fill="#065F46"/>
    <text x="87" y="20" text-anchor="middle" fill="#374151" font-size="8" font-family="sans-serif">N</text>
    <line x1="87" y1="21" x2="87" y2="30" stroke="#374151" stroke-width="1.5"/>
    <path d="M84 25 L87 21 L90 25" fill="#374151"/>
  </svg>`,

  triangle: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <polygon points="50,10 90,85 10,85" fill="#EFF6FF" stroke="#3B82F6" stroke-width="2.5"/>
    <line x1="90" y1="85" x2="10" y2="85" stroke="#3B82F6" stroke-width="2.5"/>
    <path d="M 80 85 L 80 75 L 90 75" fill="none" stroke="#EF4444" stroke-width="2"/>
  </svg>`,

  coordinate_plane: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <line x1="10" y1="50" x2="90" y2="50" stroke="#374151" stroke-width="2"/>
    <line x1="50" y1="10" x2="50" y2="90" stroke="#374151" stroke-width="2"/>
    <path d="M86 44 L94 50 L86 56" fill="#374151"/>
    <path d="M44 14 L50 6 L56 14" fill="#374151"/>
    <circle cx="68" cy="32" r="4" fill="#EF4444"/>
    <circle cx="32" cy="68" r="4" fill="#3B82F6"/>
  </svg>`,

  graph: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <line x1="12" y1="88" x2="92" y2="88" stroke="#374151" stroke-width="2"/>
    <line x1="12" y1="88" x2="12" y2="8" stroke="#374151" stroke-width="2"/>
    <polyline points="16,82 32,64 48,56 64,36 80,22" fill="none" stroke="#3B82F6" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="16" cy="82" r="3.5" fill="#3B82F6"/>
    <circle cx="32" cy="64" r="3.5" fill="#3B82F6"/>
    <circle cx="48" cy="56" r="3.5" fill="#3B82F6"/>
    <circle cx="64" cy="36" r="3.5" fill="#3B82F6"/>
    <circle cx="80" cy="22" r="3.5" fill="#3B82F6"/>
  </svg>`,

  // ── Computer Science ──
  algorithm: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <polygon points="50,8 76,28 50,48 24,28" fill="#DDD6FE" stroke="#7C3AED" stroke-width="1.5"/>
    <rect x="28" y="58" width="44" height="22" rx="3" fill="#EDE9FE" stroke="#7C3AED" stroke-width="1.5"/>
    <line x1="50" y1="48" x2="50" y2="58" stroke="#7C3AED" stroke-width="2"/>
    <path d="M46 55 L50 60 L54 55" fill="#7C3AED"/>
    <text x="50" y="31" text-anchor="middle" fill="#6D28D9" font-size="8" font-family="sans-serif">if/else</text>
    <text x="50" y="72" text-anchor="middle" fill="#6D28D9" font-size="8" font-family="sans-serif">process</text>
  </svg>`,

  data_structure: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <rect x="32" y="8" width="36" height="22" rx="4" fill="#DBEAFE" stroke="#3B82F6" stroke-width="1.5"/>
    <rect x="8" y="56" width="36" height="22" rx="4" fill="#DBEAFE" stroke="#3B82F6" stroke-width="1.5"/>
    <rect x="56" y="56" width="36" height="22" rx="4" fill="#DBEAFE" stroke="#3B82F6" stroke-width="1.5"/>
    <line x1="50" y1="30" x2="26" y2="56" stroke="#3B82F6" stroke-width="2"/>
    <line x1="50" y1="30" x2="74" y2="56" stroke="#3B82F6" stroke-width="2"/>
    <text x="50" y="23" text-anchor="middle" fill="#1D4ED8" font-size="8" font-family="monospace">root</text>
    <text x="26" y="71" text-anchor="middle" fill="#1D4ED8" font-size="8" font-family="monospace">left</text>
    <text x="74" y="71" text-anchor="middle" fill="#1D4ED8" font-size="8" font-family="monospace">right</text>
  </svg>`,

  tree: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <circle cx="50" cy="16" r="10" fill="#DBEAFE" stroke="#3B82F6" stroke-width="1.5"/>
    <circle cx="24" cy="50" r="10" fill="#DBEAFE" stroke="#3B82F6" stroke-width="1.5"/>
    <circle cx="76" cy="50" r="10" fill="#DBEAFE" stroke="#3B82F6" stroke-width="1.5"/>
    <circle cx="12" cy="82" r="8" fill="#BFDBFE" stroke="#3B82F6" stroke-width="1.5"/>
    <circle cx="36" cy="82" r="8" fill="#BFDBFE" stroke="#3B82F6" stroke-width="1.5"/>
    <circle cx="64" cy="82" r="8" fill="#BFDBFE" stroke="#3B82F6" stroke-width="1.5"/>
    <circle cx="88" cy="82" r="8" fill="#BFDBFE" stroke="#3B82F6" stroke-width="1.5"/>
    <line x1="50" y1="26" x2="30" y2="40" stroke="#3B82F6" stroke-width="1.5"/>
    <line x1="50" y1="26" x2="70" y2="40" stroke="#3B82F6" stroke-width="1.5"/>
    <line x1="24" y1="60" x2="15" y2="74" stroke="#3B82F6" stroke-width="1.5"/>
    <line x1="24" y1="60" x2="33" y2="74" stroke="#3B82F6" stroke-width="1.5"/>
    <line x1="76" y1="60" x2="67" y2="74" stroke="#3B82F6" stroke-width="1.5"/>
    <line x1="76" y1="60" x2="85" y2="74" stroke="#3B82F6" stroke-width="1.5"/>
  </svg>`,

  stack: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <rect x="18" y="66" width="64" height="18" rx="3" fill="#FEF3C7" stroke="#D97706" stroke-width="1.5"/>
    <rect x="18" y="45" width="64" height="18" rx="3" fill="#FDE68A" stroke="#D97706" stroke-width="1.5"/>
    <rect x="18" y="24" width="64" height="18" rx="3" fill="#FCD34D" stroke="#D97706" stroke-width="1.5"/>
    <text x="50" y="79" text-anchor="middle" fill="#92400E" font-size="9" font-family="monospace">bottom</text>
    <text x="50" y="58" text-anchor="middle" fill="#92400E" font-size="9" font-family="monospace">middle</text>
    <text x="50" y="37" text-anchor="middle" fill="#92400E" font-size="9" font-family="monospace">top ← push</text>
    <path d="M50 10 L50 20" stroke="#D97706" stroke-width="2"/>
    <path d="M44 18 L50 24 L56 18" fill="#D97706"/>
  </svg>`,

  array: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <rect x="8" y="34" width="84" height="32" rx="0" fill="none" stroke="#3B82F6" stroke-width="2"/>
    <line x1="29" y1="34" x2="29" y2="66" stroke="#3B82F6" stroke-width="1.5"/>
    <line x1="50" y1="34" x2="50" y2="66" stroke="#3B82F6" stroke-width="1.5"/>
    <line x1="71" y1="34" x2="71" y2="66" stroke="#3B82F6" stroke-width="1.5"/>
    <text x="18" y="55" text-anchor="middle" fill="#1D4ED8" font-size="12" font-weight="bold" font-family="monospace">0</text>
    <text x="39" y="55" text-anchor="middle" fill="#1D4ED8" font-size="12" font-weight="bold" font-family="monospace">1</text>
    <text x="60" y="55" text-anchor="middle" fill="#1D4ED8" font-size="12" font-weight="bold" font-family="monospace">2</text>
    <text x="82" y="55" text-anchor="middle" fill="#1D4ED8" font-size="12" font-weight="bold" font-family="monospace">3</text>
    <text x="18" y="80" text-anchor="middle" fill="#94A3B8" font-size="8" font-family="sans-serif">[0]</text>
    <text x="39" y="80" text-anchor="middle" fill="#94A3B8" font-size="8" font-family="sans-serif">[1]</text>
    <text x="60" y="80" text-anchor="middle" fill="#94A3B8" font-size="8" font-family="sans-serif">[2]</text>
    <text x="82" y="80" text-anchor="middle" fill="#94A3B8" font-size="8" font-family="sans-serif">[3]</text>
  </svg>`,

  network: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <circle cx="50" cy="50" r="10" fill="#6366F1" stroke="#4338CA" stroke-width="1.5"/>
    <circle cx="16" cy="26" r="8" fill="#A5B4FC" stroke="#6366F1" stroke-width="1.5"/>
    <circle cx="84" cy="26" r="8" fill="#A5B4FC" stroke="#6366F1" stroke-width="1.5"/>
    <circle cx="16" cy="74" r="8" fill="#A5B4FC" stroke="#6366F1" stroke-width="1.5"/>
    <circle cx="84" cy="74" r="8" fill="#A5B4FC" stroke="#6366F1" stroke-width="1.5"/>
    <circle cx="50" cy="16" r="7" fill="#C7D2FE" stroke="#6366F1" stroke-width="1.5"/>
    <line x1="50" y1="40" x2="22" y2="30" stroke="#6366F1" stroke-width="1.5"/>
    <line x1="50" y1="40" x2="78" y2="30" stroke="#6366F1" stroke-width="1.5"/>
    <line x1="50" y1="60" x2="22" y2="70" stroke="#6366F1" stroke-width="1.5"/>
    <line x1="50" y1="60" x2="78" y2="70" stroke="#6366F1" stroke-width="1.5"/>
    <line x1="50" y1="40" x2="50" y2="23" stroke="#6366F1" stroke-width="1.5"/>
  </svg>`,

  // ── Economics ──
  coin: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <circle cx="50" cy="50" r="40" fill="#FCD34D" stroke="#D97706" stroke-width="2.5"/>
    <circle cx="50" cy="50" r="32" fill="none" stroke="#F59E0B" stroke-width="1.5"/>
    <text x="50" y="58" text-anchor="middle" fill="#92400E" font-size="28" font-weight="bold" font-family="sans-serif">$</text>
  </svg>`,

  money: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <rect x="8" y="26" width="84" height="48" rx="6" fill="#D1FAE5" stroke="#059669" stroke-width="2"/>
    <circle cx="50" cy="50" r="16" fill="#A7F3D0" stroke="#059669" stroke-width="1.5"/>
    <text x="50" y="56" text-anchor="middle" fill="#065F46" font-size="16" font-weight="bold" font-family="sans-serif">$</text>
    <circle cx="22" cy="50" r="6" fill="#6EE7B7" stroke="#059669" stroke-width="1"/>
    <circle cx="78" cy="50" r="6" fill="#6EE7B7" stroke="#059669" stroke-width="1"/>
  </svg>`,

  market: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <rect x="10" y="44" width="80" height="46" rx="4" fill="#ECFDF5" stroke="#059669" stroke-width="1.5"/>
    <polygon points="50,10 10,44 90,44" fill="#34D399" stroke="#059669" stroke-width="1.5"/>
    <rect x="24" y="60" width="18" height="30" rx="2" fill="#6EE7B7"/>
    <rect x="58" y="60" width="18" height="30" rx="2" fill="#6EE7B7"/>
    <rect x="41" y="52" width="18" height="38" rx="2" fill="#059669"/>
  </svg>`,

  supply: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <line x1="10" y1="90" x2="90" y2="90" stroke="#374151" stroke-width="2"/>
    <line x1="10" y1="90" x2="10" y2="10" stroke="#374151" stroke-width="2"/>
    <polyline points="12,80 32,68 52,52 72,32 88,18" fill="none" stroke="#10B981" stroke-width="2.5" stroke-linecap="round"/>
    <text x="82" y="14" text-anchor="middle" fill="#10B981" font-size="9" font-family="sans-serif">S</text>
    <text x="52" y="100" text-anchor="middle" fill="#374151" font-size="8" font-family="sans-serif">Qty</text>
    <text x="6" y="52" text-anchor="middle" fill="#374151" font-size="8" font-family="sans-serif" transform="rotate(-90 6 52)">Price</text>
  </svg>`,

  demand: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <line x1="10" y1="90" x2="90" y2="90" stroke="#374151" stroke-width="2"/>
    <line x1="10" y1="90" x2="10" y2="10" stroke="#374151" stroke-width="2"/>
    <polyline points="12,18 32,32 52,52 72,72 88,82" fill="none" stroke="#EF4444" stroke-width="2.5" stroke-linecap="round"/>
    <text x="82" y="88" text-anchor="middle" fill="#EF4444" font-size="9" font-family="sans-serif">D</text>
    <text x="52" y="100" text-anchor="middle" fill="#374151" font-size="8" font-family="sans-serif">Qty</text>
    <text x="6" y="52" text-anchor="middle" fill="#374151" font-size="8" font-family="sans-serif" transform="rotate(-90 6 52)">Price</text>
  </svg>`,

  // ── General / Education ──
  book: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <path d="M8 16 Q50 8 50 50 Q50 8 92 16 L92 84 Q50 76 50 84 Q50 76 8 84 Z" fill="#DBEAFE" stroke="#3B82F6" stroke-width="1.5"/>
    <line x1="50" y1="50" x2="50" y2="84" stroke="#3B82F6" stroke-width="1.5"/>
    <line x1="50" y1="8" x2="50" y2="50" stroke="#3B82F6" stroke-width="1"/>
    <line x1="20" y1="32" x2="48" y2="28" stroke="#93C5FD" stroke-width="1.5"/>
    <line x1="20" y1="44" x2="48" y2="40" stroke="#93C5FD" stroke-width="1.5"/>
    <line x1="20" y1="56" x2="48" y2="52" stroke="#93C5FD" stroke-width="1.5"/>
    <line x1="52" y1="28" x2="80" y2="32" stroke="#93C5FD" stroke-width="1.5"/>
    <line x1="52" y1="40" x2="80" y2="44" stroke="#93C5FD" stroke-width="1.5"/>
    <line x1="52" y1="52" x2="80" y2="56" stroke="#93C5FD" stroke-width="1.5"/>
  </svg>`,

  person: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <circle cx="50" cy="28" r="20" fill="#93C5FD" stroke="#3B82F6" stroke-width="2"/>
    <path d="M14 92 Q14 62 50 62 Q86 62 86 92" fill="#93C5FD" stroke="#3B82F6" stroke-width="2"/>
  </svg>`,

  people: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <circle cx="32" cy="28" r="14" fill="#93C5FD" stroke="#3B82F6" stroke-width="1.5"/>
    <path d="M6 72 Q6 52 32 52 Q58 52 58 72" fill="#93C5FD" stroke="#3B82F6" stroke-width="1.5"/>
    <circle cx="68" cy="28" r="14" fill="#A5B4FC" stroke="#6366F1" stroke-width="1.5"/>
    <path d="M44 72 Q44 52 68 52 Q92 52 92 72" fill="#A5B4FC" stroke="#6366F1" stroke-width="1.5"/>
  </svg>`,

  arrow: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <line x1="10" y1="50" x2="70" y2="50" stroke="#6366F1" stroke-width="4" stroke-linecap="round"/>
    <polygon points="68,38 90,50 68,62" fill="#6366F1"/>
  </svg>`,

  // ── General ──
  lightbulb: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <circle cx="50" cy="38" r="26" fill="#FEF3C7" stroke="#F59E0B" stroke-width="2"/>
    <rect x="38" y="62" width="24" height="10" rx="3" fill="#D97706"/>
    <rect x="40" y="74" width="20" height="8" rx="3" fill="#D97706"/>
    <line x1="50" y1="12" x2="50" y2="4" stroke="#F59E0B" stroke-width="2.5" stroke-linecap="round"/>
    <line x1="74" y1="38" x2="82" y2="38" stroke="#F59E0B" stroke-width="2.5" stroke-linecap="round"/>
    <line x1="26" y1="38" x2="18" y2="38" stroke="#F59E0B" stroke-width="2.5" stroke-linecap="round"/>
    <line x1="67" y1="21" x2="73" y2="15" stroke="#F59E0B" stroke-width="2" stroke-linecap="round"/>
    <line x1="33" y1="21" x2="27" y2="15" stroke="#F59E0B" stroke-width="2" stroke-linecap="round"/>
  </svg>`,
};

// ── Iconify Map ───────────────────────────────────────────────────────────────
// Maps semantic concept names to Iconify icon IDs (prefix:name).

const ICONIFY_MAP: Record<string, string> = {
  // Software / Tech concepts
  postgresql: "logos:postgresql",
  postgres: "logos:postgresql",
  mysql: "logos:mysql",
  mongodb: "logos:mongodb-icon",
  redis: "logos:redis",
  python: "logos:python",
  javascript: "logos:javascript",
  typescript: "logos:typescript-icon",
  react: "logos:react",
  nodejs: "logos:nodejs-icon",
  node: "logos:nodejs-icon",
  docker: "logos:docker-icon",
  kubernetes: "logos:kubernetes",
  k8s: "logos:kubernetes",
  aws: "logos:aws",
  github: "logos:github-icon",
  git: "logos:git-icon",
  nginx: "logos:nginx",
  linux: "logos:linux-tux",
  graphql: "logos:graphql",
  elasticsearch: "logos:elasticsearch",
  terraform: "logos:terraform-icon",
  // Generic software concepts via mdi
  api: "mdi:api",
  http: "mdi:web-check",
  json: "mdi:code-json",
  terminal: "mdi:console",
  code: "mdi:code-braces",
  key: "mdi:key-variant",
  lock: "mdi:lock-outline",
  shield: "mdi:shield-check-outline",
  email: "mdi:email-outline",
  file: "mdi:file-outline",
  folder: "mdi:folder-outline",
  settings: "mdi:cog-outline",
  // CS / programming concepts
  function: "mdi:function-variant",
  variable: "mdi:variable",
  loop: "mdi:repeat",
  class: "mdi:cube-outline",
  object: "mdi:shape-outline",
  pointer: "mdi:cursor-pointer",
  memory: "mdi:memory",
  cpu: "mdi:cpu-64-bit",
  binary: "mdi:binary",
  recursion: "mdi:refresh",
  sorting: "mdi:sort",
  linked_list: "mdi:link-variant",
  hash_table: "mdi:pound-box-outline",
  // Astronomy extras
  telescope: "mdi:telescope",
  rocket: "mdi:rocket-launch-outline",
  orbit: "mdi:orbit-variant",
  // Science extras
  flask: "mdi:flask-outline",
  microscope: "mdi:microscope",
  thermometer: "mdi:thermometer",
  magnet: "mdi:magnet-on",
  // History / Industry
  castle: "mdi:castle",
  crown: "mdi:crown-outline",
  sword: "mdi:sword",
  flag: "mdi:flag-outline",
  map: "mdi:map-outline",
  timeline: "mdi:timeline-outline",
  historical_event: "mdi:history",
  revolution: "mdi:rotate-360",
  empire: "mdi:crown",
  war: "mdi:sword-cross",
  // Economics
  profit: "mdi:trending-up",
  loss: "mdi:trending-down",
  inflation: "mdi:trending-up",
  trade: "mdi:swap-horizontal",
  bank: "mdi:bank-outline",
  economy: "mdi:chart-areaspline",
  gdp: "mdi:poll",
  tax: "mdi:receipt",
  price: "mdi:tag-outline",
  budget: "mdi:calculator-variant-outline",
  // General
  checkmark: "mdi:check-circle-outline",
  warning: "mdi:alert-circle-outline",
  error: "mdi:close-circle-outline",
  clock: "mdi:clock-outline",
  chart: "mdi:chart-line",
  idea: "mdi:lightbulb-outline",
  search: "mdi:magnify",
  link: "mdi:link-variant",
  download: "mdi:download-outline",
  upload: "mdi:upload-outline",
  world: "mdi:earth",
  location: "mdi:map-marker-outline",
  music: "mdi:music-note",
  art: "mdi:palette-outline",
  sport: "mdi:trophy-outline",
};

// ── Emoji Fallback Map ────────────────────────────────────────────────────────

const EMOJI_FALLBACK: Record<string, string> = {
  // Astronomy
  sun: "☀️",
  earth: "🌍",
  moon: "🌕",
  mercury: "🪨",
  venus: "🌟",
  mars: "🔴",
  planet: "🪐",
  star: "⭐",
  satellite: "🛰️",
  rocket: "🚀",
  telescope: "🔭",
  // Science
  plant: "🌿",
  cell: "🦠",
  dna: "🧬",
  molecule: "🔬",
  atom: "⚛️",
  mitochondria: "🔋",
  chloroplast: "🌱",
  water: "💧",
  ocean: "🌊",
  rain: "🌧️",
  precipitation: "🌧️",
  vapor: "💨",
  water_vapor: "💨",
  evaporation: "♨️",
  condensation: "💧",
  mountain: "⛰️",
  flask: "⚗️",
  microscope: "🔬",
  thermometer: "🌡️",
  leaf: "🍃",
  // Software / Tech
  user: "👤",
  browser: "🌐",
  frontend: "💻",
  server: "🖥️",
  api_server: "🔌",
  database: "🗄️",
  cloud: "☁️",
  jwt: "🔑",
  cache: "⚡",
  queue: "📬",
  postgresql: "🐘",
  python: "🐍",
  javascript: "🟨",
  docker: "🐳",
  kubernetes: "☸️",
  aws: "☁️",
  github: "🐙",
  redis: "🔴",
  mongodb: "🍃",
  // CS concepts
  algorithm: "🔄",
  data_structure: "🌲",
  tree: "🌲",
  stack: "📚",
  array: "🗃️",
  network: "🕸️",
  code: "💻",
  function: "λ",
  loop: "🔁",
  recursion: "🔄",
  sorting: "🗂️",
  linked_list: "🔗",
  // Industry / History
  factory: "🏭",
  train: "🚂",
  ship: "🚢",
  steam_engine: "🚂",
  gear: "⚙️",
  tool: "🔧",
  hand_tools: "🔧",
  energy: "⚡",
  electricity: "⚡",
  lightning: "⚡",
  castle: "🏰",
  crown: "👑",
  sword: "⚔️",
  flag: "🚩",
  map: "🗺️",
  revolution: "🔄",
  empire: "👑",
  war: "⚔️",
  // Economics
  coin: "🪙",
  money: "💰",
  market: "🏪",
  supply: "📈",
  demand: "📉",
  profit: "📈",
  loss: "📉",
  bank: "🏦",
  trade: "🔄",
  inflation: "📈",
  gdp: "📊",
  tax: "🧾",
  price: "🏷️",
  economy: "📊",
  budget: "🧮",
  // General / Math
  venn_diagram: "⭕",
  number_line: "📏",
  map_region: "🗺️",
  triangle: "📐",
  graph: "📈",
  lightbulb: "💡",
  book: "📖",
  person: "👤",
  people: "👥",
  arrow: "➡️",
  idea: "💡",
  clock: "🕐",
  chart: "📊",
  checkmark: "✅",
  warning: "⚠️",
  error: "❌",
  search: "🔍",
  link: "🔗",
  world: "🌍",
  location: "📍",
  music: "🎵",
  art: "🎨",
};

// ── SVG cache for fetched Iconify assets ──────────────────────────────────────

const svgCache = new Map<string, string>();

// ── Resolution ────────────────────────────────────────────────────────────────

export type ResolvedAsset =
  | { type: "local-svg"; value: string } // inline SVG string
  | { type: "iconify-svg"; value: string } // inline SVG string fetched from Iconify
  | { type: "emoji"; value: string } // emoji character
  | { type: "none" };

/**
 * Resolve a semantic concept name to the best available visual asset.
 * Falls through local catalog → Iconify API → emoji → none.
 */
export async function resolveAsset(semantic: string): Promise<ResolvedAsset> {
  const key = semantic.toLowerCase().replace(/[\s-]/g, "_");

  // 1. Local SVG catalog
  if (LOCAL_SVG[key]) {
    return { type: "local-svg", value: sanitizeSvg(LOCAL_SVG[key]) };
  }

  // 2. Iconify — check map
  const iconifyId = ICONIFY_MAP[key];
  if (iconifyId) {
    const cached = svgCache.get(iconifyId);
    if (cached) return { type: "iconify-svg", value: cached };

    try {
      const [prefix, name] = iconifyId.split(":");
      const url = `https://api.iconify.design/${prefix}/${name}.svg?width=96&height=96`;
      const res = await fetch(url, { signal: AbortSignal.timeout(4000) });
      if (res.ok) {
        const svg = sanitizeSvg(await res.text());
        svgCache.set(iconifyId, svg);
        return { type: "iconify-svg", value: svg };
      }
    } catch {
      // network failure — fall through
    }
  }

  // 3. Emoji fallback
  const emoji = EMOJI_FALLBACK[key];
  if (emoji) return { type: "emoji", value: emoji };

  return { type: "none" };
}

/**
 * Synchronous check — returns true if a local SVG is available for this semantic.
 * Useful to decide whether to show a placeholder immediately while async resolution runs.
 */
export function hasLocalAsset(semantic: string): boolean {
  const key = semantic.toLowerCase().replace(/[\s-]/g, "_");
  return key in LOCAL_SVG;
}

/** Inject a generated SVG into the runtime cache so future lookups reuse it. */
export function cacheGeneratedSvg(semantic: string, svg: string): void {
  const key = semantic.toLowerCase().replace(/[\s-]/g, "_");
  LOCAL_SVG[key] = sanitizeSvg(svg);
}
