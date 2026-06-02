'use strict';

const STATUSES = ['new', 'kept', 'discarded', 'promoted', 'all'];
const state = {
    status: 'new',
    q: '',
    sort: 'rating',
    filterPlayable: false,
    filterChords: false,
    categories: [],  // existing abc/ subfolders, for the new-vs-existing hint
    songs: [],
    current: null,   // current song object
    abc: '',         // ABC currently shown (transposed)
    baseAbc: '',     // untransposed ABC as fetched from the server
    baseVisual: null,// cached abcjs tune object of baseAbc, for strTranspose
    transpose: 0,
    autoFitDone: false,  // whether auto-fit has run for the current song
    metadataPosted: false, // whether we've saved fit+chords for this song
};

// Playable ranges as absolute MIDI numbers, matching abcjs' rendering (middle C 'C' = 60).
// These are the exact written note tokens the app's fingering charts cover, so the verdict
// here agrees with what the real app will actually be able to finger:
//   recorder C..d'  (js/fingering/fingering-manager.js, baroque/german tables)
//   dizi-D   A,..d'  (fingeringDataDiziD) - reaches 3 semitones lower than the recorder.
const RANGES = {
    recorder: { label: '🎼 Recorder', lo: 60, hi: 86 },  // C5..D6 written
    dizi: { label: '🪈 Dizi', lo: 57, hi: 86 },           // A4..D6 written
};

const $ = (sel) => document.querySelector(sel);
const api = (path, opts) => fetch(path, opts).then(r => r.json());

let synth = null;        // abcjs SynthController (recreated per tune)
let audioCtx = null;     // single shared AudioContext (reused across tunes)

function getAudioContext() {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    return audioCtx;
}

function stopAudio() {
    if (synth) {
        try { synth.pause(); } catch (e) { /* not loaded yet */ }
    }
}

// ---- list / tabs ----------------------------------------------------------

async function refreshStats() {
    const params = new URLSearchParams();
    if (state.filterPlayable) params.set('playable', '1');
    if (state.filterChords) params.set('chords', '1');
    const counts = await api('/api/stats?' + params);
    document.querySelectorAll('#tabs button').forEach(btn => {
        const s = btn.dataset.status;
        const n = s === 'all'
            ? Object.values(counts).reduce((a, b) => a + b, 0)
            : (counts[s] || 0);
        btn.textContent = `${s} (${n})`;
        btn.classList.toggle('active', s === state.status);
    });
}

async function loadSongs() {
    const params = new URLSearchParams({
        status: state.status, q: state.q, sort: state.sort, limit: 200,
    });
    if (state.filterPlayable) params.set('playable', '1');
    if (state.filterChords) params.set('chords', '1');
    const data = await api('/api/songs?' + params);
    state.songs = data.songs;
    renderList(data.total);
}

function listBadgeText(song) {
    const parts = [`★ ${fmt(song.rating)}`, `${song.bars ?? '?'} bars`, `${song.n_notes ?? '?'} notes`];
    if (song.instrument_fit === 'recorder') parts.push('rec ✓');
    else if (song.instrument_fit === 'dizi') parts.push('dizi ✓');
    else if (song.instrument_fit === 'none') parts.push('✗ too wide');
    if (song.has_chords === 1) parts.push('♩ chords');
    return parts.join(' · ');
}

function renderList(total) {
    const ul = $('#song-list');
    ul.innerHTML = '';
    state.songs.forEach(song => {
        const li = document.createElement('li');
        li.dataset.id = song.pdmx_id;
        const sub = [song.composer || song.artist || '', song.genres || '']
            .filter(Boolean).join(' · ');
        li.innerHTML =
            `<div class="s-title"></div>` +
            `<div class="s-sub"></div>` +
            `<div class="s-badges"></div>`;
        li.querySelector('.s-title').textContent = song.title || song.song_name || song.pdmx_id;
        li.querySelector('.s-sub').textContent = sub;
        li.querySelector('.s-badges').textContent = listBadgeText(song);
        li.addEventListener('click', () => selectSong(song));
        if (state.current && state.current.pdmx_id === song.pdmx_id) li.classList.add('selected');
        ul.appendChild(li);
    });
    $('#list-footer').textContent =
        `${state.songs.length} shown${total > state.songs.length ? ` of ${total}` : ''}`;
}

