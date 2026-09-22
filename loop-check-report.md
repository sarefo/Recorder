# Bars that are not a full measure

Regenerate with:

```bash
node .claude/skills/abc-new-tune/scripts/abc_loop_check.mjs \
    --bad --bars --skip 670_songs --report loop-check-report.md abc
```

55 tunes, from 37 files. Bar numbers count every barline in playing order, so they match what the checker prints on the terminal. Line numbers are 1-based in the file, and point at the start of the bar.

24 of them have a single bad bar, 19 have two or three, and 8 are mis-barred throughout. The first group is where the quick wins are.

A bar listed as **ok, answered** is a legitimate partial and should be left alone: either a pickup that the final bar pays back, or the short bar before a `:|` that the pickup after the repeat completes. The ones to fix are marked **too long** or **too short**.

Lengths are what abcjs makes of the notation, which is what the app plays — so a tuplet counts as abcjs reads it, not as it was perhaps meant. In a bar full of slurs the quoted notes can start or stop a little early, because abcjs anchors a slurred note to its opening bracket; the bar and line numbers are still exact.

## Pass is not a whole number of measures (32)

These do not loop: the join between the end and the beginning lands off the beat. Where a bar in the middle is over- or under-full, that bar is why, and retiming the last note would hide it rather than fix it.

### abc/bartok/romanian folk dances/2 braul.abc — tune 1/2

*2 Braul* · 4/8 per bar · 16 bars · one pass is 31.500 measures -- 2/8 too long (or 2/8 too short).

| bar | line | has | wants | | notes in the bar |
|----:|-----:|----:|------:|:--|:---|
| 6 | 11 | 3/8 | 4/8 | too short | `.e2 (5e/2d/2c/2B/2A/2` |

Look at bar **6** (line 11).

### abc/bartok/romanian folk dances/3 pe loc.abc

*Pe Loc* · 8/8 per bar · 1 bars · one pass is 0.125 measures -- 1/8 too long (or 7/8 too short).

| bar | line | has | wants | | notes in the bar |
|----:|-----:|----:|------:|:--|:---|
| 1 | 4 | 1/8 | 8/8 | too short | `TOD` |

Look at bar **1** (line 4).

### abc/classical/bach/chorales/christ lag in todesbanden.abc

*Christ lag in Todesbanden* · 8/8 per bar · 13 bars · one pass is 16.500 measures -- 4/8 too long (or 4/8 too short).

| bar | line | has | wants | | notes in the bar |
|----:|-----:|----:|------:|:--|:---|
| 1 | 10 | 2/8 | 8/8 | too short | `A` |

Look at bar **1** (line 10).

### abc/classical/bach/chorales/wachet auf.abc

*Wachet auf, ruft uns die Stimme* · 8/8 per bar · 18 bars · one pass is 24.750 measures -- 6/8 too long (or 2/8 too short).

| bar | line | has | wants | | notes in the bar |
|----:|-----:|----:|------:|:--|:---|
| 8 | 13 | 6/8 | 8/8 | ok, answered | `"Gm7" BA "C7" G2 "F" !fermata!F2` |
| 9 | 14 | 2/8 | 8/8 | ok, answered | `"C" c2` |

### abc/classical/schubert/impromptus/impromptus 1.abc — tune 1/2

*Impromptu* · 8/8 per bar · 45 bars · one pass is 43.125 measures -- 1/8 too long (or 7/8 too short).

| bar | line | has | wants | | notes in the bar |
|----:|-----:|----:|------:|:--|:---|
| 1 | 9 | 2/8 | 8/8 | too short | `(E>F` |
| 26 | 15 | 7/8 | 8/8 | too short | `B2) (.B2.B P2A>G)` |
| 33 | 16 | 6/8 | 8/8 | too short | `F6` |
| 34 | 16 | 2/8 | 8/8 | too short | `(A>G` |

Look at bars **1** (line 9), **26** (line 15), **33** (line 16), **34** (line 16).

### abc/classical/schubert/impromptus/impromptus 1.abc — tune 2/2

*Impromptu* · 8/8 per bar · 45 bars · one pass is 43.125 measures -- 1/8 too long (or 7/8 too short).

| bar | line | has | wants | | notes in the bar |
|----:|-----:|----:|------:|:--|:---|
| 1 | 30 | 2/8 | 8/8 | too short | `(B>c` |
| 26 | 36 | 7/8 | 8/8 | too short | `f2) (.f2.f P2e>d)` |
| 33 | 37 | 6/8 | 8/8 | too short | `c6` |
| 34 | 37 | 2/8 | 8/8 | too short | `(e>d` |

Look at bars **1** (line 30), **26** (line 36), **33** (line 37), **34** (line 37).

### abc/congolese/amawole.abc

*Amawole* · 8/8 per bar · 17 bars · one pass is 16.375 measures -- 3/8 too long (or 5/8 too short).

| bar | line | has | wants | | notes in the bar |
|----:|-----:|----:|------:|:--|:---|
| 1 | 9 | 3/8 | 8/8 | too short | `F2 A2 F2` |

Look at bar **1** (line 9).

### abc/film/cannibal holocaust.abc

*Cannibal Holocaust Main Theme* · 8/8 per bar · 1 bars · one pass is 0.125 measures -- 1/8 too long (or 7/8 too short).

