// shared/constants/grafts.ts
/**
 * SINGLE SOURCE OF TRUTH FOR GRAFT ASP PRICING
 * 
 * Quarterly Update Workflow:
 * 1. Copy current GRAFT_OPTIONS into GRAFT_HISTORY (optional, for audit trail)
 * 2. Update GRAFT_OPTIONS array with new quarter's data:
 *    - Update ASP values per CMS pricing
 *    - Update quarter to "Q1", "Q2", "Q3", or "Q4"
 *    - Update year (e.g., 2025)
 *    - Set isActive: false for discontinued grafts (or remove entirely)
 * 3. Save and test - all three pages will automatically use new data
 */

export type Quarter = 'Q1' | 'Q2' | 'Q3' | 'Q4';

export interface GraftOption {
  manufacturer: string;
  name: string;
  /** CMS Q-code as displayed to users; keep the -Q# suffix for clarity */
  qCode: string;
  /** Billable rate per cm² for the given quarter */
  asp: number;
  year: number;
  quarter: Quarter;
  /** Hide from selectors if discontinued this quarter */
  isActive: boolean;
}

/**
 * CURRENT QUARTER: Q4 2025
 * Update this array each quarter when CMS releases new ASP pricing
 */
export const GRAFT_OPTIONS: GraftOption[] = [
  { manufacturer: "Biolab",     name: "Membrane Wrap",        asp: 1237.28, qCode: "Q4205-Q4", year: 2025, quarter: "Q4", isActive: true },
  { manufacturer: "Biolab",     name: "Membrane Hydro",       asp: 1867.01, qCode: "Q4290-Q4", year: 2025, quarter: "Q4", isActive: true },
  { manufacturer: "Biolab",     name: "Membrane Tri Layer",   asp: 3574.39, qCode: "Q4344-Q4", year: 2025, quarter: "Q4", isActive: true },
  { manufacturer: "Dermabind",  name: "Dermabind Q2",         asp: 3337.23, qCode: "Q4313-Q2", year: 2025, quarter: "Q4", isActive: false },
  { manufacturer: "Dermabind",  name: "Dermabind",            asp: 3312.52, qCode: "Q4313-Q4", year: 2025, quarter: "Q4", isActive: true },
  { manufacturer: "Revogen",    name: "Revoshield",           asp: 1523.05, qCode: "Q4289-Q4", year: 2025, quarter: "Q4", isActive: true },
  { manufacturer: "Revogen",    name: "Vitograft",            asp: 4770.00, qCode: "Q4317-Q4", year: 2025, quarter: "Q4", isActive: true },
  { manufacturer: "Evolution",  name: "Esano",                asp: 2707.30, qCode: "Q4275-Q4", year: 2025, quarter: "Q4", isActive: true },
  { manufacturer: "Evolution",  name: "Simplimax",            asp: 3524.11, qCode: "Q4341-Q4", year: 2025, quarter: "Q4", isActive: true },
  { manufacturer: "AmchoPlast", name: "AmchoPlast",           asp: 4227.97, qCode: "Q4316-Q4", year: 2025, quarter: "Q4", isActive: true },
  { manufacturer: "Encoll",     name: "Helicoll",             asp: 1640.93, qCode: "Q4164-Q4", year: 2025, quarter: "Q4", isActive: true },
  { manufacturer: "Arsenal",    name: "Aminoamp",             asp: 2979.56, qCode: "Q4250-Q4", year: 2025, quarter: "Q4", isActive: true },
  { manufacturer: "Generic",    name: "2026 Rate Drop",       asp: 800.00,  qCode: "Q4000-Q4", year: 2025, quarter: "Q4", isActive: true },
];

/**
 * Archive of previous quarters for audit trail
 */
export const GRAFT_HISTORY: GraftOption[][] = [
  // Q3 2025 data (archived September 30, 2025)
  [
    { manufacturer: "Biolab",     name: "Membrane Wrap",        asp: 1190.44, qCode: "Q4205-Q3", year: 2025, quarter: "Q3", isActive: true },
    { manufacturer: "Biolab",     name: "Membrane Hydro",       asp: 1864.71, qCode: "Q4290-Q3", year: 2025, quarter: "Q3", isActive: true },
    { manufacturer: "Biolab",     name: "Membrane Tri Layer",   asp: 2689.48, qCode: "Q4344-Q3", year: 2025, quarter: "Q3", isActive: true },
    { manufacturer: "Dermabind",  name: "Dermabind Q2",         asp: 3337.23, qCode: "Q4313-Q2", year: 2025, quarter: "Q3", isActive: true },
    { manufacturer: "Dermabind",  name: "Dermabind Q3",         asp: 3520.69, qCode: "Q4313-Q3", year: 2025, quarter: "Q3", isActive: true },
    { manufacturer: "Revogen",    name: "Revoshield",           asp: 1468.11, qCode: "Q4289-Q3", year: 2025, quarter: "Q3", isActive: true },
    { manufacturer: "Evolution",  name: "Esano",                asp: 2675.48, qCode: "Q4275-Q3", year: 2025, quarter: "Q3", isActive: true },
    { manufacturer: "Evolution",  name: "Simplimax",            asp: 3071.28, qCode: "Q4341-Q3", year: 2025, quarter: "Q3", isActive: true },
    { manufacturer: "AmchoPlast", name: "AmchoPlast",           asp: 4415.97, qCode: "Q4316-Q3", year: 2025, quarter: "Q3", isActive: true },
    { manufacturer: "Encoll",     name: "Helicoll",             asp: 1640.93, qCode: "Q4164-Q3", year: 2025, quarter: "Q3", isActive: true },
  ]
];

/** Get only active grafts (filters out discontinued products) */
export const getActiveGrafts = (): GraftOption[] => 
  GRAFT_OPTIONS.filter(g => g.isActive);

/** 
 * Convert to simplified format for UI compatibility
 * Returns only the fields needed by existing components
 */
export const toSimpleOptions = () =>
  getActiveGrafts().map(g => ({
    manufacturer: g.manufacturer,
    name: g.name,
    qCode: g.qCode,
    asp: g.asp,
  }));

/** Validation check: ensure no duplicate entries and all ASPs are positive */
export const validateGraftData = (): { valid: boolean; errors: string[] } => {
  const errors: string[] = [];
  const seen = new Set<string>();
  
  for (const graft of GRAFT_OPTIONS) {
    // Check for duplicates
    const key = `${graft.manufacturer}|${graft.name}|${graft.qCode}`;
    if (seen.has(key)) {
      errors.push(`Duplicate graft: ${graft.manufacturer} ${graft.name} (${graft.qCode})`);
    }
    seen.add(key);
    
    // Check ASP is positive
    if (graft.asp <= 0) {
      errors.push(`Invalid ASP for ${graft.manufacturer} ${graft.name}: ${graft.asp}`);
    }
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
};