function updateListItemBadge(song) {
    const li = document.querySelector(`#song-list li[data-id="${song.pdmx_id}"]`);
    if (li) li.querySelector('.s-badges').textContent = listBadgeText(song);
}

const fmt = (v) => (v == null ? '–' : (+v).toFixed(2));

// ---- detail / audition ----------------------------------------------------

async function selectSong(song) {
    stopAudio();
    state.current = song;
    state.transpose = 0;
    state.autoFitDone = false;
    state.metadataPosted = false;
    document.querySelectorAll('#song-list li').forEach(li =>
        li.classList.toggle('selected', li.dataset.id === song.pdmx_id));

    $('#detail-empty').hidden = true;
    $('#detail').hidden = false;
    $('#action-status').textContent = '';
    $('#action-status').className = 'action-status';

    const stats = [
        song.genres, song.n_tracks != null ? `${song.n_tracks} track(s)` : null,
        song.bars != null ? `${song.bars} bars` : null,
        song.seconds != null ? `${Math.round(song.seconds)}s` : null,
        song.rating != null ? `★ ${fmt(song.rating)}` : null,
    ].filter(Boolean).join(' · ');
    $('#meta').innerHTML = `<div class="m-title"></div><div class="m-sub"></div><div class="m-stats"></div>`;
    $('#meta .m-title').textContent = song.title || song.song_name || song.pdmx_id;
    $('#meta .m-sub').textContent = song.composer || song.artist || '';
    $('#meta .m-stats').textContent = stats;

    $('#tr-val').textContent = '0';
    await loadAbc();
    $('#edit-title').value = $('#detail').dataset.suggestTitle || song.title || song.song_name || '';
}

const RENDER_OPTS = { scale: 0.8, staffwidth: 700 };

// Fetch the untransposed ABC once per song. All transposition afterwards is done in the
// browser with ABCJS.strTranspose, so auditioning never round-trips and needs no music21
// (the server only needs it absent now - the final transposed ABC text is sent on promote).
async function loadAbc() {
    stopAudio();
    const id = state.current.pdmx_id;
    $('#notation-inner').innerHTML = '<p style="color:#888;padding:20px">Converting...</p>';
    const data = await api(`/api/song/${id}/abc`);
    if (data.error) {
        $('#notation-inner').innerHTML = `<p style="color:#c00;padding:20px">Conversion failed: ${data.error}</p>`;
        state.baseAbc = state.abc = '';
        state.baseVisual = null;
        renderBadges(null);
        return;
    }
    state.baseAbc = data.abc;
    state.baseVisual = null;   // cached on first (untransposed) render below
    $('#detail').dataset.suggestTitle = data.title || '';
    renderNotation();
}

function renderNotation() {
    if (!state.baseAbc) return;
    try {
        // Transpose the ABC text itself so what plays, what's shown, and what gets promoted
        // are identical. strTranspose needs the untransposed tune object, which we cache.
        state.abc = (state.transpose && state.baseVisual)
            ? ABCJS.strTranspose(state.baseAbc, state.baseVisual, state.transpose)
            : state.baseAbc;
        const visual = ABCJS.renderAbc('notation-inner', state.abc, RENDER_OPTS);
        if (!state.transpose) state.baseVisual = visual;   // cache base tune for later transposes
        setupSynth(visual[0]);
        evaluateFit(visual[0]);
    } catch (e) {
        // Some elaborate PDMX scores trip up abcjs' renderer; fail soft so triage continues.
        $('#notation-inner').innerHTML =
            `<p style="color:#c00;padding:20px">Couldn't render this score (${e}).</p>`;
        renderBadges(null);
    }
}

// ---- range / instrument fit -----------------------------------------------

const signed = (n) => (n > 0 ? '+' : '') + n;

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const midiName = (m) => NOTE_NAMES[((m % 12) + 12) % 12] + (Math.floor(m / 12) - 1);