| bar | line | has | wants | | notes in the bar |
|----:|-----:|----:|------:|:--|:---|
| 1 | 4 | 1/8 | 8/8 | too short | `TOD` |

Look at bar **1** (line 4).

### abc/film/hisaishi/kiki_town.abc

*A Town with an Ocean view* · 8/8 per bar · 9 bars · one pass is 17.750 measures -- 6/8 too long (or 2/8 too short).

Every bar is a full measure; the length comes from somewhere else (a repeat structure, or a tie across the end).

### abc/italian/tarantella napoletana.abc — tune 1/2

*Tarantella Napoletana* · 6/8 per bar · 36 bars · one pass is 63.500 measures -- 3/8 too long (or 3/8 too short).

| bar | line | has | wants | | notes in the bar |
|----:|-----:|----:|------:|:--|:---|
| 9 | 12 | 3/8 | 6/8 | ok, answered | `"Dm"D2z` |
| 10 | 14 | 3/8 | 6/8 | ok, answered | `zDE` |
| 18 | 15 | 3/8 | 6/8 | ok, answered | `"Dm"D2z` |
| 19 | 17 | 3/8 | 6/8 | ok, answered | `"C7"CDE` |
| 27 | 18 | 3/8 | 6/8 | ok, answered | `"F"F2z` |
| 28 | 20 | 3/8 | 6/8 | ok, answered | `A2B` |
| 36 | 21 | 3/8 | 6/8 | too short | `"Dm"D2z` |

Look at bar **36** (line 21).

### abc/italian/tarantella napoletana.abc — tune 2/2

*Tarantella Napoletana* · 6/8 per bar · 36 bars · one pass is 63.500 measures -- 3/8 too long (or 3/8 too short).

| bar | line | has | wants | | notes in the bar |
|----:|-----:|----:|------:|:--|:---|
| 9 | 33 | 3/8 | 6/8 | ok, answered | `"Am"A2z` |
| 10 | 35 | 3/8 | 6/8 | ok, answered | `zAB` |
| 18 | 36 | 3/8 | 6/8 | ok, answered | `"Am"A2z` |
| 19 | 38 | 3/8 | 6/8 | ok, answered | `"G7"GAB` |
| 27 | 39 | 3/8 | 6/8 | ok, answered | `"C"c2z` |
| 28 | 41 | 3/8 | 6/8 | ok, answered | `e2f` |
| 36 | 42 | 3/8 | 6/8 | too short | `"Am"A2z` |

Look at bar **36** (line 42).

### abc/maori/te hokinga mai.abc — tune 1/2

*Te Hokinga Mai* · 8/8 per bar · 50 bars · one pass is 73.750 measures -- 6/8 too long (or 2/8 too short).

| bar | line | has | wants | | notes in the bar |
|----:|-----:|----:|------:|:--|:---|
| 35 | 19 | 7/8 | 8/8 | too short | `"Ab"A4-A2 C` |

Look at bar **35** (line 19).

### abc/maori/te hokinga mai.abc — tune 2/2

*Te Hokinga Mai* · 8/8 per bar · 50 bars · one pass is 73.750 measures -- 6/8 too long (or 2/8 too short).

| bar | line | has | wants | | notes in the bar |
|----:|-----:|----:|------:|:--|:---|
| 35 | 43 | 7/8 | 8/8 | too short | `"F"F4-F2 A,` |

Look at bar **35** (line 43).

### abc/pop/popcorn.abc — tune 1/3

*Popcorn* · 8/8 per bar · 17 bars · one pass is 32.500 measures -- 4/8 too long (or 4/8 too short).

| bar | line | has | wants | | notes in the bar |
|----:|-----:|----:|------:|:--|:---|
| 1 | 9 | 4/8 | 8/8 | too short | `"Cm" z2 cB` |

Look at bar **1** (line 9).

### abc/pop/used to know.abc

*Somebody I Used to Know* · 8/8 per bar · 12 bars · one pass is 11.969 measures -- 0.9688 too long (or 0.0313 too short).

| bar | line | has | wants | | notes in the bar |
|----:|-----:|----:|------:|:--|:---|
| 8 | 10 | 0.9688 | 8/8 | too short | `"d"d2z2 "C"z/ z/2 e/4f/4g/4 a2` |

Look at bar **8** (line 10).

### abc/russian/the red army is the strongest.abc

*The Red Army Is The Strongest* · 8/8 per bar · 57 bars · one pass is 66.870 measures -- 0.8698 too long (or 0.1302 too short).

Every bar is a full measure; the length comes from somewhere else (a repeat structure, or a tie across the end).

### abc/scottish/franks_reel.abc

*Frank's Reel* · 8/8 per bar · 26 bars · one pass is 32.250 measures -- 2/8 too long (or 6/8 too short).

| bar | line | has | wants | | notes in the bar |
|----:|-----:|----:|------:|:--|:---|
| 1 | 11 | 1/8 | 8/8 | ok, answered | `z` |
| 9 | 12 | 7/8 | 8/8 | too short | `"D"AGFA "G"G3` |
| 10 | 13 | 3/8 | 8/8 | too short | `def` |
| 26 | 16 | 7/8 | 8/8 | ok, answered | `"D"AGFA "G"G3` |

Look at bars **9** (line 12), **10** (line 13).

### abc/scottish/highland_fling.abc

