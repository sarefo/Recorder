"""m2a.py: one MIDI melody track -> ABC body. Library used by film.py.
Grid is sixteenths. Key found by Krumhansl profile, transposed to fit C4-A5 with few accidentals.
Chords fitted per half bar from all other pitched tracks."""
import struct,re
LEAD=0
def vlq(b,i):
    v=0
    while True:
        c=b[i];i+=1;v=(v<<7)|(c&127)
        if not c&128:return v,i
def parse(path):
    b=open(path,'rb').read()
    fmt,nt,div=struct.unpack('>HHH',b[8:14])
    i=14;notes={};ts=[];tempo=None
    for t in range(nt):
        if b[i:i+4]!=b'MTrk':break
        L=struct.unpack('>I',b[i+4:i+8])[0];j=i+8;e=j+L;i=e;tick=0;rs=0;on={}
        while j<e:
            d,j=vlq(b,j);tick+=d;s=b[j]
            if s<0x80:s=rs
            else:j+=1
            if s==0xFF:
                ty=b[j];j+=1;l,j=vlq(b,j)
                if ty==0x58:ts.append((tick,b[j],2**b[j+1]))
                if ty==0x51 and not tempo:tempo=60000000//int.from_bytes(b[j:j+3],'big')
                j+=l
            elif s in(0xF0,0xF7):
                l,j=vlq(b,j);j+=l
            else:
                rs=s;c=s&15;k=s>>4
                if k in(0xC,0xD):j+=1
                else:
                    a,v=b[j],b[j+1];j+=2
                    if k==9 and v>0:on[(c,a)]=tick
                    elif k in(8,9) and (c,a) in on:
                        notes.setdefault((t,c),[]).append((on.pop((c,a)),tick,a))
    if LEAD:
        notes={k:[(max(0,x-LEAD),max(1,y-LEAD),p) for x,y,p in v] for k,v in notes.items()}
    return div,ts,tempo,notes
MAJ=[6.35,2.23,3.48,2.33,4.38,4.09,2.52,5.19,2.39,3.66,2.29,2.88]
MIN=[6.33,2.68,3.52,5.38,2.60,3.53,2.54,4.75,3.98,2.69,3.34,3.17]
NAMES=['C','Db','D','Eb','E','F','F#','G','Ab','A','Bb','B']
SIG={'C':0,'G':1,'D':2,'A':3,'E':4,'B':5,'F#':6,'F':-1,'Bb':-2,'Eb':-3,'Ab':-4,'Db':-5}
ORDER_S='FCGDAEB';ORDER_F='BEADGCF'
def corr(h,p):
    n=12;mh=sum(h)/n;mp=sum(p)/n
    num=sum((h[i]-mh)*(p[i]-mp) for i in range(n))
    d=(sum((x-mh)**2 for x in h)*sum((x-mp)**2 for x in p))**.5
    return num/d if d else 0
def findkey(ns):
    h=[0]*12
    for s,e,p in ns:h[p%12]+=e-s
    best=max(((corr(h[r:]+h[:r],pr),r,m) for r in range(12) for m,pr in (('',MAJ),('m',MIN))))
    return best[1],best[2]
def relmaj(r,m): return r if m=='' else (r+3)%12
def keyname(r,m):
    mj=NAMES[relmaj(r,m)]
    return mj
LET=[('C',0),('D',2),('E',4),('F',5),('G',7),('A',9),('B',11)]
def scale(majpc):
    """map letter->accidental for major key with tonic pc"""
    nm=NAMES[majpc];f=SIG.get(nm,0);acc={l:0 for l,_ in LET}
    if f>0:
        for l in ORDER_S[:f]:acc[l]=1
    else:
        for l in ORDER_F[:-f]:acc[l]=-1
    return acc,f
def spell(p,acc,f):
    pc=p%12;octv=p//12-1
    for l,b in LET:
        if (b+acc[l])%12==pc:
            o=octv
            if b+acc[l]<0:o+=1
            if b+acc[l]>11:o-=1
            return l,acc[l],o
    for l,b in LET:
        if b==pc:return l,0,octv
    for l,b in LET:
        t=1 if f>=0 else -1
        if (b+t)%12==pc:return l,t,octv
    for l,b in LET:
        t=-1 if f>=0 else 1
        if (b+t)%12==pc:return l,t,octv
    raise ValueError(p)
def abcpitch(l,o):
    if o>=5:return l.lower()+"'"*(o-5)
    return l+','*(4-o)
