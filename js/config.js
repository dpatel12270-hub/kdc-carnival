// ============================================================
//  KDC Carnival – app settings
// ============================================================
// 1. Create a Firebase project (see README.md).
// 2. Paste the web app config from Firebase here.
// 3. While this stays null the app runs in DEMO MODE: everything
//    is saved only in this browser, so you can click around safely.
// ============================================================

export const FIREBASE_CONFIG = {
  apiKey: "AIzaSyDSN66yMOstmEE0ppQW2-WbDvg5MU0bdlA",
  authDomain: "kdc-app-2873c.firebaseapp.com",
  projectId: "kdc-app-2873c",
  storageBucket: "kdc-app-2873c.firebasestorage.app",
  messagingSenderId: "898671599076",
  appId: "1:898671599076:web:e0f065dcca901acbdcfbf1"
};

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