*Highland Fling* · 8/8 per bar · 9 bars · one pass is 16.125 measures -- 1/8 too long (or 7/8 too short).

| bar | line | has | wants | | notes in the bar |
|----:|-----:|----:|------:|:--|:---|
| 1 | 8 | 1/8 | 8/8 | too short | `F` |

Look at bar **1** (line 8).

### abc/shanty/grogg mayles.abc

*Grogg Mayles* · 8/8 per bar · 26 bars · one pass is 36.295 measures -- 0.2953 too long (or 0.7047 too short).

| bar | line | has | wants | | notes in the bar |
|----:|-----:|----:|------:|:--|:---|
| 1 | 11 | 1/8 | 8/8 | too short | `"^ 85" a/>g/` |
| 19 | 16 | 4/8 | 8/8 | too short | `"B" b>b c'>b"F"[Q:1/4=87` |
| 20 | 16 | 4/8 | 8/8 | too short | `"^molto rit." a[Q:1/4=85]"^.2"g[Q:1/4=83]"^.3" f>[Q:1/4=80]"^.6"f[Q:1/4=81]` |
| 21 | 17 | 4/8 | 8/8 | too short | `"^.7" g>[Q:1/4=76]"^.9"g[Q:1/4=76] a>[Q:1/4=73]"^.3"g"Dm"[Q:1/4=72` |
| 22 | 17 | 4/8 | 8/8 | too short | `"^.3" f[Q:1/4=70]"^.5"e[Q:1/4=68]"^.7" d>A[Q:1/4=77]"^.8"[Q:1/4=74` |
| 24 | 19 | 4/8 | 8/8 | too short | `fed^c"Dm"[Q:1/4=40` |
| 25 | 19 | 4/8 | 8/8 | too short | `d3[Q:1/4=87]"^in Tempo" a/>g/` |

Look at bars **1** (line 11), **19** (line 16), **20** (line 16), **21** (line 17), **22** (line 17), **24** (line 19), **25** (line 19).

### abc/tv/a-team.abc — tune 1/2

*A-Team Theme* · 8/8 per bar · 12 bars · one pass is 11.875 measures -- 7/8 too long (or 1/8 too short).

| bar | line | has | wants | | notes in the bar |
|----:|-----:|----:|------:|:--|:---|
| 9 | 13 | 7/8 | 8/8 | too short | `"D7Bb/D"=cB G"D7"c2 "G/D"B2` |

Look at bar **9** (line 13).

### abc/tv/a-team.abc — tune 2/2

*A-Team Theme* · 8/8 per bar · 12 bars · one pass is 11.875 measures -- 7/8 too long (or 1/8 too short).

| bar | line | has | wants | | notes in the bar |
|----:|-----:|----:|------:|:--|:---|
| 9 | 27 | 7/8 | 8/8 | too short | `"F7Bb/F"_ed B"F7"e2 "Bb/F"d2` |

Look at bar **9** (line 27).

### abc/tv/detective_conan.abc — tune 1/4

*Detective Conan Theme* · 8/8 per bar · 37 bars · one pass is 37.375 measures -- 3/8 too long (or 5/8 too short).

| bar | line | has | wants | | notes in the bar |
|----:|-----:|----:|------:|:--|:---|
| 29 | 17 | 10/8 | 8/8 | too long | `"Am" c2 BA z2 ABcd` |
| 36 | 18 | 9/8 | 8/8 | too long | `"C" e2 g2 "B7" f ^d3 "Em" e-` |

Look at bars **29** (line 17), **36** (line 18).

### abc/tv/detective_conan.abc — tune 2/4

*Detective Conan Theme* · 8/8 per bar · 37 bars · one pass is 37.375 measures -- 3/8 too long (or 5/8 too short).

| bar | line | has | wants | | notes in the bar |
|----:|-----:|----:|------:|:--|:---|
| 29 | 36 | 10/8 | 8/8 | too long | `d2 cB z2 Bcde` |
| 36 | 37 | 9/8 | 8/8 | too long | `f2 a2 g =e3 f-` |

Look at bars **29** (line 36), **36** (line 37).

### abc/tv/detective_conan.abc — tune 3/4

*Detective Conan Theme* · 8/8 per bar · 37 bars · one pass is 37.375 measures -- 3/8 too long (or 5/8 too short).

| bar | line | has | wants | | notes in the bar |
|----:|-----:|----:|------:|:--|:---|
| 29 | 56 | 10/8 | 8/8 | too long | `"Dm" f2 ed z2 defg` |
| 36 | 57 | 9/8 | 8/8 | too long | `"F" a2 c'2 "E7" b ^g3 "Am" a-` |

Look at bars **29** (line 56), **36** (line 57).

### abc/tv/detective_conan.abc — tune 4/4

*Detective Conan Theme* · 8/8 per bar · 37 bars · one pass is 37.375 measures -- 3/8 too long (or 5/8 too short).

| bar | line | has | wants | | notes in the bar |
|----:|-----:|----:|------:|:--|:---|
| 29 | 75 | 10/8 | 8/8 | too long | `d2 cB z2 Bcde` |
| 36 | 76 | 9/8 | 8/8 | too long | `f2 a2 g =e3 f-` |

Look at bars **29** (line 75), **36** (line 76).

### abc/unsorted/dota/alles dur.abc

