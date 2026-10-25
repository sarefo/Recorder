/**
 * PracticeDashboard - Shows how practice is going: what is due, how the
 * repertoire is spread over the practice statuses, how it grew over time,
 * and which days were practiced.
 *
 * analyze() turns the user data into plain numbers; the render methods only
 * draw them, as inline SVG so the app stays free of chart libraries.
 */
class PracticeDashboard {
    static STATUSES = ['needs-practice', 'practicing', 'good', 'mastered'];
    static STATUS_LABELS = {
        'needs-practice': 'Needs practice',
        'practicing': 'Practicing',
        'good': 'Good',
        'mastered': 'Mastered'
    };
    /** Days after which a song of that status is due again */
    static REVIEW_DAYS = { 'needs-practice': 1, 'practicing': 2, 'good': 5, 'mastered': 21 };
    static STALE_DAYS = 45;
    static CALENDAR_WEEKS = 26;
    static QUEUE_SIZE = 6;
    /** A trouble spot needs this many red marks, in this many tunes, to be reported */
    static STRUGGLE_MIN_MARKS = 3;
    static STRUGGLE_MIN_TUNES = 2;
    /** Days after which a red mark counts half as much */
    static STRUGGLE_HALF_LIFE_DAYS = 60;
    /** Clean runs in a row it takes to own a tempo */
    static CLEAN_STREAK = 3;
    /** Step to the next tempo to try, the same as the tempo control's snap */
    static SPEED_STEP = 10;
    static DAY_MS = 24 * 60 * 60 * 1000;

    /**
     * @param {UserDataManager} userDataManager - Source of the practice data
     * @param {FileManager} fileManager - Provides the tune list and loads tunes
     */
    constructor(userDataManager, fileManager) {
        this.userDataManager = userDataManager;
        this.fileManager = fileManager;
    }

