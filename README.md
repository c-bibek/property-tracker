# Property Tracker

A simple real estate portfolio tracker. Add properties you own and track their
value, equity, mortgage balance, cash flow, cap rate, and cash-on-cash return
in one dashboard.

## Features

- Add / edit / delete properties (address, type, status, purchase info,
  mortgage, rent, expenses, notes)
- Auto-calculated equity, monthly/annual cash flow, cap rate, and
  cash-on-cash return
- Portfolio summary cards and charts (value & equity by property, mix by
  property type)
- Search, filter by type, and sort
- Light/dark theme
- Export/import your data as JSON (for backup, since data is stored only in
  your browser)

## Running it

This is a static site with no build step and no server. All data is stored
locally in your browser (`localStorage`) — nothing is sent anywhere.

Just open [index.html](index.html) in your browser, or serve the folder
locally, e.g.:

```bash
python3 -m http.server 8000
```

then visit `http://localhost:8000`.

## Data privacy

Your property data never leaves your browser. Use the **Export** button
regularly to back up your data as a JSON file, and **Import** to restore it
or move it to another browser/device.