*Alles Dur* · 8/8 per bar · 1 bars · one pass is 0.125 measures -- 1/8 too long (or 7/8 too short).

| bar | line | has | wants | | notes in the bar |
|----:|-----:|----:|------:|:--|:---|
| 1 | 4 | 1/8 | 8/8 | too short | `TOD` |

Look at bar **1** (line 4).

### abc/yiddish/daloy politsey.abc — tune 1/2

*Daloy Politsey* · 4/8 per bar · 36 bars · one pass is 43.750 measures -- 3/8 too long (or 1/8 too short).

| bar | line | has | wants | | notes in the bar |
|----:|-----:|----:|------:|:--|:---|
| 26 | 15 | 3/8 | 4/8 | too short | `FF E` |

Look at bar **26** (line 15).

### abc/yiddish/daloy politsey.abc — tune 2/2

*Daloy Politsey* · 4/8 per bar · 36 bars · one pass is 35.500 measures -- 2/8 too long (or 2/8 too short).

| bar | line | has | wants | | notes in the bar |
|----:|-----:|----:|------:|:--|:---|
| 26 | 33 | 3/8 | 4/8 | too short | `DD C` |
| 27 | 33 | 3/8 | 4/8 | too short | `F z2` |

Look at bars **26** (line 33), **27** (line 33).

### abc/yiddish/dos kelbl.abc — tune 1/3

*Dos Kelbl* · 8/8 per bar · 24 bars · one pass is 47.833 measures -- 0.8333 too long (or 0.1667 too short).

| bar | line | has | wants | | notes in the bar |
|----:|-----:|----:|------:|:--|:---|
| 9 | 12 | 0.9583 | 8/8 | too short | `"C" c c c4/3 B/` |
| 13 | 14 | 0.9583 | 8/8 | too short | `"C" c c c4/3 B/` |

Look at bars **9** (line 12), **13** (line 14).

### abc/yiddish/dos kelbl.abc — tune 2/3

*Dos Kelbl* · 8/8 per bar · 24 bars · one pass is 47.417 measures -- 0.4167 too long (or 0.5833 too short).

| bar | line | has | wants | | notes in the bar |
|----:|-----:|----:|------:|:--|:---|
| 9 | 33 | 0.7917 | 8/8 | too short | `g g g2/3 f/2` |
| 13 | 35 | 0.9167 | 8/8 | too short | `g g g2/3 f` |

Look at bars **9** (line 33), **13** (line 35).

### abc/yiddish/dos kelbl.abc — tune 3/3

*Dos Kelbl* · 8/8 per bar · 24 bars · one pass is 47.417 measures -- 0.4167 too long (or 0.5833 too short).

| bar | line | has | wants | | notes in the bar |
|----:|-----:|----:|------:|:--|:---|
| 9 | 54 | 0.7917 | 8/8 | too short | `c c c2/3 ^A/2` |
| 13 | 56 | 0.9167 | 8/8 | too short | `c c c2/3 ^A` |

Look at bars **9** (line 54), **13** (line 56).

### abc/yiddish/in kamf.abc

*In Kamf* · 8/8 per bar · 11 bars · one pass is 9.875 measures -- 7/8 too long (or 1/8 too short).

| bar | line | has | wants | | notes in the bar |
|----:|-----:|----:|------:|:--|:---|
| 1 | 9 | 2/8 | 8/8 | ok, answered | `C2` |
| 3 | 9 | 7/8 | 8/8 | too short | `(G3=E) C z _E` |
| 11 | 11 | 6/8 | 8/8 | ok, answered | `f6` |

Look at bar **3** (line 9).

## Loops, but a bar inside the tune is unanswered (14)

One pass is the right length, so the loop itself is fine, but a partial bar in the middle has nothing completing it -- usually a repeat that lands mid-bar.

### abc/american/which side are you on.abc — tune 1/2

*Which Side Are You On?* · 4/8 per bar · 17 bars · the pass is a whole number of measures, but a bar inside the tune is not completed by anything.

| bar | line | has | wants | | notes in the bar |
|----:|-----:|----:|------:|:--|:---|
| 1 | 8 | 3/8 | 4/8 | too short | `z2G` |
| 17 | 11 | 3/8 | 4/8 | too short | `C3` |

Look at bars **1** (line 8), **17** (line 11).

### abc/australian/waltzing matilda.abc — tune 2/2

*Waltzing Matilda* · 8/8 per bar · 16 bars · the pass is a whole number of measures, but a bar inside the tune is not completed by anything.

| bar | line | has | wants | | notes in the bar |
|----:|-----:|----:|------:|:--|:---|
| 1 | 22 | 10/8 | 8/8 | too long | `CD E2E2 D2D2` |
| 16 | 25 | 6/8 | 8/8 | too short | `D2 DD C2` |

Look at bars **1** (line 22), **16** (line 25).

### abc/classical/dowland/pavane lachrimae.abc

*10. M. John Langtons Pavan* · 8/8 per bar · 3 bars · the pass is a whole number of measures, but a bar inside the tune is not completed by anything.