    /**
     * Turns the user data into the numbers the dashboard shows
     * @param {Object} data - User data (UserDataManager.data)
     * @param {Array<{name: string, file: string, category: string}>} files - The tune list
     * @param {Date} now - The current time
     * @returns {Object} Counts, series and lists, see the keys below
     */
    static analyze(data, files, now = new Date()) {
        const DAY = PracticeDashboard.DAY_MS;
        const songs = data.songs || {};
        const activity = data.activity || {};
        const statusLog = data.statusLog || [];
        const known = new Map(files.map(file => [file.file, file]));
        const nameOf = path => known.get(path)?.name || path.split('/').pop().replace(/\.abc$/, '');
        const daysSince = iso => (iso ? (now - new Date(iso)) / DAY : Infinity);

        // Status of every tune in the library; a tune with no entry is untouched
        const statusOf = path => songs[path]?.status || null;
        // Favorites are the tunes being worked on; they are counted apart from the rest
        const emptyCounts = () => ({ 'needs-practice': 0, practicing: 0, good: 0, mastered: 0, untouched: 0 });
        const counts = emptyCounts();
        const favoriteCounts = emptyCounts();
        const otherCounts = emptyCounts();
        files.forEach(file => {
            const status = statusOf(file.file) || 'untouched';
            counts[status]++;
            (songs[file.file]?.favorite === true ? favoriteCounts : otherCounts)[status]++;
        });

        // --- Practice calendar and streaks ---
        const dayKey = UserDataManager.dayKey;
        const playsOn = key => Object.values(activity[key] || {}).reduce((sum, n) => sum + n, 0);
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const dayAt = offset => new Date(today.getFullYear(), today.getMonth(), today.getDate() + offset);

        // Weeks run Monday to Sunday; the last column is the current week
        const mondayOffset = -((today.getDay() + 6) % 7);
        const weeks = [];
        for (let w = PracticeDashboard.CALENDAR_WEEKS - 1; w >= 0; w--) {
            const week = [];
            for (let d = 0; d < 7; d++) {
                const date = dayAt(mondayOffset - w * 7 + d);
                const key = dayKey(date);
                week.push({ key, date, plays: playsOn(key), future: date > today });
            }
            weeks.push(week);
        }

        const practicedDays = Object.keys(activity).filter(key => playsOn(key) > 0).sort();
        const practicedSet = new Set(practicedDays);
        let streak = 0;
        // Not having played yet today does not break a running streak
        let cursor = practicedSet.has(dayKey(today)) ? 0 : -1;
        while (practicedSet.has(dayKey(dayAt(cursor)))) {
            streak++;
            cursor--;
        }
        let bestStreak = 0;
        let run = 0;
        let previous = null;
        for (const key of practicedDays) {
            const date = new Date(key + 'T00:00:00');
            run = previous && Math.round((date - previous) / DAY) === 1 ? run + 1 : 1;
            bestStreak = Math.max(bestStreak, run);
            previous = date;
        }

        const lastWeekKeys = Array.from({ length: 7 }, (_, i) => dayKey(dayAt(-i)));
        const songsThisWeek = new Set();
        let playsThisWeek = 0;
        lastWeekKeys.forEach(key => {
            Object.entries(activity[key] || {}).forEach(([path, n]) => {
                songsThisWeek.add(path);
                playsThisWeek += n;
            });
        });

        // --- Status history: one point per week ---
        // Entries come from the log; a tune that has a status but no log
        // entry (set before the log existed) is dated by its last change
        const events = new Map();
        statusLog.forEach(entry => {
            if (!events.has(entry.path)) events.set(entry.path, []);
            events.get(entry.path).push({ at: Date.parse(entry.at), status: entry.status });
        });
        let estimated = 0;
        Object.entries(songs).forEach(([path, song]) => {
            if (song.status && !events.has(path)) {
                const at = Date.parse(song.updatedAt || song.lastPlayed || song.createdAt);
                if (at) {
                    events.set(path, [{ at, status: song.status }]);
                    estimated++;
                }
            }
        });
        events.forEach(list => list.sort((a, b) => a.at - b.at));
        const statusAt = (path, time) => {
            let status = null;
            for (const event of events.get(path) || []) {
                if (event.at > time) break;
                status = event.status;
            }
            return status;
        };
        const history = [];
        for (let w = PracticeDashboard.CALENDAR_WEEKS - 1; w >= 0; w--) {
            const end = dayAt(-w * 7 + 1).getTime();
            let solid = 0;
            let mastered = 0;
            events.forEach((list, path) => {
                if (!known.has(path)) return;
                const status = statusAt(path, end);
                if (status === 'mastered') { mastered++; solid++; }
                else if (status === 'good') solid++;
            });
            history.push({ end: new Date(end - DAY), solid, mastered });
        }

        // --- What to practice next ---
        // A song is due once it has gone unplayed for REVIEW_DAYS of its
        // status; the more overdue, the earlier it comes. Never-played tunes
        // that carry a status count as long overdue. Only favorites are
        // considered: the rest of the library is not being practiced.
        const due = [];
        Object.entries(songs).forEach(([path, song]) => {
            if (!song.favorite || !song.status || !known.has(path)) return;
            const gap = PracticeDashboard.REVIEW_DAYS[song.status];
            const overdue = daysSince(song.lastPlayed) / gap;
            if (overdue >= 1) due.push({ path, name: nameOf(path), status: song.status, overdue, days: daysSince(song.lastPlayed) });
        });
        due.sort((a, b) => b.overdue - a.overdue || a.name.localeCompare(b.name));
        // Mastered tunes only need a taste of review, so they never fill the list
        const queue = [];
        let masteredInQueue = 0;
        for (const item of due) {
            if (queue.length >= PracticeDashboard.QUEUE_SIZE) break;
            if (item.status === 'mastered' && masteredInQueue >= 1) continue;
            if (item.status === 'mastered') masteredInQueue++;
            queue.push(item);
        }

        // --- Lists ---
        const stale = Object.entries(songs)
            .filter(([path, song]) => known.has(path) && (song.status === 'good' || song.status === 'mastered')
                && daysSince(song.lastPlayed) >= PracticeDashboard.STALE_DAYS)
            .map(([path, song]) => ({ path, name: nameOf(path), status: song.status, days: daysSince(song.lastPlayed) }))
            .sort((a, b) => b.days - a.days)
            .slice(0, 5);

        const totals = {};
        Object.entries(activity).forEach(([, day]) => {
            Object.entries(day).forEach(([path, n]) => { totals[path] = (totals[path] || 0) + n; });
        });
        const mostPracticed = Object.entries(totals)
            .filter(([path]) => known.has(path))
            .map(([path, plays]) => ({ path, name: nameOf(path), plays }))
            .sort((a, b) => b.plays - a.plays || a.name.localeCompare(b.name))
            .slice(0, 5);

        const rank = { 'needs-practice': 0, practicing: 1, good: 2, mastered: 3 };
        const lastStatus = new Map();
        const achievements = [];
        [...statusLog].sort((a, b) => a.at.localeCompare(b.at)).forEach(entry => {
            const before = lastStatus.get(entry.path);
            lastStatus.set(entry.path, entry.status);
            if ((entry.status === 'good' || entry.status === 'mastered') && known.has(entry.path)
                && (before === undefined || rank[entry.status] > (rank[before] ?? -1))) {
                achievements.push({ path: entry.path, name: nameOf(entry.path), status: entry.status, at: entry.at });
            }
        });
        // Newest first, one line per tune (its latest step up)
        const seen = new Set();
        const latestAchievements = achievements.reverse().filter(item => !seen.has(item.path) && seen.add(item.path));

        // --- Speed: the fastest tempo each tune was played cleanly, several times in a row ---
        const runsBySong = new Map();
        (data.cleanRuns || []).forEach(run => {
            if (!runsBySong.has(run.path)) runsBySong.set(run.path, []);
            runsBySong.get(run.path).push(run);
        });
        const speeds = [];
        runsBySong.forEach((runs, path) => {
            if (!known.has(path)) return;
            runs.sort((a, b) => a.at.localeCompare(b.at));
            speeds.push({ path, name: nameOf(path), status: statusOf(path), favorite: songs[path]?.favorite === true,
                ...UserDataManager.cleanSpeed(runs, PracticeDashboard.CLEAN_STREAK) });
        });
        // Favorites not yet owned at full speed, slowest first
        const speedQueue = speeds
            .filter(item => item.favorite && (item.best === null || item.best < 100))
            .sort((a, b) => (a.best ?? 0) - (b.best ?? 0) || a.name.localeCompare(b.name))
            .slice(0, PracticeDashboard.QUEUE_SIZE);

        // --- By region of the world ---
        const regionStats = new Map();
        files.forEach(file => {
            const region = RegionMap.regionFor(file.category);
            if (!regionStats.has(region.id)) {
                regionStats.set(region.id, { id: region.id, label: region.label, total: 0, 'needs-practice': 0, practicing: 0, good: 0, mastered: 0 });
            }
            const stat = regionStats.get(region.id);
            stat.total++;
            const status = statusOf(file.file);
            if (status) stat[status]++;
        });
        const regions = RegionMap.REGIONS.map(r => regionStats.get(r.id)).filter(Boolean);

        return {
            total: files.length,
            counts,
            favoriteCounts,
            otherCounts,
            started: files.length - counts.untouched,
            streak,
            bestStreak,
            playsThisWeek,
            songsThisWeek: songsThisWeek.size,
            practicedToday: practicedSet.has(dayKey(today)),
            weeks,
            history,
            estimated,
            queue,
            stale,
            mostPracticed,
            achievements: latestAchievements.slice(0, 6),
            regions,
            speedQueue,
            fullSpeed: speeds.filter(item => item.best >= 100).length,
            timed: speeds.length,
            struggles: PracticeDashboard.findStruggles(data.marks || {}, known, nameOf, now)
        };
    }

