'use strict';

const STATUSES = ['new', 'kept', 'discarded', 'promoted', 'all'];
const state = {
    status: 'new',
    q: '',
    sort: 'rating',
    songs: [],
    current: null,   // current song object
    abc: '',
    transpose: 0,
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
    const counts = await api('/api/stats');
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
    const data = await api('/api/songs?' + params);
    state.songs = data.songs;
    renderList(data.total);
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
            `<div class="s-badges">★ ${fmt(song.rating)} · ${song.bars ?? '?'} bars · ${song.n_notes ?? '?'} notes</div>`;
        li.querySelector('.s-title').textContent = song.title || song.song_name || song.pdmx_id;
        li.querySelector('.s-sub').textContent = sub;
        li.addEventListener('click', () => selectSong(song));
        if (state.current && state.current.pdmx_id === song.pdmx_id) li.classList.add('selected');
        ul.appendChild(li);
    });
    $('#list-footer').textContent =
        `${state.songs.length} shown${total > state.songs.length ? ` of ${total}` : ''}`;
}

const fmt = (v) => (v == null ? '–' : (+v).toFixed(2));

// ---- detail / audition ----------------------------------------------------

async function selectSong(song) {
    stopAudio();
    state.current = song;
    state.transpose = 0;
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

async function loadAbc() {
    stopAudio();
    const id = state.current.pdmx_id;
    $('#notation-inner').innerHTML = '<p style="color:#888;padding:20px">Converting...</p>';
    const data = await api(`/api/song/${id}/abc?transpose=${state.transpose}`);
    if (data.error) {
        $('#notation-inner').innerHTML = `<p style="color:#c00;padding:20px">Conversion failed: ${data.error}</p>`;
        state.abc = '';
        return;
    }
    state.abc = data.abc;
    $('#detail').dataset.suggestTitle = data.title || '';
    renderNotation();
}

function renderNotation() {
    const visual = ABCJS.renderAbc('notation-inner', state.abc, { scale: 0.8, staffwidth: 700 });
    setupSynth(visual[0]);
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
    state.transpose = Math.max(-12, Math.min(12, state.transpose + delta));
    $('#tr-val').textContent = (state.transpose > 0 ? '+' : '') + state.transpose;
    loadAbc();
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
    $('#category-list').innerHTML = cats.map(c => `<option value="${c}">`).join('');
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

    refreshStats();
    refreshCategories();
    loadSongs();
}

function debounce(fn, ms) {
    let t;
    return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}

init();
