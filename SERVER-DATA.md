# Server User Data

`user-data-server.json` acts as a shared baseline for all devices. On every app load, devices fetch this file and use it to fill in any songs, collections, or recently-played entries that aren't already in their local browser storage. **Local data always wins** — the server only fills gaps.

## How to update from your phone

1. On your phone, open the app → settings menu → **Export Data**
2. You'll get a file like `abc-player-backup-2026-03-02.json`
3. Copy/move it to this folder and rename it to `user-data-server.json` (overwrite the old one)
4. Commit and push:
   ```
   git add Recorder/user-data-server.json
   git commit -m "Update server user data"
   git push
   ```
5. All devices will pick up the new baseline on their next page load

## Merge behaviour

| Situation | Result |
|-----------|--------|
| Song exists only on server | Added to local storage |
| Song exists only locally | Kept as-is |
| Song exists in both | **Local version wins** |
| Collections | Same as songs |
| Recently played | Both lists merged; local order preserved at top |

## Gotcha: stale local data wins

If a device has an old entry for a song (e.g. "needs-practice") and your phone has it as "mastered" in the server file, the device keeps its old version. To force a device to adopt the server data:

1. Open the app on that device
2. Settings → **Import Data** → select `user-data-server.json` → choose **Replace** (not Merge)

## File location

```
Recorder/
  user-data-server.json   ← edit this file to update all devices
  SERVER-DATA.md          ← this file
```