// Diatonic scale degree (C..B) -> semitones above C.
const DEGREE_SEMITONES = [0, 2, 4, 5, 7, 9, 11];
const LETTERS = 'CDEFGAB';

// Read the explicit accidental off an abcjs pitch name ('^F', '__B', '=c'); null if none.
function nameAccidental(name) {
    const m = /^(\^+|_+|=)/.exec(name || '');
    if (!m) return null;
    const a = m[1];
    return a === '=' ? 0 : (a[0] === '^' ? a.length : -a.length);
}

/**
 * Walk an abcjs tuneObject and return the {lo, hi, count} of sounding MIDI pitches.
 *
 * abcjs only attaches true MIDI (midiPitches) after the synth runs, so we compute pitch
 * ourselves from the rendered notes: pitch.pitch is the clef-resolved diatonic staff
 * position (middle C = 0), and we layer on accidentals the way the staff sounds them -
 * an explicit accidental wins, else a same-bar accidental on that line, else the key
 * signature. This matches abcjs' own MIDI on ordinary tunes; it can only drift on exotic
 * scores using 8va/8vb octave spanners (which shift playback but not the written position),
 * and those are far out of any flute's range anyway, so the fit verdict is unaffected.
 */
function extractMidiRange(tune) {
    let lo = Infinity, hi = -Infinity, count = 0;
    const keyMap = {};   // letter -> semitone offset from the key signature
    for (const line of (tune && tune.lines) || []) {
        for (const staff of line.staff || []) {
            if (staff.key && staff.key.accidentals) {
                for (const k in keyMap) delete keyMap[k];
                staff.key.accidentals.forEach(a =>
                    keyMap[a.note.toUpperCase()] = a.acc === 'sharp' ? 1 : a.acc === 'flat' ? -1 : 0);
            }
            for (const voice of staff.voices || []) {
                const barAcc = {};   // verticalPos -> accidental, reset each measure
                for (const el of voice) {
                    if (el.el_type === 'bar') { for (const k in barAcc) delete barAcc[k]; continue; }
                    if (el.el_type !== 'note' || el.rest || !el.pitches) continue;
                    for (const p of el.pitches) {
                        const vp = p.pitch;
                        const oct = Math.floor(vp / 7), deg = ((vp % 7) + 7) % 7;
                        const explicit = nameAccidental(p.name);
                        if (explicit !== null) barAcc[vp] = explicit;
                        const acc = explicit !== null ? explicit
                            : (vp in barAcc ? barAcc[vp] : (keyMap[LETTERS[deg]] || 0));
                        const midi = 60 + oct * 12 + DEGREE_SEMITONES[deg] + acc;
                        lo = Math.min(lo, midi);
                        hi = Math.max(hi, midi);
                        count++;
                    }
                }
            }
        }
    }
    return count ? { lo, hi, count } : null;
}

/**
 * Find the transposition (in semitones) that moves [lo, hi] inside [range.lo, range.hi].
 * Prefers no shift, then octave shifts (which keep the key), then the smallest shift.
 * Returns { fits, shift, over }: shift is null and over>0 when the tune's span is simply
 * wider than the instrument can play.
 */
function bestFitShift(lo, hi, range) {
    const span = hi - lo, rangeSpan = range.hi - range.lo;
    if (span > rangeSpan) return { fits: false, shift: null, over: span - rangeSpan };
    const sMin = range.lo - lo, sMax = range.hi - hi;  // valid shifts: sMin..sMax
    let best = null;
    for (let s = sMin; s <= sMax; s++) {
        // Lower score wins: prefer no shift, then octave shifts (key preserved), then smallest.
        const score = (s === 0 ? 0 : 1e6) + (Math.abs(s) % 12 === 0 ? 0 : 1e3) + Math.abs(s);
        if (!best || score < best.score) best = { s, score };
    }
    return { fits: true, shift: best.s };
}

// Chord symbols in ABC look like "Am" "C7" "F/A" immediately before notes.
function detectChords(abc) {
    return /"[A-Ga-g#b][^"\n]*"/.test(abc);
}