| bar | line | has | wants | | notes in the bar |
|----:|-----:|----:|------:|:--|:---|
| 1 | 11 | 128/8 | 8/8 | too long | `c3 B A2 G3 F F3 E/D/ E2 F c d e f2 e2 d2 c B/ c/ d c c3 =B/ A/ =B/ c =B/ c G A B c2 B2 A2 G3 F2 D E F2 E F8` |
| 2 | 14 | 112/8 | 8/8 | too long | `G F G A B3 A/ G/ A/ =B/ c2 =B c2 z f > f e f d c2 d c > c =B c > A G/ F/ G F > c d > d e f d2 _e > d c d/ c/ =B c2 =B/ A/ =B/ c =B/ c8` |
| 3 | 17 | 144/8 | 8/8 | too long | `z c A > B c d c > B A c f > e d/ c/ c2 =B c G A B c2 B2 A2 z f2 e/ d/ e f "(1)"d2 d/ f/ e/ d/ ^c3 d > d c/ =B/ c/ d ^c/ d3 c B4 A G/ F/ G3 F F3 E/ D/ E/ F E/ HF8` |

Look at bars **1** (line 11), **2** (line 14), **3** (line 17).

### abc/classical/shostakovich/waltz 2.abc — tune 1/3

*Waltz No.2* · 6/8 per bar · 128 bars · the pass is a whole number of measures, but a bar inside the tune is not completed by anything.

| bar | line | has | wants | | notes in the bar |
|----:|-----:|----:|------:|:--|:---|
| 124 | 32 | 4/8 | 6/8 | too short | `"Db".[Af].[Bg]` |
| 128 | 33 | 4/8 | 6/8 | too short | `"Fm".[faf'] z` |

Look at bars **124** (line 32), **128** (line 33).

### abc/classical/shostakovich/waltz 2.abc — tune 2/3

*Waltz No.2* · 6/8 per bar · 128 bars · the pass is a whole number of measures, but a bar inside the tune is not completed by anything.

| bar | line | has | wants | | notes in the bar |
|----:|-----:|----:|------:|:--|:---|
| 124 | 66 | 4/8 | 6/8 | too short | `"Eb".[Bg].[ca]` |
| 128 | 67 | 4/8 | 6/8 | too short | `"Gm".[gbg'] z` |

Look at bars **124** (line 66), **128** (line 67).

### abc/classical/shostakovich/waltz 2.abc — tune 3/3

*Waltz No.2* · 6/8 per bar · 128 bars · the pass is a whole number of measures, but a bar inside the tune is not completed by anything.

| bar | line | has | wants | | notes in the bar |
|----:|-----:|----:|------:|:--|:---|
| 124 | 100 | 4/8 | 6/8 | too short | `"Ab".[cE].[dF]` |
| 128 | 101 | 4/8 | 6/8 | too short | `"Cm".[c'ec] z` |

Look at bars **124** (line 100), **128** (line 101).

### abc/jazz/all of me.abc

*All Of Me* · 8/8 per bar · 30 bars · the pass is a whole number of measures, but a bar inside the tune is not completed by anything.

| bar | line | has | wants | | notes in the bar |
|----:|-----:|----:|------:|:--|:---|
| 23 | 20 | 12/8 | 8/8 | too long | `"F6" c4 c B` |
| 30 | 22 | 4/8 | 8/8 | too short | `"Dm7"z2` |

Look at bars **23** (line 20), **30** (line 22).

### abc/peruvian/el condor pasa.abc — tune 1/3

*El Condor Pasa* · 8/8 per bar · 21 bars · the pass is a whole number of measures, but a bar inside the tune is not completed by anything.

| bar | line | has | wants | | notes in the bar |
|----:|-----:|----:|------:|:--|:---|
| 1 | 10 | 1/8 | 8/8 | ok, answered | `C` |
| 7 | 12 | 7/8 | 8/8 | ok, answered | `F4- F3` |
| 8 | 12 | 1/8 | 8/8 | ok, answered | `C` |
| 9 | 12 | 1/8 | 8/8 | too short | `c` |
| 21 | 16 | 7/8 | 8/8 | ok, answered | `F6 z` |

Look at bar **9** (line 12).

### abc/peruvian/el condor pasa.abc — tune 2/3

*El Condor Pasa* · 8/8 per bar · 21 bars · the pass is a whole number of measures, but a bar inside the tune is not completed by anything.

| bar | line | has | wants | | notes in the bar |
|----:|-----:|----:|------:|:--|:---|
| 1 | 26 | 1/8 | 8/8 | ok, answered | `E` |
| 7 | 28 | 7/8 | 8/8 | ok, answered | `A4- A3` |
| 8 | 28 | 1/8 | 8/8 | ok, answered | `E` |
| 9 | 28 | 1/8 | 8/8 | too short | `e` |
| 21 | 32 | 7/8 | 8/8 | ok, answered | `A6 z` |

Look at bar **9** (line 28).

### abc/peruvian/el condor pasa.abc — tune 3/3

*El Condor Pasa* · 8/8 per bar · 21 bars · the pass is a whole number of measures, but a bar inside the tune is not completed by anything.

| bar | line | has | wants | | notes in the bar |
|----:|-----:|----:|------:|:--|:---|
| 1 | 43 | 1/8 | 8/8 | ok, answered | `C` |
| 7 | 45 | 7/8 | 8/8 | ok, answered | `F4- F3` |
| 8 | 45 | 1/8 | 8/8 | ok, answered | `C` |
| 9 | 45 | 1/8 | 8/8 | too short | `c` |
| 21 | 49 | 7/8 | 8/8 | ok, answered | `F6 z` |

