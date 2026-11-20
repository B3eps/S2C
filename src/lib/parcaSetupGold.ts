import { analyzeParcaSetup, createSetupEngine } from './parcaSetup';
import type { SetupInput, SetupParams } from './parcaSetup';
import { GOLD_SETUP_DEFAULTS, PARCA_GOLD_ID, variantParams } from './parcaVariants';
import type { ParcaId } from './parcaVariants';

/** Gold preset of the same causal engine, with the supplied XAUUSD settings. */
export { GOLD_SETUP_DEFAULTS };
export const createGoldSetupEngine = (tf: SetupInput['tf'], params?: Partial<SetupParams>, id: ParcaId = PARCA_GOLD_ID) =>
  createSetupEngine(tf, variantParams(id, params ?? {}));
export const analyzeGoldSetup = (input: SetupInput) =>
  analyzeParcaSetup({ ...input, params: variantParams(PARCA_GOLD_ID, input.params ?? {}) });