async function postMetadata(fitInstrument, hasChords) {
    if (!state.current || state.metadataPosted) return;
    state.metadataPosted = true;
    const id = state.current.pdmx_id;
    await api(`/api/song/${id}/metadata`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instrument_fit: fitInstrument, has_chords: hasChords }),
    });
    // Update song object and list item so the badge shows immediately
    state.current.instrument_fit = fitInstrument;
    state.current.has_chords = hasChords ? 1 : 0;
    updateListItemBadge(state.current);
}

/**
 * Compute the range from a freshly rendered tune; on the first render for a song,
 * auto-apply the transposition that best fits the recorder (which also fits the dizi,
 * since the recorder range sits inside it), falling back to the dizi if the recorder
 * can't fit. Then draw the per-instrument fit badges.
 */
function evaluateFit(tune) {
    const range = extractMidiRange(tune);
    if (!range) { renderBadges(null); return; }

    if (!state.autoFitDone) {
        state.autoFitDone = true;
        const rec = bestFitShift(range.lo, range.hi, RANGES.recorder);
        const fit = rec.fits ? rec : bestFitShift(range.lo, range.hi, RANGES.dizi);
        if (fit.fits && fit.shift !== 0) {
            state.transpose = fit.shift;
            $('#tr-val').textContent = signed(fit.shift);
            renderNotation();   // re-render transposed; autoFitDone is set, so no loop
            return;             // badges will be drawn by that render
        }
    }
    renderBadges(range);
    // After auto-fit settles, record fit + chord info once per song - but only if
    // scan_fit.py hasn't already classified it (that pass reads <harmony> directly
    // and is more accurate than the in-browser regex, so don't overwrite it).
    if (!state.metadataPosted && state.current && state.current.instrument_fit == null) {
        const rec = bestFitShift(range.lo, range.hi, RANGES.recorder);
        const dizi = bestFitShift(range.lo, range.hi, RANGES.dizi);
        const fitInstrument = rec.fits ? 'recorder' : dizi.fits ? 'dizi' : 'none';
        const hasChords = detectChords(state.abc);
        postMetadata(fitInstrument, hasChords);
    }
}

/** Draw a fit badge per instrument for the currently shown (already-transposed) range. */
function renderBadges(range) {
    const box = $('#fit-badges');
    if (!range) { box.innerHTML = ''; return; }
    const head = `<span class="range-label">${midiName(range.lo)}–${midiName(range.hi)} · ${range.count} notes</span>`;
    const fitBadges = Object.values(RANGES).map(r => {
        const below = Math.max(0, r.lo - range.lo), above = Math.max(0, range.hi - r.hi);
        if (!below && !above) return `<span class="fit ok">${r.label} ✓</span>`;
        const fit = bestFitShift(range.lo, range.hi, r);
        if (fit.fits) {
            const total = state.transpose + fit.shift;
            return `<span class="fit warn">${r.label} ✗ · fits at ${signed(total)}</span>`;
        }
        return `<span class="fit bad">${r.label} ✗ · ${fit.over} st too wide</span>`;
    }).join('');
    const chordBadge = detectChords(state.abc)
        ? `<span class="fit ok chords-badge">♩ chords</span>`
        : `<span class="fit bad chords-badge">no chords</span>`;
    box.innerHTML = head + fitBadges + chordBadge;
}

async function setupSynth(visualObj) {
    if (!ABCJS.synth.supportsAudio()) {
        $('#audio').textContent = 'Audio not supported in this browser.';
        return;
    }
    // Recreate the controller for every tune (reusing one + setTune leaves the old
    // audio buffer loaded). Share a single AudioContext to avoid exhausting the limit.
    if (synth) { try { synth.pause(); } catch (e) { /* ignore */ } }
    $('#audio').innerHTML = '';
    synth = new ABCJS.synth.SynthController();
    synth.load('#audio', null, { displayPlay: true, displayProgress: true });
    try {
        await synth.setTune(visualObj, false, { audioContext: getAudioContext(), chordsOff: false });
    } catch (e) {
        $('#audio').textContent = 'Playback unavailable: ' + e;
    }
}

// ---- transpose ------------------------------------------------------------