Look at bar **9** (line 45).

### abc/pop/game/mario theme.abc

*Mario Theme* · 8/8 per bar · 14 bars · the pass is a whole number of measures, but a bar inside the tune is not completed by anything.

| bar | line | has | wants | | notes in the bar |
|----:|-----:|----:|------:|:--|:---|
| 8 | 10 | 7/8 | 8/8 | too short | `"F"^GAc z Acd` |
| 14 | 11 | 5/8 | 8/8 | too short | `"C"c2 z2 z` |

Look at bars **8** (line 10), **14** (line 11).

### abc/practice/chromatic_scale.abc

*Chromatic Scale C to d'* · 8/8 per bar · 25 bars · the pass is a whole number of measures, but a bar inside the tune is not completed by anything.

| bar | line | has | wants | | notes in the bar |
|----:|-----:|----:|------:|:--|:---|
| 1 | 6 | 16/8 | 8/8 | too long | `K: C C ^C =C ^C =C` |
| 2 | 7 | 16/8 | 8/8 | too long | `^C D ^C D ^C` |
| 3 | 7 | 16/8 | 8/8 | too long | `D ^D =D ^D =D` |
| 4 | 8 | 16/8 | 8/8 | too long | `^D E ^D E ^` |
| 5 | 8 | 16/8 | 8/8 | too long | `E F E F` |
| 6 | 9 | 16/8 | 8/8 | too long | `F ^F =F ^F =` |
| 7 | 9 | 16/8 | 8/8 | too long | `^F G ^F G` |
| 8 | 10 | 16/8 | 8/8 | too long | `G ^G =G ^G` |
| 9 | 10 | 16/8 | 8/8 | too long | `^G A ^G A` |
| 10 | 11 | 16/8 | 8/8 | too long | `A ^A =A ^A` |
| 11 | 11 | 16/8 | 8/8 | too long | `^A B ^A` |
| 12 | 12 | 16/8 | 8/8 | too long | `B c B` |
| 13 | 12 | 16/8 | 8/8 | too long | `c ^c =c` |
| 14 | 13 | 16/8 | 8/8 | too long | `^c d ^c` |
| 15 | 13 | 16/8 | 8/8 | too long | `d ^d =d` |
| 16 | 14 | 16/8 | 8/8 | too long | `^d e` |
| 17 | 14 | 16/8 | 8/8 | too long | `e` |
| 18 | 15 | 16/8 | 8/8 | too long | `f ^f =` |
| 19 | 15 | 16/8 | 8/8 | too long | `^f g` |
| 20 | 16 | 16/8 | 8/8 | too long | `g ^g` |
| 21 | 16 | 16/8 | 8/8 | too long | `^g` |
| 22 | 17 | 16/8 | 8/8 | too long | `a ^a` |
| 23 | 17 | 16/8 | 8/8 | too long | `^a` |
| 24 | 18 | 16/8 | 8/8 | too long | `b c` |
| 25 | 18 | 16/8 | 8/8 | too long | `c' ^c' =c` |

Look at bars **1** (line 6), **2** (line 7), **3** (line 7), **4** (line 8), **5** (line 8), **6** (line 9), **7** (line 9), **8** (line 10), **9** (line 10), **10** (line 11), **11** (line 11), **12** (line 12), **13** (line 12), **14** (line 13), **15** (line 13), **16** (line 14), **17** (line 14), **18** (line 15), **19** (line 15), **20** (line 16), **21** (line 16), **22** (line 17), **23** (line 17), **24** (line 18), **25** (line 18).

### abc/scottish/irving_steeple.abc

*Irving Steeple* · 8/8 per bar · 12 bars · the pass is a whole number of measures, but a bar inside the tune is not completed by anything.

| bar | line | has | wants | | notes in the bar |
|----:|-----:|----:|------:|:--|:---|
| 1 | 8 | 1/8 | 8/8 | ok, answered | `c` |
| 5 | 8 | 7/8 | 8/8 | ok, answered | `"D"fdec dDD` |
| 6 | 8 | 1/8 | 8/8 | ok, answered | `A` |
| 10 | 9 | 7/8 | 8/8 | too short | `"D"fdec dDD` |
| 12 | 9 | 7/8 | 8/8 | ok, answered | `"D"fdec dDD` |

Look at bar **10** (line 9).

### abc/spanish/nanita nana.abc

*Nanita Nana* · 6/8 per bar · 19 bars · the pass is a whole number of measures, but a bar inside the tune is not completed by anything.

| bar | line | has | wants | | notes in the bar |
|----:|-----:|----:|------:|:--|:---|
| 2 | 8 | 12/8 | 6/8 | too long | `AA/2A/2B/2G/2 dA2 GA/2B/2c/2B/2 A/2G/2F/2G` |

Look at bar **2** (line 8).

## Meter changes and the bars do not balance (2)

### abc/yiddish/chiribim.abc — tune 1/2

*Chiribim Chiribom* · 8/8 per bar · 22 bars · the meter changes mid-tune and the bars do not balance.

