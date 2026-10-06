# First-pass ABC from one MIDI channel. usage: midi_to_abc_draft.py file.mid CHANNEL KEY [BARLEN_BEATS=4] [SHIFT_BEATS=0]
# Drops octave doubles (keeps the lower note), prints one ABC line in L:1/8 with bars cut at BARLEN. Gaps print as z.
# Use SHIFT=-1 for fsout arrangements that carry a one-beat lead-in. Ties across barlines and tuplets are NOT handled; check by diff against the MIDI.
import sys,re,subprocess
# usage: m2abc.py file.mid channel key [barlen=4] [shift=0]
f,ch,key=sys.argv[1],sys.argv[2],sys.argv[3]
barlen=float(sys.argv[4]) if len(sys.argv)>4 else 4
shift=float(sys.argv[5]) if len(sys.argv)>5 else 0
import os
S=os.path.join(os.path.dirname(os.path.abspath(__file__)),'midi_notes.py')
out=subprocess.run(['py',S,f,'--channel',ch],capture_output=True,text=True).stdout
sharps={'C':[],'G':['F'],'D':['F','C'],'A':['F','C','G'],'E':['F','C','G','D'],'F':[],'Bb':[],'Eb':[],'Am':[],'Dm':[],'Gm':[],'Em':['F'],'Bm':['F','C']}
flats={'F':['B'],'Bb':['B','E'],'Eb':['B','E','A'],'Dm':['B'],'Gm':['B','E'],'Cm':['B','E','A']}
sig={}
for l in sharps.get(key,[]): sig[l]='#'
for l in flats.get(key,[]): sig[l]='b'
notes=[]
for line in out.splitlines():
    m=re.match(r'bar@([\d.]+)\s+(.*)',line)
    if not m: continue
    b=float(m.group(1))
    for t in m.group(2).split():
        n=re.match(r'([A-G][#b]?)(\d)@([\d.]+)/([\d.]+)',t)
        nm=n.group(1)
        if key in flats:
            mp={'A#':'Bb','D#':'Eb','G#':'Ab','C#':'Db','F#':'Gb'}
            if nm in mp and mp[nm][0] in flats[key]: nm=mp[nm]
        notes.append((b+float(n.group(3))+shift,float(n.group(4)),nm,int(n.group(2))))
notes.sort()
dd=[]
for x in notes:
    if dd and abs(dd[-1][0]-x[0])<1e-6: continue
    dd.append(x)
notes=dd
def dur(x):
    e=x*2
    if abs(e-round(e))<1e-6:
        e=int(round(e)); return '' if e==1 else str(e)
    fr={0.5:'/',1.5:'3/2',0.25:'/4',0.75:'3/4',2.5:'5/2',3.5:'7/2'}
    return fr.get(round(e,3),'<%s>'%e)
def pitch(n,o):
    L=n[0]; acc=n[1:] 
    base={'':'' ,'#':'^','b':'_'}[acc]
    s=sig.get(L,'')
    if acc=='' and s: base='='
    elif (acc=='#' and s=='#') or (acc=='b' and s=='b'): base=''
    r=base+(L if o<5 else L.lower())
    if o>5: r+="'"*(o-5)
    if o<4: r+=","*(4-o)
    return r
tok=[];t=notes[0][0]
q=lambda x:round(x*4)/4
for on,d,n,o in notes:
    if q(on)>q(t)+1e-6: tok.append((t,on-t,'z'))
    tok.append((on,d,pitch(n,o)));t=on+d
# emit with barlines
res=[];pos=notes[0][0];out=[]
bar0=int(notes[0][0]//barlen)*barlen
for on,d,p in tok:
    # split bar crossing not handled
    nb=int((on+1e-6)//barlen)
    out.append((nb,on,d,p))
cur=None;line=''
for nb,on,d,p in out:
    if cur is not None and nb!=cur: line+='| '
    cur=nb
    line+=p+dur(d)+' '
print(line)
