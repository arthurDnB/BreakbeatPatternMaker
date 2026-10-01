import type {Genre} from './model.js';
import type {V5Profile} from './groove-v5-contract.js';

/** DeepSeek's eight reviewed pilot profiles are added here after the core contract lands. */
export const V5_PROFILE_OVERRIDES:Partial<Record<Genre,V5Profile>>={};
