# Synced User Data

Favorites, practice status, notes, collections and recently played live in
`user-data.json` on the **`user-data` branch** of this repo
(`js/core/user-data-sync.js`). That branch is not the one GitHub Pages serves,
so syncing never redeploys the site, and the data does not depend on which
version of the app is installed.

## When it syncs

- **Pull:** on app start, when the app comes back to the foreground, and when
  the device goes back online. Works without a token (the repo is public).
- **Push:** about 30 seconds after a change, and when the app is hidden. Needs
  the GitHub token (settings ⚙). A change made offline or without a token is
  remembered and pushed on a later sync.

The device's own copy in localStorage is always used as-is when GitHub can't
be reached.

## Merge rules

| Data | Rule |
|------|------|
| Status, favorite, notes | From whichever copy changed the song last (`updatedAt`; older entries fall back to `lastPlayed`) |
| Play count, last played | The larger value |
| Collections | The copy changed last; a deleted collection stays deleted (`deletedCollections`) |
| Recently played | Both lists merged, newest first |
| Settings | Each device keeps its own |

## Editing by hand

```
git fetch origin user-data
git switch user-data      # edit user-data.json, commit, push
```

Devices pick it up on their next pull. To change a song's status by hand, also
set its `updatedAt` to the current time, or a device with a newer change wins.