| bar | line | has | wants | | notes in the bar |
|----:|-----:|----:|------:|:--|:---|
| 16 | 17 | 1.0625 | 8/8 | too long | `d/B/B/B- BB/B/ cB/A/- A2` |
| 21 | 20 | 8/8 | 4/8 | too long | `C/F/G/A/ GF/A/ GF/A/ GF` |
| 22 | 20 | 8/8 | 4/8 | too long | `C/F/G/A/ GF z c .f2` |

Look at bars **16** (line 17), **21** (line 20), **22** (line 20).

### abc/yiddish/chiribim.abc — tune 2/2

*Chiribim Chiribom* · 8/8 per bar · 22 bars · the meter changes mid-tune and the bars do not balance.

| bar | line | has | wants | | notes in the bar |
|----:|-----:|----:|------:|:--|:---|
| 16 | 38 | 1.0625 | 8/8 | too long | `c'/a/a/a- aa/a/ ba/g/- g2` |
| 21 | 41 | 8/8 | 4/8 | too long | `B/e/f/g/ fe/g/ fe/g/ fe` |
| 22 | 41 | 8/8 | 4/8 | too long | `B/e/f/g/ fe z b .e'2` |

Look at bars **16** (line 38), **21** (line 41), **22** (line 41).

## Could not be measured (7)

The played length disagrees with the written length even though there is no repeat to expand, so the script will not pass judgement on these. Worth a look by hand.

### abc/bartok/romanian folk dances/1 joc cu bata.abc

*1 Joc cu bata* · 4/8 per bar · 16 bars · written 68/8 but measured 8.4990 with no repeats to expand -- not judged.

| bar | line | has | wants | | notes in the bar |
|----:|-----:|----:|------:|:--|:---|
| 12 | 11 | 8/8 | 4/8 | too long | `(^ga) (a4=gf) (fe` |

Look at bar **12** (line 11).

### abc/bartok/romanian folk dances/2 braul.abc — tune 2/2

*2 Braul* · 4/8 per bar · 32 bars · written 127/8 but measured 15.8771 with no repeats to expand -- not judged.

| bar | line | has | wants | | notes in the bar |
|----:|-----:|----:|------:|:--|:---|
| 6 | 25 | 3/8 | 4/8 | too short | `.d2 (5d/2c/2B/2A/2G/2` |

Look at bar **6** (line 25).

### abc/latino/chamberguito.abc — tune 2/3

*Villoldo Que Haces Chamberguito* · 4/8 per bar · 80 bars · written 40.3542 but measured 40.5208 with no repeats to expand -- not judged.

| bar | line | has | wants | | notes in the bar |
|----:|-----:|----:|------:|:--|:---|
| 33 | 25 | 0.4792 | 4/8 | too short | `(3:2:2z/ [ef]/4e/4^d/4 e/ z/4 ^e/4` |
| 34 | 25 | 5/8 | 4/8 | too long | `f/4 (12:7:2z ^e/4 f` |
| 36 | 25 | 0.6354 | 4/8 | too long | `^c/4 (12:7:2z =c/4 (6:5:2^c z/4` |
| 37 | 26 | 0.4583 | 4/8 | too short | `(3:2:2z/ [AB]/4A/ G/ z/4 F/4` |
| 39 | 26 | 0.4583 | 4/8 | too short | `(3:2:2z/ [GA]/4G/ F/ z/4 E/4` |
| 41 | 27 | 0.4792 | 4/8 | too short | `(3:2:2z/ [ef]/4e/4^d/4 e/ z/4 ^e/4` |
| 42 | 27 | 5/8 | 4/8 | too long | `f/4 (12:7:2z ^e/4 f` |
| 44 | 27 | 0.6354 | 4/8 | too long | `^c/4 (12:7:2z =c/4 (6:5:2^c z/4` |
| 45 | 28 | 0.4583 | 4/8 | too short | `(3:2:2z/ [AB]/4A/ G/ z/4 F/4` |

Look at bars **33** (line 25), **34** (line 25), **36** (line 25), **37** (line 26), **39** (line 26), **41** (line 27), **42** (line 27), **44** (line 27), **45** (line 28).

### abc/latino/chamberguito.abc — tune 3/3

*Villoldo Que Haces Chamberguito* · 4/8 per bar · 80 bars · written 40.3542 but measured 40.5208 with no repeats to expand -- not judged.

| bar | line | has | wants | | notes in the bar |
|----:|-----:|----:|------:|:--|:---|
| 33 | 60 | 0.4792 | 4/8 | too short | `(3:2:2z/ [ga]/4g/4^f/4 g/ z/4 ^g/4` |
| 34 | 60 | 5/8 | 4/8 | too long | `a/4 (12:7:2z ^g/4 a` |
| 36 | 60 | 0.6354 | 4/8 | too long | `=e/4 (12:7:2z _e/4 (6:5:2=e z/4` |
| 37 | 61 | 0.4583 | 4/8 | too short | `(3:2:2z/ [cd]/4c/ B/ z/4 A/4` |
| 39 | 61 | 0.4583 | 4/8 | too short | `(3:2:2z/ [Bc]/4B/ A/ z/4 G/4` |
| 41 | 62 | 0.4792 | 4/8 | too short | `(3:2:2z/ [ga]/4g/4^f/4 g/ z/4 ^g/4` |
| 42 | 62 | 5/8 | 4/8 | too long | `a/4 (12:7:2z ^g/4 a` |
| 44 | 62 | 0.6354 | 4/8 | too long | `=e/4 (12:7:2z _e/4 (6:5:2=e z/4` |
| 45 | 63 | 0.4583 | 4/8 | too short | `(3:2:2z/ [cd]/4c/ B/ z/4 A/4` |

