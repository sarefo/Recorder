# Busking with the repertoire

Ideas from 2026-11-07 for turning these tunes into a street act. Nothing here is
built or tested yet. The AI findings came mostly from vendor pages and 2025
research, so check them again before spending money or time.

## The plan, in order

1. Good backing tracks plus a stage mode in the app.
2. The country request act. It needs almost no new technology and may matter most.
3. Accompaniment that follows the player. Test it on a noisy street before building it.

## 1. Backing tracks and stage mode

The sound matters more than the software. The app's built-in synth would sound cheap
on the street, so render each tune ahead of time with good samples. Build it from
the ABC, so key and form match exactly. Style by tradition:

| Tradition | Backing |
| --- | --- |
| Irish, Scottish | guitar or bouzouki, bodhrán |
| Klezmer | accordion, tuba oom-pah |
| Tango | bandoneon, bass |
| Film | strings |

Claude can write the bass lines, countermelodies and second voices from each ABC file.
This depends on the chords, and many tunes still have none.

Stage mode: large notation, a count-in, and a Bluetooth foot pedal for start and
next tune.

Weakness: a fixed track suits reels and bulgars but ruins slow airs like She Moved
Through the Fair, which need to breathe.

## 2. Pick a country

The repertoire covers around 70 places. A map board saying "pick a country" turns
passers-by into participants, and tourists will ask for home. The app finds the
tune at once. Add a QR code for requests and tips.

## 3. Accompaniment that follows the player

This fixes the slow-air problem, and the app suits it unusually well: it already
knows every note, and a recorder or flute plays one clean note at a time, which
should be much easier to track than a voice or a piano.

- Music Plus One proved the approach with a statistical score matcher. It has to
  predict the next note, because reacting alone is too late.
- Antescofo's engine, behind Metronaut, claims to hold sync through tempo changes.
  That is the vendor's description. Metronaut uses its own catalog, so this
  repertoire would need a custom build or a license for the engine.
- Main risk: street noise. A clip-on mic would probably be needed.
- Cheaper fallback: tap the tempo with a foot.

First experiment: pitch tracking from the phone mic on a real street.

## 4. Generative AI

- **Suno and similar:** they tend to reinterpret an uploaded melody, so they are a
  poor fit for exact backing.
- **Melody-based tools:** Udio's audio-to-audio, MusicGen-Melody and AnyAccomp look
  closer. No independent comparison found.
- **Best experiment:** render the exact backing first, then use AI only to restyle
  it so it sounds like a real band. Unproven whether timing and chords survive. Try
  one tune.
- **Live jamming models:** Magenta RealTime, Lyria RealTime and ReaLchords could be
  lovely for free drone intros, but not for set tunes. They also need serious
  computing or a connection.

## 5. Things that are not software

- **Live looping:** building a drone and a harmony in front of people is more
  watchable than a hidden track, and it answers the "that's not busking" complaint.
- **Amplification:** a recorder is quiet outdoors, so expect a mic and a battery
  speaker. Rules vary: some places allow battery amps only, some cap the wattage,
  and one source says New York City bans amplification. Check the pitch first.

## Sources

- [Music Plus One (CACM)](https://cacm.acm.org/research/the-informatics-philharmonic)
- [Music Plus One paper (ICML 2010)](https://icml.cc/imls/conferences/2010/papers/904.pdf)
- [Antescofo platform](https://platform.antescofo.com/)
- [Live Music Models paper](https://arxiv.org/abs/2508.04651v1)
- [AnyAccomp](https://huggingface.co/amphion/anyaccomp/blob/main/README.md)
- [AI music generation comparison, 2026](https://www.youngju.dev/blog/culture/2026-05-16-ai-music-generation-2026-suno-v4-udio-stable-audio-2-musicgen-aiva-mubert-soundraw-deep-dive.en)
- [Liverpool ONE busker code](https://www.liverpool-one.com/wp-content/uploads/2024/02/Code-of-Conduct-for-Busker-2024.pdf)
- [Busking setup guide](https://violetrecording.com/busking-setup-guide/)
