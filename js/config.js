// ============================================================
//  KDC Carnival – app settings
// ============================================================
// 1. Create a Firebase project (see README.md).
// 2. Paste the web app config from Firebase here.
// 3. While this stays null the app runs in DEMO MODE: everything
//    is saved only in this browser, so you can click around safely.
// ============================================================

export const FIREBASE_CONFIG = null;
/* Example:
export const FIREBASE_CONFIG = {
  apiKey: "AIza...",
  authDomain: "kdc-carnival.firebaseapp.com",
  projectId: "kdc-carnival",
  storageBucket: "kdc-carnival.appspot.com",
  messagingSenderId: "1234567890",
  appId: "1:1234567890:web:abc123"
};
*/

// This app is only for the Roanoke center.
export const CENTER = 'ROK';
export const CENTER_NAME = 'Roanoke';
export const EVENT_NAME = 'Jungle of Sheru';

// Prize lists and prize boards are separate for each side.
export const SIDES = ['I-Side', 'E-Side'];

// Event year used for participant records and reports.
export const EVENT_YEAR = new Date().getFullYear();

// Prize Board / Leadership Board refresh (they also update live).
export const BOARD_REFRESH_MS = 60000;
