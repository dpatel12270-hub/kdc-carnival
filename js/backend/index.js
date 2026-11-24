// Picks the backend: Firebase when configured, otherwise demo mode.
import { FIREBASE_CONFIG } from '../config.js';

const backend = FIREBASE_CONFIG
  ? await import('./firebase.js')
  : await import('./demo.js');

export default backend;
