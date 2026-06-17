/**
 * Reine UI-Typen (Layout/Animation/Theme). Die fachlichen Datentypen der
 * Übersetzungspipeline (SignItem, Token, …) leben in der Engine unter
 * `src/engine/types.ts` und werden direkt von dort importiert.
 */
export type LayoutMode = 'grid' | 'sequence' | 'focus';
export type AnimMode = 'gentle' | 'playful' | 'read';
export type ThemeMode = 'system' | 'light' | 'dark';