Look at bars **33** (line 60), **34** (line 60), **36** (line 60), **37** (line 61), **39** (line 61), **41** (line 62), **42** (line 62), **44** (line 62), **45** (line 63).

### abc/tv/fraggle rock.abc

*Fraggle Rock Theme* · 8/8 per bar · 4 bars · written 32/8 but measured 4.0021 with no repeats to expand -- not judged.

Every bar is a full measure; the length comes from somewhere else (a repeat structure, or a tie across the end).

### abc/unsorted/people united.abc — tune 1/2

*The People United* · 8/8 per bar · 17 bars · written 14.7083 but measured 130/8 with no repeats to expand -- not judged.

| bar | line | has | wants | | notes in the bar |
|----:|-----:|----:|------:|:--|:---|
| 1 | 8 | 1/8 | 8/8 | too short | `(C` |
| 6 | 10 | 0.8333 | 8/8 | too short | `F2) (3:2:2 z2(F A2) (3:2:2 z2(A` |
| 7 | 10 | 0.9167 | 8/8 | too short | `(3:2:2 c2)(c (3:2:2 B2A G2) (3:2:2 z2(C` |
| 8 | 11 | 0.8333 | 8/8 | too short | `F2) (3:2:2 z2(F A2) (3:2:2 z2(A` |
| 9 | 11 | 0.9167 | 8/8 | too short | `(3:2:2 c2)(c (3:2:2 B2A G2) (3:2:2 z2(c` |
| 10 | 12 | 0.8333 | 8/8 | too short | `d2) (3:2:2 z2(A G2) (3:2:2 z2(d` |
| 11 | 12 | 0.9167 | 8/8 | too short | `(3:2:2 c2B (3:2:2 c2G F2) (3:2:2 z2(c` |
| 12 | 13 | 0.8333 | 8/8 | too short | `B2) (3:2:2 z2(F =E2) (3:2:2 z2B` |
| 14 | 14 | 0.8333 | 8/8 | too short | `d2- (3:2:2 d2 A G2- (3:2:2 G2 d` |
| 15 | 14 | 0.9167 | 8/8 | too short | `(3:2:2 c2 B (3:2:2 c2 G F2- (3:2:2 F2 c` |
| 16 | 15 | 0.8333 | 8/8 | too short | `B2- (3:2:2 B2 F =E2- (3:2:2 =E2 B` |
| 17 | 15 | 0.9167 | 8/8 | too short | `(3:2:2 A2 G (3:2:2 F2 =E F2 (3:2:2 z2 z` |

Look at bars **1** (line 8), **6** (line 10), **7** (line 10), **8** (line 11), **9** (line 11), **10** (line 12), **11** (line 12), **12** (line 13), **14** (line 14), **15** (line 14), **16** (line 15), **17** (line 15).

### abc/unsorted/people united.abc — tune 2/2

*The People United* · 8/8 per bar · 17 bars · written 14.7083 but measured 130/8 with no repeats to expand -- not judged.

| bar | line | has | wants | | notes in the bar |
|----:|-----:|----:|------:|:--|:---|
| 1 | 24 | 1/8 | 8/8 | too short | `(A,` |
| 6 | 26 | 0.8333 | 8/8 | too short | `D2) (3:2:2 z2(D F2) (3:2:2 z2(F` |
| 7 | 26 | 0.9167 | 8/8 | too short | `(3:2:2 A2)(A (3:2:2 G2F E2) (3:2:2 z2(A,` |
| 8 | 27 | 0.8333 | 8/8 | too short | `D2) (3:2:2 z2(D F2) (3:2:2 z2(F` |
| 9 | 27 | 0.9167 | 8/8 | too short | `(3:2:2 A2)(A (3:2:2 G2F E2) (3:2:2 z2(A` |
| 10 | 28 | 0.8333 | 8/8 | too short | `B2) (3:2:2 z2(F E2) (3:2:2 z2(B` |
| 11 | 28 | 0.9167 | 8/8 | too short | `(3:2:2 A2G (3:2:2 A2E D2) (3:2:2 z2(A` |
| 12 | 29 | 0.8333 | 8/8 | too short | `G2) (3:2:2 z2(D ^C2) (3:2:2 z2G` |
| 14 | 30 | 0.8333 | 8/8 | too short | `B2- (3:2:2 B2 F E2- (3:2:2 E2 B` |
| 15 | 30 | 0.9167 | 8/8 | too short | `(3:2:2 A2 G (3:2:2 A2 E D2- (3:2:2 D2 A` |
| 16 | 31 | 0.8333 | 8/8 | too short | `G2- (3:2:2 G2 D ^C2- (3:2:2 ^C2 G` |
| 17 | 31 | 0.9167 | 8/8 | too short | `(3:2:2 F2 E (3:2:2 D2 ^C D2 (3:2:2 z2 z` |

Look at bars **1** (line 24), **6** (line 26), **7** (line 26), **8** (line 27), **9** (line 27), **10** (line 28), **11** (line 28), **12** (line 29), **14** (line 30), **15** (line 30), **16** (line 31), **17** (line 31).

