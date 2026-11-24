# KDC Carnival app

Our own version of the KDC carnival site, for **Roanoke only**, in the Jungle of Sheru green theme. It has everything the old site had (scanning, tickets, prizes, boards, stats, import), plus:

- **Access codes instead of emails/passwords.** Volunteers type their name and a code, and the code decides what they can do.
- **Separate I-Side and E-Side prizes:** two prize pages and two Prize Boards. Kids only see their own side's prizes at the prize booth.
- **Pin to top** for prizes (raffles stay first on the Prize Board), and **No stock limit** so raffles show "Raffle" instead of 9999.
- **Board Backgrounds:** upload your own picture for the Leadership Board and each Prize Board.
- **Phones are the badge readers (iPhone and Android):** each badge holds a link to this site with its badge ID (set up once on **Program Badges**). On an iPhone, hold the badge near the top of the phone and tap the link that pops up. On Android, tap **Use this phone to read badges** once and badges open with no pop-up. A tap opens that kid's ticket page. The Ticketing Desk works like before: type the badge #, pick the group, press Added.
- **Check-In built in, live from the Google Sheet.** The Check-In Desk, Ticketing Desk and Candy Jar from the old kdc-checkin page are inside the app and read the same live sheet (synced every 3 seconds). When the Ticketing Desk presses **Added**, the kid's badge is registered in the carnival right away.

While `js/config.js` has no Firebase settings, the app runs in **demo mode** (data saved only in that browser). Demo codes: `DEMO-ADMIN`, `DEMO-GAMES`, `DEMO-PRIZES`, `DEMO-CHECKIN`. In demo mode, check-in uses a practice sheet until you enter the real sheet PIN.

---

## Go live (about 20 minutes)

### 1. Create the Firebase project (free)
1. Go to https://console.firebase.google.com and click **Create a project**, named e.g. `kdc-carnival`. You can turn Google Analytics off.
2. In the project, click the **</>** (Web) icon to add a web app. Name it `kdc`. Skip Firebase Hosting.
3. Firebase shows a `firebaseConfig = { ... }` block. Copy it.
4. Open `js/config.js` and replace `export const FIREBASE_CONFIG = null;` with
   `export const FIREBASE_CONFIG = { ...paste here... };`

### 2. Turn on sign-in and the database
1. **Build → Authentication → Get started → Sign-in method → Anonymous → Enable → Save.**
2. **Authentication → Settings → Authorized domains → Add domain**, then add the site address from step 4 (for GitHub Pages: `dpatel12270-hub.github.io`).
3. **Build → Firestore Database → Create database**. Pick a US location and choose **production mode**.
4. In Firestore, open the **Rules** tab, delete everything, paste all of `firestore.rules`, and click **Publish**.

### 3. Create your lead code (one time, in the Firestore Data tab)
**Start collection** `accessCodes` with document ID set to a secret code you make up, at least 8 characters, e.g. `ROK-LEAD-7Q4M2X`. Add these fields:
- `code` (string): the same code, e.g. `ROK-LEAD-7Q4M2X`
- `center` (string): `ROK`
- `label` (string): `Lead`
- `active` (boolean): `true`
- `roles` (array) with these 7 strings: `MANDIR_ADMIN_USER`, `APP_USER`, `GAME_ADMIN_USER`, `GIFT_ADMIN_USER`, `PRIZE_ADMIN_USER`, `LEADERS_BOARD_USER`, `CHECKIN_USER`

Keep this code to yourself. You make every other code inside the app.

### 4. Put the site online (GitHub Pages, same as kdc-checkin)
1. On GitHub, create a new **public** repo, e.g. `kdc-carnival`.
2. **Add file → Upload files**, then drag in everything in this folder (`index.html`, `css`, `js`, and the rest). Commit.
3. **Settings → Pages → Branch: main / root → Save.** After a minute the site is at `https://dpatel12270-hub.github.io/kdc-carnival/`.

### 5. Set it up in the app
1. Log in with your name and your lead code.
2. **Configure Games → Load the KDC 2026 games → Save.**
3. **I-Side Prizes → Load the KDC 2026 prizes**, edit the list → **Save I-Side prizes.**
4. **E-Side Prizes**: load the starter list or **Copy from I-Side**, change what's different → **Save E-Side prizes.**
5. **Board Backgrounds:** upload pictures for the Leadership Board and both Prize Boards (optional).
6. **Check-In** → enter the check-in sheet PIN (the same PIN as the old check-in page) → **Test & save.** The page shows **● Live: Google Sheet** when it's connected.
7. **Access Codes:** create codes for each group (Game volunteer, Prize booth, Check-in desk, TV boards) and share them.

### 6. Test before Nov 28
On 2–3 real phones: check a kid in, add them at the Ticketing Desk with a badge, scan that badge at a game, give tickets, redeem a prize, and watch the Prize Board and Leadership Board update on a laptop.

---

## Roles
| Role | Can do |
|---|---|
| App User | Scan badges, add or deduct game tickets |
| Prize Admin | Redeem and return prizes (from the kid's own side's list) |
| Gift Admin | Mark goody bags |
| Check-In | Check-In Desk, Ticketing Desk, Candy Jar |
| Game Admin | Configure games, I-Side and E-Side prizes, board backgrounds |
| Leaders Board | Show the Leadership Board and both Prize Boards |
| Admin | Everything: Live Stats, Game Metrics, Import, Access Codes, check-in sheet |

## TV links
- Leadership Board: `#/kdc-leadership-board`
- I-Side Prize Board: `#/prize-board-i-side`
- E-Side Prize Board: `#/prize-board-e-side`

## Notes
- A badge can be typed, read by a USB/RFID reader (it types the number and presses Enter), or scanned as a QR code with the camera.
- **Badges must be NFC badges** (13.56 MHz, e.g. NTAG213/215 stickers or cards). Phones can't read 125 kHz RFID cards.
- **Program every badge first** (menu → Program Badges): on an Android phone in Chrome, tap each badge to write its link; or on iPhone use the free NFC Tools app and write the URL `https://<your site>/?b=K001`, `?b=K002`, …
- iPhone volunteers keep the site open in **Safari** (not a Home Screen shortcut). Each tap opens a new Safari tab on the right kid; old tabs can be closed anytime.
- The link must point to the new site. If badges were programmed for the old site, re-program them.
- Phone badge reading needs the https site (GitHub Pages is). Android Chrome asks for NFC permission the first time; tap Allow.
- A USB reader that types the number and presses Enter also works on laptops.
- QR codes from the old system (`{"center":"ROK","year","uuid"}`) still work.
- Turning a code **Off** blocks it right away, even for people already logged in with it.
- Free Firebase limits (50,000 reads a day) are plenty for one carnival day. The boards update live without polling.
