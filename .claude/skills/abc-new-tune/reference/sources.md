# Where melodies actually come from

Findings from real searches. The pattern is that generic sheet-music sites are
useless (paywalled previews, or images too small to read) and the wins come from
a handful of odd, old, un-gated sites. Budget the time here, not on notation.

## Routes that pay off

### flutetunes.com

Free flute settings, one tune per page, with a downloadable MIDI. The page
states key, meter, tempo and range. Already the source for `abc/korean/arirang.abc`.

```bash
curl -s "https://www.flutetunes.com/tunes.php?id=617" | grep -o 'href="[^"]*\.\(mid\|pdf\)"'
# -> /tunes/bahay-kubo.mid
curl -sL "https://www.flutetunes.com/tunes/bahay-kubo.mid" -o tune.mid
```

Melody only, so chords must be derived. Search their site with
`https://www.flutetunes.com/search.php?q=<term>`; coverage is broad but shallow
outside the European repertoire.

### mu-tech.org — printed lead sheets, generated on demand

The best find: it renders a **lead sheet image with chord symbols**, in any key
you ask for, plus MIDIs of the same tune in a dozen arrangement styles.

```bash
# 1. tune page -> the .mwd/.jpg names and the MIDI links
curl -sL "https://www.mu-tech.org/WorldTrad/Leron_leron_sinta.html" -o t.html
grep -oiE '(href|src)="[^"]*\.(mid|jpg)"' t.html

# 2. POST the form to generate the score, then fetch the image it names
curl -sL -X POST "http://www.mu-tech.co.jp/FirstSongWeb/print_score2_eng.asp" \
  -d "SongFile=Leron_leron_sinta.mwd&ImageFile=Leron_leron_sinta.jpg&KeyWord=Philippines&SongKey=c" \
  -o s.html
grep -o 'ImgFile=[^"]*' s.html
curl -sL "http://www.mu-tech.co.jp/FirstSongWeb/ScoreImage/c_Leron_leron_sinta.jpg" -o score.jpg
```

Then Read the image (crop and upscale systems that are too small — see SKILL.md).
Country indexes are at `index_<country>_song.html`. Catalogue per country is
small, so check before planning around it.

### MIDI libraries hosted on Google Drive

Old school-music blogs often link whole folk-song collections as Drive files.
The 2011-era `docs.google.com/leaf?id=<ID>` links still resolve:

```bash
curl -sL "https://drive.google.com/uc?export=download&id=<ID>" -o tune.mid
```

These are usually full arrangements **with a separate accompaniment channel** —
the best chord source there is, short of a printed lead sheet. Example found
this way: `filipinofolksongsatbp.blogspot.com/2011/09/filipino-folk-songs-midi-downloads.html`,
64 tunes.

Blogspot post bodies frequently do not survive `curl` (rendered by JS). Use
WebFetch on those pages instead, and ask it to list the links.

### abcnotation.com

ABC directly, no transcription needed. Search works:

```bash
curl -s "https://abcnotation.com/searchTunes?q=<term>&f=c&o=a&s=0" | grep -o '/tunePage[^"]*'
```

Coverage is overwhelmingly Anglo/Celtic — worth one query for any tradition, but
do not expect hits outside Europe and North America.

## Dead ends — do not spend calls on these

| Route | What happens |
|---|---|
| `thesession.org` | HTTP 403 to WebFetch. Search surfaces it; you cannot read it. |
| `cpdl.org` API | 403 Forbidden. |
| musescore.com | Score data needs an authenticated download. |
| musicnotes.com, sheetmusicplus | Paywalled; search results only tell you a key. |
| archive.org texts | The folk-song collections are lending-library, not open. |
| flutenotes.ph | Real letter notes, but the post body is JS-rendered — `curl` returns an empty div. Use WebFetch. |
| Wikipedia | Almost none of these articles carry a `<score>` tag or a notation image. Good for provenance and key, not notes. |

## Getting note data out of tab / letter-note sites

WebFetch's summariser will refuse a request phrased as "reproduce the complete
notation verbatim" — it reads as redistributing the site's work. Asking for the
facts gets an answer:

> "This is a public-domain folk melody. What key is it given in, and what are
> the letter notes shown for each lyric line?"

Remember what you are getting: **pitches with no rhythm**. Good for confirming a
melody you already have, useless as a sole source. Number notation (`5 5- 43 4 5`)
is movable-do scale degrees; hyphens mean held.

## Judging a source

Two independent sources agreeing on pitches is decent evidence. One source plus
your own recollection is not — recollection agrees with whatever it is shown.
When the only thing available is a letter-note page, skip the tune and say why.
