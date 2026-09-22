# Bars that are not a full measure

Regenerate with:

```bash
node .claude/skills/abc-new-tune/scripts/abc_loop_check.mjs \
    --bad --bars --skip 670_songs --report loop-check-report.md abc
```

2 tunes, from 1 files. Bar numbers count every barline in playing order, so they match what the checker prints on the terminal. Line numbers are 1-based in the file, and point at the start of the bar.

0 of them have a single bad bar, 0 have two or three, and 2 are mis-barred throughout. The first group is where the quick wins are.

A bar listed as **ok, answered** is a legitimate partial and should be left alone: either a pickup that the final bar pays back, or the short bar before a `:|` that the pickup after the repeat completes. The ones to fix are marked **too long** or **too short**.

Lengths are what abcjs makes of the notation, which is what the app plays — so a tuplet counts as abcjs reads it, not as it was perhaps meant. In a bar full of slurs the quoted notes can start or stop a little early, because abcjs anchors a slurred note to its opening bracket; the bar and line numbers are still exact.

## Pass is not a whole number of measures (2)

These do not loop: the join between the end and the beginning lands off the beat. Where a bar in the middle is over- or under-full, that bar is why, and retiming the last note would hide it rather than fix it.

### abc/latino/chamberguito.abc — tune 2/3

*Villoldo Que Haces Chamberguito* · 4/8 per bar · 80 bars · one pass is 81.042 measures -- 0.0208 too long (or 0.4792 too short).

| bar | line | has | wants | | notes in the bar |
|----:|-----:|----:|------:|:--|:---|
| 34 | 32 | 5/8 | 4/8 | too long | `f/4 (12:7:2z ^e/4 f` |
| 36 | 32 | 0.6354 | 4/8 | too long | `^c/4 (12:7:2z =c/4 (6:5:2^c z/4` |
| 42 | 34 | 5/8 | 4/8 | too long | `f/4 (12:7:2z ^e/4 f` |
| 44 | 34 | 0.6354 | 4/8 | too long | `^c/4 (12:7:2z =c/4 (6:5:2^c z/4` |

Look at bars **34** (line 32), **36** (line 32), **42** (line 34), **44** (line 34).

### abc/latino/chamberguito.abc — tune 3/3

*Villoldo Que Haces Chamberguito* · 4/8 per bar · 80 bars · one pass is 81.042 measures -- 0.0208 too long (or 0.4792 too short).

| bar | line | has | wants | | notes in the bar |
|----:|-----:|----:|------:|:--|:---|
| 34 | 67 | 5/8 | 4/8 | too long | `a/4 (12:7:2z ^g/4 a` |
| 36 | 67 | 0.6354 | 4/8 | too long | `=e/4 (12:7:2z _e/4 (6:5:2=e z/4` |
| 42 | 69 | 5/8 | 4/8 | too long | `a/4 (12:7:2z ^g/4 a` |
| 44 | 69 | 0.6354 | 4/8 | too long | `=e/4 (12:7:2z _e/4 (6:5:2=e z/4` |

Look at bars **34** (line 67), **36** (line 67), **42** (line 69), **44** (line 69).

