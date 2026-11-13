# StockLens setup (free)

## 1. Files to upload to GitHub (repository root)
index.html, manifest.json, sw.js, icon-192.png, icon-512.png, README.md and the folder `api` containing
`stock.js`, `auth.js`, `_auth.js`. (Vercel redeploys automatically after each commit.)

## 2. Make it private (required)
In Vercel: your project, Settings, Environment Variables. Add:
- `OWNER_CODE`   your own private passcode (long and hard to guess, e.g. 16+ characters). Gives full access.
- `ACCESS_SECRET` any long random text. Used to sign friend invites.
- `REVOKED`      (optional) comma-separated friend names to block immediately, e.g. `Ravi,Sam`.
Then Deployments, the latest one, Redeploy. Until OWNER_CODE exists the app stays locked on purpose.

## 3. Inviting a friend
Open the app, unlock with your OWNER_CODE, go to the Access tab, type the friend's name, choose how long the
invite lasts and press Create invite link. Send the link (WhatsApp button included). It stops working on its
expiry date. To remove someone early: add their name to REVOKED and Redeploy.

## 4. Install on your phone
Open your link in Chrome (Android) and tap "Install app", or in Safari (iPhone) tap Share, then Add to Home Screen.

## Notes
- Paper-trading data is stored in each person's own browser.
- Groww: the "Open in Groww" button only copies your order details and opens Groww. You place orders yourself.
