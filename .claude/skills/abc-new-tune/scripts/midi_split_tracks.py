"""Give each MIDI track its own channel, so midi_notes.py can read the parts.

Score-derived MIDIs (hamienet kernscores_urtext_mei files) keep one part per track
but put every track on channel 0, which midi_notes.py sees as a single merged line.
Track t moves to channel t-1, skipping the drum channel 9. Prints channel and track
name for each track.

usage: py midi_split_tracks.py in.mid out.mid
"""
import sys,struct
src,dst=sys.argv[1:3]
b=bytearray(open(src,'rb').read())
fmt,nt,div=struct.unpack('>HHH',b[8:14])
i=14;names=[]
for t in range(nt):
    L=struct.unpack('>I',b[i+4:i+8])[0]
    st=i+8;en=st+L;j=st;rs=0
    ch=t-1 if t-1<9 else t
    ch=max(ch,0)&15
    name=''
    while j<en:
        while b[j]&0x80:j+=1
        j+=1
        s=b[j]
        if s==0xFF:
            ty=b[j+1];j+=2;l=0
            while True:
                c=b[j];j+=1;l=(l<<7)|(c&0x7f)
                if not c&0x80:break
            if ty==3:name=bytes(b[j:j+l]).decode('latin1')
            j+=l;continue
        if s in(0xF0,0xF7):
            j+=1;l=0
            while True:
                c=b[j];j+=1;l=(l<<7)|(c&0x7f)
                if not c&0x80:break
            j+=l;continue
        if s&0x80:
            b[j]=(s&0xF0)|ch;rs=b[j];j+=1
        hi=rs&0xF0
        j+=1 if hi in(0xC0,0xD0) else 2
    names.append((ch,name))
    i=en
open(dst,'wb').write(b)
print(dst,names)
