"""Compare the pitch sequence of a transcription with a source MIDI, rhythm ignored.

Built for jazz standards (2026-11), whose source MIDIs swing and embellish so a
note-for-note --flat diff is useless. Takes the top note at each onset, tries
every transposition from -24 to +24, aligns with difflib, and prints the match
rate plus every non-matching stretch.

usage: py pitch_compare.py mine.mid source.mid SOURCE_CHANNEL [--mch MINE_CHANNEL] [--start ONSET]
       (mine.mid from abc_to_midi.mjs; a two-voice trillian file has its melody on channel 1)
"""
import sys,subprocess,re,difflib
import os
S=os.path.join(os.path.dirname(os.path.abspath(__file__)),'midi_notes.py')
NAMES='C C# D D# E F F# G G# A A# B'.split()
def num(n):
    m=re.match(r'([A-G]#?)(-?\d+)',n); return NAMES.index(m.group(1))+12*(int(m.group(2))+1)
def name(p): return NAMES[p%12]+str(p//12-1)
def load(f,ch,start=0,top=True):
    out=subprocess.run(['py',S,f,'--channel',str(ch),'--flat'],capture_output=True,text=True).stdout
    ev={}
    for l in out.split():
        m=re.match(r'([A-G]#?-?\d+)@([\d.]+)/([\d.]+)',l)
        if not m: continue
        on=float(m.group(2)); d=float(m.group(3))
        if on<start or d==0: continue
        p=num(m.group(1))
        ev[on]=max(ev.get(on,-1),p) if top else p
    ks=sorted(ev); seq=[ev[k] for k in ks]
    # merge repeated identical pitches? keep
    return seq,ks
a=sys.argv; mine,_=load(a[1],int(a[a.index('--mch')+1]) if '--mch' in a else 0); start=float(a[a.index('--start')+1]) if '--start' in a else 0
src,on=load(a[2],int(a[3]),start)
best=None
for t in range(-24,25):
    s=[p+t for p in src[:int(len(mine)*1.6)+10]]
    r=difflib.SequenceMatcher(None,mine,s,autojunk=False)
    m=sum(b.size for b in r.get_matching_blocks())
    if not best or m>best[0]: best=(m,t,r,s)
m,t,r,s=best
print(f'mine {len(mine)} notes, matched {m} ({m/len(mine):.0%}) at src transpose {t}')
for op,i1,i2,j1,j2 in r.get_opcodes():
    if op!='equal':
        print(f'{op:8} mine[{i1}:{i2}] {" ".join(map(name,mine[i1:i2]))}  | src@{on[j1] if j1<len(on) else "end"} {" ".join(map(name,s[j1:j2]))}')