    /**
     * Readable name of a note written in ABC (capitals start at C4,
     * lowercase at C5, as on a recorder part)
     * @param {string} name - Note name as the player extracts it, e.g. "^c"
     * @returns {string} For example "C♯5"
     */
    static noteLabel(name) {
        const match = /^(\^{1,2}|_{1,2}|=)?([A-Ga-g])([,']*)$/.exec(name || '');
        if (!match) return name;
        const [, accidental = '', letter, octaves] = match;
        let octave = letter === letter.toUpperCase() ? 4 : 5;
        for (const mark of octaves) octave += mark === "'" ? 1 : -1;
        const sign = { '^': '♯', '^^': '𝄪', '_': '♭', '__': '𝄫', '=': '♮' }[accidental] || '';
        return letter.toUpperCase() + sign + octave;
    }

    /**
     * Finds the notes and note changes that keep getting red marks. A spot is
     * weighed against how often it occurs in those tunes, so a note that is
     * simply everywhere does not win by volume, and older marks fade.
     * Only tunes with marks are counted for "how often", so the rate leans
     * high; the minimums keep one hard bar from standing out.
     * @param {Object} marks - User data marks (path -> note index -> mark)
     * @param {Map<string, Object>} known - The tune list by path
     * @param {function(string): string} nameOf - Display name of a tune
     * @param {Date} now - The current time
     * @returns {{markTotal: number, markedTunes: number, notes: Array, moves: Array}}
     */
    static findStruggles(marks, known, nameOf, now) {
        const patterns = new Map();
        const markedTunes = new Set();
        let markTotal = 0;

        const add = (kind, key, entry, path, weight, seen) => {
            const id = kind + '|' + key;
            if (!patterns.has(id)) {
                patterns.set(id, { kind, pitch: entry.pitch, prev: kind === 'move' ? entry.prev : null,
                    weight: 0, marks: 0, tunes: new Map() });
            }
            const pattern = patterns.get(id);
            pattern.weight += weight;
            pattern.marks += entry.count;
            // Occurrences are per tune; every mark in a tune reports the same figure
            pattern.tunes.set(path, Math.max(pattern.tunes.get(path) || 0, seen));
        };

        for (const [path, byIndex] of Object.entries(marks)) {
            if (!known.has(path)) continue;
            for (const entry of Object.values(byIndex)) {
                if (!(entry.count > 0)) continue;
                markTotal += entry.count;
                markedTunes.add(path);
                const age = (now - new Date(entry.at)) / PracticeDashboard.DAY_MS;
                const weight = entry.count * 0.5 ** (age / PracticeDashboard.STRUGGLE_HALF_LIFE_DAYS);
                add('note', entry.pitch, entry, path, weight, entry.pitchSeen || 1);
                if (entry.prev) add('move', entry.prev + '>' + entry.pitch, entry, path, weight, entry.transSeen || 1);
            }
        }

        const ranked = [...patterns.values()]
            .filter(p => p.marks >= PracticeDashboard.STRUGGLE_MIN_MARKS && p.tunes.size >= PracticeDashboard.STRUGGLE_MIN_TUNES)
            .map(p => {
                const seen = [...p.tunes.values()].reduce((sum, n) => sum + n, 0);
                const paths = [...p.tunes.keys()];
                return {
                    kind: p.kind,
                    label: p.kind === 'move'
                        ? `${PracticeDashboard.noteLabel(p.prev)} → ${PracticeDashboard.noteLabel(p.pitch)}`
                        : PracticeDashboard.noteLabel(p.pitch),
                    marks: p.marks,
                    tunes: paths.length,
                    path: paths[0],
                    tuneNames: paths.slice(0, 2).map(nameOf),
                    score: p.weight / (seen + 3)
                };
            })
            .sort((a, b) => b.score - a.score || a.label.localeCompare(b.label));

        return {
            markTotal,
            markedTunes: markedTunes.size,
            notes: ranked.filter(p => p.kind === 'note').slice(0, 3),
            moves: ranked.filter(p => p.kind === 'move').slice(0, 3)
        };
    }

    /** Opens the dashboard as a full-screen overlay */
    show() {
        const stats = PracticeDashboard.analyze(
            this.userDataManager.data, this.fileManager.fileList, new Date());

        const overlay = document.createElement('div');
        overlay.className = 'settings-menu-overlay practice-dashboard-overlay';

        const panel = document.createElement('div');
        panel.className = 'settings-menu practice-dashboard';
        panel.innerHTML = this.renderHtml(stats);

        const close = document.createElement('button');
        close.className = 'settings-menu-close';
        close.innerHTML = '×';
        close.setAttribute('aria-label', 'Close');
        panel.appendChild(close);
        overlay.appendChild(panel);

        const dismiss = () => {
            overlay.remove();
            document.removeEventListener('keydown', onKey);
        };
        const onKey = event => { if (event.key === 'Escape') dismiss(); };
        close.addEventListener('click', dismiss);
        overlay.addEventListener('click', event => { if (event.target === overlay) dismiss(); });
        document.addEventListener('keydown', onKey);

        // Tapping a tune in a list opens it
        panel.addEventListener('click', async event => {
            const row = event.target.closest('[data-path]');
            if (!row) return;
            dismiss();
            await this.fileManager.loadFile(row.dataset.path);
        });

        document.body.appendChild(overlay);
    }

    /** @private */
    static escape(text) {
        const span = document.createElement('span');
        span.textContent = text;
        return span.innerHTML;
    }

    /**
     * @param {Object} stats - Result of analyze()
     * @returns {string} The dashboard's HTML
     * @private
     */
    renderHtml(stats) {
        const kpi = (value, label, hint = '') =>
            `<div class="pd-kpi"><div class="pd-kpi-value">${value}</div>` +
            `<div class="pd-kpi-label">${label}</div>${hint ? `<div class="pd-kpi-hint">${hint}</div>` : ''}</div>`;
        const section = (title, body, note = '') =>
            `<section class="pd-card"><h4>${title}</h4>${body}${note ? `<p class="pd-note">${note}</p>` : ''}</section>`;

        const parts = [
            '<h3>Practice dashboard</h3>',
            '<div class="pd-kpis">' +
                kpi(stats.streak, 'day streak', `best ${stats.bestStreak}`) +
                kpi(stats.playsThisWeek, 'plays this week', `${stats.songsThisWeek} tunes`) +
                kpi(stats.counts.mastered, 'mastered', `of ${stats.total}`) +
                kpi(stats.started, 'tunes started', `${Math.round(100 * stats.started / Math.max(1, stats.total))}% of the library`) +
            '</div>',
            section('Practice next', this.renderQueue(stats),
                'Favorites you have not played for a while, by status: needs practice after 1 day, practicing 2, good 5, mastered 21.'),
            section('Speed up next', this.renderSpeed(stats),
                `After a run without mistakes, tap the check mark by the tune title. ${PracticeDashboard.CLEAN_STREAK} clean runs in a row ` +
                'within half an hour make a tempo yours; a slower run breaks the chain. Favorites below full speed, slowest first.' +
                (stats.timed ? ` ${stats.fullSpeed} of ${stats.timed} timed tunes are at full speed.` : '')),
            section('Where you struggle', this.renderStruggles(stats),
                'Built from notes you mark red while playing and leave marked for 10 seconds.'),
            section('Status of the library', this.renderStatusBar(stats)),
            section('Progress over time', this.renderHistory(stats),
                stats.estimated ? `${stats.estimated} tunes got their status before history was recorded; they appear at the date of their last change.` : ''),
            section('Practice calendar', this.renderCalendar(stats)),
            section('Recent achievements', this.renderAchievements(stats)),
            section('Progress by region', this.renderRegions(stats)),
            section('Slipping away', this.renderStale(stats),
                `Good or mastered tunes not played for ${PracticeDashboard.STALE_DAYS} days.`),
            section('Most practiced', this.renderMostPracticed(stats))
        ];
        return parts.join('');
    }

    /** @private */
    songRow(item, detail) {
        const color = SongMetadataUI.STATUS_COLORS[item.status] || 'var(--color-border-strong)';
        return `<li class="pd-song" data-path="${PracticeDashboard.escape(item.path)}" tabindex="0">` +
            `<span class="pd-dot" style="background:${color}"></span>` +
            `<span class="pd-song-name">${PracticeDashboard.escape(item.name)}</span>` +
            `<span class="pd-song-detail">${detail}</span></li>`;
    }

    /** @private */
    renderQueue(stats) {
        if (!stats.queue.length) {
            const favorites = Object.values(stats.favoriteCounts).reduce((a, b) => a + b, 0);
            const withStatus = favorites - stats.favoriteCounts.untouched;
            const message = withStatus
                ? 'You are caught up. Nothing is due today.'
                : favorites
                    ? 'Your favorites have no status yet. Tap the dot beside a tune title to set one (needs practice, practicing, good or mastered).'
                    : 'Only favorites appear here. Tap the dot beside a tune title to make a tune a favorite and give it a status.';
            return `<p class="pd-empty">${message}</p>`;
        }
        const ago = days => (days === Infinity ? 'never played' : days < 1.5 ? 'yesterday' : `${Math.floor(days)} days ago`);
        return '<ul class="pd-list">' +
            stats.queue.map(item => this.songRow(item, ago(item.days))).join('') + '</ul>';
    }

    /** @private */
    renderSpeed(stats) {
        if (!stats.speedQueue.length) {
            return `<p class="pd-empty">${stats.timed
                ? 'Every timed favorite is at full speed.'
                : 'No clean runs logged yet. Set the tempo where you can play a favorite without mistakes and start there.'}</p>`;
        }
        const target = PracticeDashboard.CLEAN_STREAK;
        const next = best => Math.min(100, best + PracticeDashboard.SPEED_STEP);
        return '<ul class="pd-list">' + stats.speedQueue.map(item => {
            // A chain still building above the owned tempo is the news; otherwise suggest the next step
            const building = item.lastStreak < target && item.last > (item.best ?? 0);
            const detail = building
                ? `${item.best !== null ? `${item.best}% · ` : ''}${item.last}%: ${item.lastStreak} of ${target}`
                : `${item.best}% · try ${next(item.best)}%`;
            return this.songRow(item, detail);
        }).join('') + '</ul>';
    }

    /** @private */
    renderStruggles(stats) {
        const { notes, moves, markTotal, markedTunes } = stats.struggles;
        if (!notes.length && !moves.length) {
            const sofar = markTotal ? ` So far: ${markTotal} red marks in ${markedTunes} tunes.` : '';
            return '<p class="pd-empty">Nothing stands out yet. Tap a note you stumble on until it is red and ' +
                'leave it there for 10 seconds. Once the same notes or note changes keep coming back in ' +
                `different tunes, they show up here.${sofar}</p>`;
        }
        const esc = PracticeDashboard.escape;
        const list = (title, items) => !items.length ? '' :
            `<h5 class="pd-sub">${title}</h5><ul class="pd-list">` + items.map(item =>
                `<li class="pd-song" data-path="${esc(item.path)}" tabindex="0">` +
                `<span class="pd-dot" style="background:${SongMetadataUI.STATUS_COLORS['needs-practice']}"></span>` +
                `<span class="pd-song-name">${esc(item.label)}` +
                `<span class="pd-song-detail"> in ${item.tuneNames.map(esc).join(', ')}${item.tunes > 2 ? ` and ${item.tunes - 2} more` : ''}</span></span>` +
                `<span class="pd-song-detail">${item.marks} marks</span></li>`).join('') + '</ul>';
        return list('Note changes', moves) + list('Single notes', notes);
    }

    /** @private */
    renderStatusBar(stats) {
        return this.renderStatusGroup('Favorites', stats.favoriteCounts) +
            this.renderStatusGroup('Other tunes', stats.otherCounts);
    }

    /**
     * One bar with its counts
     * @param {string} title - Name of the group of tunes
     * @param {Object} counts - Tunes per status, and 'untouched' for none
     * @returns {string}
     * @private
     */
    renderStatusGroup(title, counts) {
        const order = [...PracticeDashboard.STATUSES.slice().reverse(), 'untouched'];
        const color = key => (key === 'untouched' ? 'var(--color-surface-sunken)' : SongMetadataUI.STATUS_COLORS[key]);
        const label = key => (key === 'untouched' ? 'Not started' : PracticeDashboard.STATUS_LABELS[key]);
        const total = Object.values(counts).reduce((a, b) => a + b, 0);
        const segments = order
            .filter(key => counts[key] > 0)
            .map(key => `<div class="pd-seg" style="flex:${counts[key]};background:${color(key)}" ` +
                `title="${label(key)}: ${counts[key]}"></div>`).join('');
        const legend = order.map(key =>
            `<li><span class="pd-dot" style="background:${color(key)}"></span>${label(key)} <strong>${counts[key]}</strong></li>`).join('');
        return `<div class="pd-group"><div class="pd-group-head"><span>${title}</span><span class="pd-note">${total} tunes</span></div>` +
            `<div class="pd-bar">${segments}</div><ul class="pd-legend">${legend}</ul></div>`;
    }

    /** @private */
    renderHistory(stats) {
        const points = stats.history;
        const max = Math.max(5, ...points.map(p => p.solid));
        const W = 600, H = 150, padL = 28, padB = 18, padT = 8, padR = 6;
        const x = i => padL + (i * (W - padL - padR)) / Math.max(1, points.length - 1);
        const y = v => padT + (H - padT - padB) * (1 - v / max);
        const line = key => points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p[key]).toFixed(1)}`).join(' ');
        const area = `${line('solid')} L${x(points.length - 1)},${y(0)} L${x(0)},${y(0)} Z`;
        const gridValues = [0, Math.round(max / 2), max];
        const grid = gridValues.map(v =>
            `<line x1="${padL}" x2="${W - padR}" y1="${y(v)}" y2="${y(v)}" class="pd-grid"/>` +
            `<text x="${padL - 4}" y="${y(v) + 4}" class="pd-axis" text-anchor="end">${v}</text>`).join('');
        const fmt = d => d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
        const labels = [0, Math.floor((points.length - 1) / 2), points.length - 1].map(i =>
            `<text x="${x(i)}" y="${H - 3}" class="pd-axis" text-anchor="${i === 0 ? 'start' : i === points.length - 1 ? 'end' : 'middle'}">${fmt(points[i].end)}</text>`).join('');
        return `<svg viewBox="0 0 ${W} ${H}" class="pd-chart" role="img" aria-label="Tunes at good or better, and mastered, per week">` +
            grid + labels +
            `<path d="${area}" fill="${SongMetadataUI.STATUS_COLORS.good}" fill-opacity="0.18"/>` +
            `<path d="${line('solid')}" fill="none" stroke="${SongMetadataUI.STATUS_COLORS.good}" stroke-width="2"/>` +
            `<path d="${line('mastered')}" fill="none" stroke="${SongMetadataUI.STATUS_COLORS.mastered}" stroke-width="2"/>` +
            '</svg>' +
            `<ul class="pd-legend"><li><span class="pd-dot" style="background:${SongMetadataUI.STATUS_COLORS.good}"></span>Good or better <strong>${points[points.length - 1].solid}</strong></li>` +
            `<li><span class="pd-dot" style="background:${SongMetadataUI.STATUS_COLORS.mastered}"></span>Mastered <strong>${points[points.length - 1].mastered}</strong></li></ul>`;
    }

    /** @private */
    renderCalendar(stats) {
        const cell = 11, gap = 3, left = 22, top = 14;
        const weeks = stats.weeks;
        const peak = Math.max(1, ...weeks.flat().map(d => d.plays));
        const level = plays => (plays === 0 ? 0 : Math.min(4, Math.ceil((plays / peak) * 4)));
        const W = left + weeks.length * (cell + gap);
        const H = top + 7 * (cell + gap);
        let cells = '';
        let months = '';
        let lastMonth = -1;
        let lastLabelColumn = -9;
        weeks.forEach((week, i) => {
            const month = week[0].date.getMonth();
            // A month that starts in the last columns has no room for its name
            if (month !== lastMonth && i - lastLabelColumn >= 3) {
                lastLabelColumn = i;
                months += `<text x="${left + i * (cell + gap)}" y="9" class="pd-axis">${week[0].date.toLocaleDateString(undefined, { month: 'short' })}</text>`;
            }
            lastMonth = month;
            week.forEach((day, d) => {
                if (day.future) return;
                const lv = level(day.plays);
                cells += `<rect x="${left + i * (cell + gap)}" y="${top + d * (cell + gap)}" width="${cell}" height="${cell}" rx="2" ` +
                    `class="pd-day" fill="${lv ? 'var(--color-success)' : 'var(--color-surface-sunken)'}" ` +
                    `fill-opacity="${lv ? 0.25 + lv * 0.19 : 1}"><title>${day.key}: ${day.plays} plays</title></rect>`;
            });
        });
        const dayLabels = ['Mon', 'Wed', 'Fri'].map((name, i) =>
            `<text x="0" y="${top + i * 2 * (cell + gap) + 9}" class="pd-axis">${name}</text>`).join('');
        return `<div class="pd-scroll"><svg viewBox="0 0 ${W} ${H}" class="pd-calendar" role="img" aria-label="Plays per day, last ${weeks.length} weeks">` +
            months + dayLabels + cells + '</svg></div>';
    }

    /** @private */
    renderAchievements(stats) {
        if (!stats.achievements.length) {
            return '<p class="pd-empty">Move a tune up to good or mastered and it shows up here.</p>';
        }
        const fmt = iso => new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
        return '<ul class="pd-list">' + stats.achievements.map(item =>
            this.songRow(item, `${PracticeDashboard.STATUS_LABELS[item.status].toLowerCase()} · ${fmt(item.at)}`)).join('') + '</ul>';
    }

    /** @private */
    renderRegions(stats) {
        const color = SongMetadataUI.STATUS_COLORS;
        return '<ul class="pd-regions">' + stats.regions.map(region => {
            const pct = n => (100 * n) / region.total;
            const started = region['needs-practice'] + region.practicing + region.good + region.mastered;
            return `<li><div class="pd-region-head"><span>${PracticeDashboard.escape(region.label)}</span>` +
                `<span class="pd-note">${region.mastered + region.good} of ${region.total} good or better</span></div>` +
                '<div class="pd-bar pd-bar-thin">' +
                `<div class="pd-seg" style="width:${pct(region.mastered)}%;background:${color.mastered}"></div>` +
                `<div class="pd-seg" style="width:${pct(region.good)}%;background:${color.good}"></div>` +
                `<div class="pd-seg" style="width:${pct(region.practicing)}%;background:${color.practicing}"></div>` +
                `<div class="pd-seg" style="width:${pct(region['needs-practice'])}%;background:${color['needs-practice']}"></div>` +
                '</div></li>';
        }).join('') + '</ul>';
    }

    /** @private */
    renderStale(stats) {
        if (!stats.stale.length) return '<p class="pd-empty">Nothing is fading. Good work.</p>';
        const ago = days => (days === Infinity ? 'never played' : `${Math.floor(days)} days`);
        return '<ul class="pd-list">' + stats.stale.map(item => this.songRow(item, ago(item.days))).join('') + '</ul>';
    }

    /** @private */
    renderMostPracticed(stats) {
        if (!stats.mostPracticed.length) {
            return '<p class="pd-empty">Plays are counted from now on. Press play on a tune and it starts to add up.</p>';
        }
        return '<ul class="pd-list">' + stats.mostPracticed.map(item => {
            const status = this.userDataManager.data.songs[item.path]?.status;
            return this.songRow({ ...item, status }, `${item.plays} plays`);
        }).join('') + '</ul>';
    }
}