def lenstr(n):
    if n==2:return ''
    if n==1:return '/'
    if n%2==0:return str(n//2)
    return f'{n}/2'
def dec(n):
    out=[]
    for v in (16,12,8,6,4,3,2,1):
        while n>=v:out.append(v);n-=v
    return out
CH=[('',(0,4,7)),('m',(0,3,7))]
CN=['C','C#','D','Eb','E','F','F#','G','Ab','A','Bb','B']
def fit(ps,mel):
    if not ps:return None
    best=None
    for r in range(12):
        for q,iv in CH:
            s=sum(ps.get((r+i)%12,0)*(1.4 if i==0 else 1) for i in iv)-.6*sum(v for p,v in ps.items() if (p-r)%12 not in iv)
            if best is None or s>best[0]:best=(s,CN[r]+q)
    return best[1]
def build(path,tr,ch,start,nbars,shift=None,grid=None,key=None):
    div,ts,tempo,notes=parse(path)
    num,den=(ts[0][1],ts[0][2]) if ts else (4,4)
    g=div//4 if not grid else grid
    ns=sorted(notes[(tr,ch)])
    # monophonic: at equal onset keep highest; clip overlaps
    q={}
    for s,e,p in ns:
        k=round(s/g)
        if k not in q or p>q[k][1]:q[k]=(max(1,round(e/g)),p)
    ks=sorted(q)
    mel=[]
    for i,k in enumerate(ks):
        e,p=q[k]
        if i+1<len(ks):
            e=min(e,ks[i+1])
            if ks[i+1]-e<=1:e=ks[i+1]
        mel.append((k,max(e,k+1),p))
    err=sum(abs(s/g-round(s/g)) for s,_,_ in ns)/max(len(ns),1)
    bar=num*16//den
    r,m=findkey([(s,e,p) for s,e,p in mel])
    if key is not None:r,m=key
    b0=start*bar
    # window: first note at or after start
    win=[x for x in mel if b0<=x[0]<b0+nbars*bar]
    if not win:return None
    first=win[0][0]
    pick=(-(first-b0))%bar if first>b0 else 0
    lo=min(x[2] for x in win);hi=max(x[2] for x in win)
    if shift is None:
        cand=[]
        for s in range(-24,25):
            if lo+s<60 or hi+s>81:continue
            mj=(relmaj(r,m)+s)%12
            f=abs(SIG.get(NAMES[mj],9))
            if f>2:continue
            cand.append((f>1,lo+s,f,abs(s),s))
        if not cand:return {'fail':f'range {lo}-{hi} cannot fit'}
        shift=sorted(cand)[0][4]
    tp=(relmaj(r,m)+shift)%12
    acc,f=scale(tp)
    tonic=NAMES[(r+shift)%12]
    K=tonic+m
    # chords from other tracks, in source pitch then shifted
    ev=[]
    for (t,c),n in notes.items():
        if c==9 or (t,c)==(tr,ch):continue
        for s,e,p in n:ev.append((s/g,e/g,p))
    half=bar//2 if num%2==0 or bar%2==0 else bar
    if num in(3,6,9,12) and den in(4,8) and num==3: half=bar
    def chord(a):
        ps={}
        for s,e,p in ev:
            o=min(e,a+half)-max(s,a)
            if o>0:ps[(p+shift)%12]=ps.get((p+shift)%12,0)+o*(1.3 if p<60 else 1)
        return fit(ps,None)
    out=[];cur=first;last=b0+nbars*bar
    # final bar pays back pickup
    end=last-(0 if not pick else 0)
    if pick: end=last-pick
    seq=[(s,min(e,end),p) for s,e,p in win if s<end]
    bars=[]
    t=first;i=0;prevch=None
    beat=4 if den==4 else (6 if num%3==0 and num>3 else 2)
    bar_start=first-((first-b0)%bar)
    while t<end:
        be=min(bar_start+bar,end)
        toks=[];state={}
        bt=t
        while bt<be:
            cn=None
            if (bt-bar_start)%half==0 and ev:
                c=chord(bt)
                if c and c!=prevch:cn=c;prevch=c
            n=next((x for x in seq if x[0]<=bt<x[1]),None)
            if n:
                ne=min(n[1],be);l,a,o=spell(n[2]+shift,acc,f)
                pre=''
                if state.get((l,o),acc[l])!=a:
                    pre={1:'^',-1:'_',0:'='}[a];state[(l,o)]=a
                tie='-' if n[1]>be else ''
                tok=(f'"{cn}"' if cn else '')+pre+'-'.join(abcpitch(l,o)+lenstr(v) for v in dec(ne-bt))+tie
                toks.append((bt-bar_start,ne-bt,tok));bt=ne
            else:
                nxt=min([x[0] for x in seq if x[0]>bt]+[be])
                # split rest at half bar so chords can land
                st=bt
                while st<nxt:
                    hb=st+half-((st-bar_start)%half)
                    e2=min(nxt,hb)
                    c2=None
                    if (st-bar_start)%half==0 and ev:
                        c=chord(st)
                        if c and c!=prevch:c2=c;prevch=c
                    toks.append((st-bar_start,e2-st,(f'"{c2}"' if c2 else '')+' '.join('z'+lenstr(v) for v in dec(e2-st))));st=e2
                bt=nxt
        # beam: join within a beat when short
        s='';pb=None
        for pos,ln,tok in toks:
            b=pos//beat
            if s and not(pb==b and ln<4 and plen<4):s+=' '
            s+=tok;pb=b;plen=ln
        bars.append(s);t=be;bar_start+=bar
    lines=[]
    for i in range(0,len(bars),4):lines.append('|'.join(bars[i:i+4])+'|')
    body='\n'.join(lines).rstrip('|')+'|]'
    return dict(body=body,M=f'{num}/{den}',K=K,shift=shift,lo=lo+shift,hi=hi+shift,tempo=tempo,err=round(err,3),pick=pick,nb=len(bars),notes=len(seq),pitches=[p+shift for s,e,p in seq])
