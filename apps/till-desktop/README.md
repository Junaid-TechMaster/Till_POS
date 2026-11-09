# TillPro till

Touch and keyboard sale screen for a Windows shop till. Electron hosts the React app. The window opens at 1280×800 and cannot be sized below 1024×768.

## Run

From the repository root:

```bash
npm install
npm run dev:till
```

In the browser at http://localhost:5173 the sale screen opens signed in as the shop admin. Log off to sign in again. The Electron window uses the SQLite database and asks for the shop username and password before anyone can sell.

The dashboard shop account is the admin (`demo-shop` / `DemoShop-12345`). The admin creates one cashier in Extras, Staff. That cashier can use the till and change only their own PIN.

## Keys

- Digits go to the entry row unless a dialog is open
- Enter looks up a PLU or barcode
- Esc or Delete clears the entry and removes the selected basket line
- Backspace deletes one digit
- Type a price, then tap a category and a product. The product is sold at that price
- F1 Cash, F2 Card, F3 Customer, F4 Price Check, F5 Reports, F6 Print Last
- Up and Down move the basket selection

Cash amounts: 1 or 2 digits are pounds (`10` = £10.00). Three or more digits are pence (`1050` = £10.50).

## Build

```bash
npm run build -w @tillpro/till-desktop
npm run dist:till
```

The NSIS installer is written to `apps/till-desktop/release`.