function bumpTranspose(delta) {
    state.transpose = Math.max(-24, Math.min(24, state.transpose + delta));
    $('#tr-val').textContent = signed(state.transpose);
    renderNotation();   // client-side transpose, no refetch
}

// ---- actions --------------------------------------------------------------

async function setStatus(status) {
    if (!state.current) return;
    stopAudio();
    await api(`/api/song/${state.current.pdmx_id}/status`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status }) });
    afterAction(`Marked ${status}.`);
}

async function promote() {
    if (!state.current) return;
    stopAudio();
    const category = $('#edit-category').value.trim();
    if (!category) { showStatus('Pick a category first.', true); return; }
    const body = {
        category,
        title: $('#edit-title').value.trim(),
        transpose: state.transpose,
        abc: state.abc,   // already transposed client-side; server writes it as-is
    };
    const res = await api(`/api/song/${state.current.pdmx_id}/promote`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body) });
    if (res.error) { showStatus('Promote failed: ' + res.error, true); return; }
    refreshCategories();
    afterAction(`Promoted → abc/${res.abc_path}`);
}

function afterAction(msg) {
    showStatus(msg);
    const idx = state.songs.findIndex(s => s.pdmx_id === state.current.pdmx_id);
    const next = state.songs[idx + 1];
    refreshStats();
    loadSongs().then(() => {
        // advance to the next song that's still in the (refreshed) list
        if (next) {
            const stillThere = state.songs.find(s => s.pdmx_id === next.pdmx_id);
            if (stillThere) { selectSong(stillThere); return; }
        }
        if (state.songs.length) selectSong(state.songs[0]);
        else { $('#detail').hidden = true; $('#detail-empty').hidden = false; }
    });
}

function showStatus(msg, isError) {
    const el = $('#action-status');
    el.textContent = msg;
    el.className = 'action-status' + (isError ? ' error' : '');
}

async function refreshCategories() {
    const cats = await api('/api/categories');
    state.categories = cats;
    $('#category-list').innerHTML = cats.map(c => `<option value="${c}">`).join('');
    updateCategoryHint();
}

// Tell the user whether the typed category already exists or will be created.
function updateCategoryHint() {
    const el = $('#cat-hint');
    if (!el) return;
    const val = $('#edit-category').value.trim();
    if (!val) { el.textContent = ''; el.className = 'cat-hint'; return; }
    if (state.categories.includes(val)) {
        el.textContent = '✓ existing category';
        el.className = 'cat-hint existing';
    } else {
        el.textContent = `+ will create new category “${val}”`;
        el.className = 'cat-hint new';
    }
}

// ---- init -----------------------------------------------------------------

function buildTabs() {
    $('#tabs').innerHTML = STATUSES.map(s =>
        `<button data-status="${s}">${s}</button>`).join('');
    document.querySelectorAll('#tabs button').forEach(btn => {
        btn.addEventListener('click', () => {
            state.status = btn.dataset.status;
            refreshStats();
            loadSongs();
        });
    });
}

function init() {
    buildTabs();
    $('#search').addEventListener('input', debounce(e => {
        state.q = e.target.value; loadSongs();
    }, 250));
    $('#sort').addEventListener('change', e => { state.sort = e.target.value; loadSongs(); });
    $('#tr-down').addEventListener('click', () => bumpTranspose(-1));
    $('#tr-up').addEventListener('click', () => bumpTranspose(1));
    $('#btn-discard').addEventListener('click', () => setStatus('discarded'));
    $('#btn-keep').addEventListener('click', () => setStatus('kept'));
    $('#btn-promote').addEventListener('click', promote);

    $('#filter-playable').addEventListener('change', e => {
        state.filterPlayable = e.target.checked; refreshStats(); loadSongs();
    });
    $('#filter-chords').addEventListener('change', e => {
        state.filterChords = e.target.checked; refreshStats(); loadSongs();
    });
    $('#edit-category').addEventListener('input', updateCategoryHint);

    refreshStats();
    refreshCategories();
    loadSongs();
}

function debounce(fn, ms) {
    let t;
    return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}

init();
