# PDMX Triage Station

A local tool for sifting the [PDMX](https://zenodo.org/records/15571083) public-domain
MusicXML dataset and promoting selected songs into the Recorder app — without swamping
the app with 250k scores. The bulk dataset stays in `pdmx/` (gitignored); only songs you
**Promote** become committed `.abc` files in `abc/`.

## One-time setup

1. **Download the dataset** into `pdmx/` (≈2.3 GB — we skip the 9.6 GB of PDFs):
   `mxl.tar.gz`, `PDMX.csv`, `metadata.tar.gz`, `subset_paths.tar.gz` from the
   [Zenodo record](https://zenodo.org/records/15571083).
2. **Install Flask** (once): `py -m pip install flask`
3. *(optional)* For transpose-on-promote: `py -m pip install music21`

## Workflow

```sh
# 1. Index a working subset into triage/triage.db and extract just those .mxl files.
#    Defaults to solo (n_tracks<=1) + deduplicated. Tune with flags:
py triage/index_pdmx.py --subset rated_deduplicated --min-rating 4 --limit 2000

# 2. Start the triage station, then open http://localhost:8765
py triage/server.py
```

In the browser: browse by status tab (new / kept / discarded / promoted), audition each
song (converted to ABC and played with the same abcjs engine the app uses), then:

- **Discard** — hide it, never see it again
- **Keep** — shortlist for later
- **Promote → app** — edit title / transpose / pick a category, and it writes a cleaned
  `abc/<category>/<title>.abc`

## Publishing promoted songs

Promoted files land in `abc/`. On your next `git commit`, the pre-commit hook
(`scripts/hooks/pre-commit`, enabled via `git config core.hooksPath scripts/hooks`)
automatically regenerates the file lists and bumps the PWA version — so committed songs
appear in the live app with no manual steps.

## Notes / known limits

- PDMX `n_tracks` counts *parts*, not melodic voices — many "solo" scores are piano
  arrangements that convert to multi-voice ABC. Auditioning surfaces these; Discard them.
  (A future "reduce to melody" toggle could auto-strip to the top voice.)
- Some non-Latin titles are double-encoded in the PDMX CSV itself — cosmetic only; you
  set the real title when promoting.
- Conversion uses `scripts/xml2abc.py` (Wim Vree) via `scripts/import_song.py`, which is
  also usable standalone:
  `py scripts/import_song.py song.mxl --category irish --title "The Kesh Jig"`
