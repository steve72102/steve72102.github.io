"""Original, code-drawn teaching diagrams; ring topology is explicit and auditable."""
from pathlib import Path
from html import escape
import math

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'game/assets/lessons'
OUT.mkdir(parents=True,exist_ok=True)
INK='#284d43'; BLUE='#246fbb'; GREEN='#28735b'
def text(x,y,s,size=18,fill=INK,anchor='start'):
    return f'<text x="{x}" y="{y}" font-size="{size}" fill="{fill}" text-anchor="{anchor}">{escape(s)}</text>'
def start(title,w,h):
    return [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" role="img" aria-labelledby="title"><title id="title">{escape(title)}</title><rect width="{w}" height="{h}" rx="18" fill="#fbfdf8"/><g font-family="Arial, Noto Sans TC, sans-serif">']
def finish(parts,name):
    (OUT/(name+'.svg')).write_text(''.join(parts)+ '</g></svg>\n',encoding='utf-8')
def polygon(cx,cy,r,n=6,angle=-90):
    return [(cx+r*math.cos(math.radians(angle+i*360/n)),cy+r*math.sin(math.radians(angle+i*360/n))) for i in range(n)]
def bond(p,q,cx,cy,double=False):
    a=f'<path d="M{p[0]:.2f},{p[1]:.2f} L{q[0]:.2f},{q[1]:.2f}" fill="none" stroke="{INK}" stroke-width="2.5" stroke-linecap="round"/>'
    if double:
        pp=(p[0]*.83+cx*.17,p[1]*.83+cy*.17);qq=(q[0]*.83+cx*.17,q[1]*.83+cy*.17)
        a+=bond(pp,qq,cx,cy)
    return a
def ring(cx,cy,r=43,n=6,nitrogens=(),doubles=(),angle=-90,omit=()):
    pts=polygon(cx,cy,r,n,angle);s=[]
    for i,p in enumerate(pts):
        if i not in omit:s.append(bond(p,pts[(i+1)%n],cx,cy,i in doubles))
    for i in nitrogens:
        x,y=pts[i];s.append(f'<circle cx="{x:.2f}" cy="{y:.2f}" r="12" fill="#fbfdf8"/>');s.append(text(x, y+7,'N',23,BLUE,'middle'))
    return ''.join(s)
def fused(cx,cy,two=True):
    # Vertical shared edge: benzene right edge 1->2, diazine left edge 4->5.
    r=40;gap=math.sqrt(3)*r
    return ring(cx,cy,r,doubles=(1,3,5))+ring(cx+gap,cy,r,nitrogens=(0,2) if two else (0,),doubles=(0,2),omit=(4,))

p=start('辨認四種環型：藍色 N 是環上的氮原子',680,540)
p += [text(28,36,'先看環形，再數藍色 N',25),text(28,64,'N＝氮原子；未標字母的轉角通常是碳。',16)]
for y in [85,295]:p.append(f'<path d="M28 {y}H652" stroke="#d8e3d8"/>')
p += [text(28,115,'Quinazoline 喹唑啉',20),fused(110,185),text(28,255,'兩環共用一邊；含氮的環上有 2 個 N。',16),text(365,115,'Quinoline 喹啉',20),fused(440,185,False),text(365,255,'外形相近，但只有 1 個環內 N。',16)]
p += [text(28,325,'Piperazine 哌嗪',20),ring(145,397,45,nitrogens=(0,3)),text(28,470,'單一六元飽和環；兩個 N 位在對面。',16),text(365,325,'Piperidine 哌啶',20),ring(500,397,45,nitrogens=(0,)),text(365,470,'單一六元飽和環；只有 1 個 N。',16),text(28,514,'環型示意：省略氫與藥物其他取代基；不是完整藥物結構。',15)]
finish(p,'ring-nitrogen')

p=start('四種 alpha1 阻斷劑的代表性消除半衰期',680,390)
p += [text(28,37,'血中藥物濃度減半，需要多久？',24),text(28,65,'消除半衰期的代表值（小時）',17)]
for i,(name,value,label) in enumerate([('Prazosin',2.5,'2–3'),('Alfuzosin 緩釋',10,'約 10'),('Terazosin',12,'約 12'),('Doxazosin',22,'約 22')]):
    y=101+i*54;p.append(text(28,y+20,name,18));p.append(f'<rect x="235" y="{y}" width="{value*15}" height="28" rx="7" fill="{GREEN if i==3 else BLUE}"/>');p.append(text(245+value*15,y+21,label,17))
p += [text(28,339,'半衰期 ≠ 開始起效的時間，也不直接等於服藥間隔。',16),text(28,368,'數字依仿單與劑型；個別病人、研究條件可能不同。',15)]
finish(p,'alpha1-half-life')

p=start('Statin 常見含氮環與羧酸官能基',680,470)
p += [text(28,36,'把「環型」與「酸基」分開辨認',24),text(28,76,'Atorvastatin：pyrrole 吡咯',19),ring(135,157,47,n=5,nitrogens=(0,),doubles=(1,3)),text(28,231,'五個頂點；其中 1 個是 N。',16),text(355,76,'Rosuvastatin：pyrimidine 嘧啶',18),ring(500,157,45,nitrogens=(0,2),doubles=(0,2,4)),text(355,231,'六個頂點；其中 2 個是 N。',16)]
p += ['<path d="M28 257H652" stroke="#d8e3d8"/>',text(28,291,'羧酸基：—C(=O)—OH',20),text(28,324,'Atorvastatin 同時有吡咯環與帶羧酸的開鏈部分。',17),text(28,354,'「開鏈」表示這段沒有封成內酯環；成鹽時可寫作 —COO⁻。',16),text(28,397,'看到五角形還不夠：要確認 N 的位置與雙鍵。',16),text(28,437,'只畫本題要辨認的片段，省略氫與其他取代基。',15)]
finish(p,'statin-rings')

p=start('微脂粒剖面：水相核心與磷脂雙層',680,440)
p += [text(28,36,'微脂粒：雙層膜包住水性核心',24),text(28,64,'單一雙層膜囊泡的剖面示意',16)]
cx,cy=210,235
p.append(f'<circle cx="{cx}" cy="{cy}" r="80" fill="#e0f2f4"/>')
for i in range(40):
    a=i*2*math.pi/40;vx,vy=math.cos(a),math.sin(a);tx,ty=-vy,vx
    for radius,tail in [(111,96),(80,95)]:
        x,y=cx+radius*vx,cy+radius*vy
        for shift in [-2,2]:p.append(f'<path d="M{x+tx*shift:.2f} {y+ty*shift:.2f}L{cx+tail*vx+tx*shift:.2f} {cy+tail*vy+ty*shift:.2f}" stroke="#a08b5c" stroke-width="2"/>')
        p.append(f'<circle cx="{x:.2f}" cy="{y:.2f}" r="5" fill="#439a94"/>')
for x,y in [(189,208),(239,221),(210,258),(170,251)]:p.append(f'<circle cx="{x}" cy="{y}" r="7" fill="{BLUE}"/>')
p.append('<circle cx="305" cy="235" r="7" fill="#d47d41"/>')
p += [text(372,139,'外側也是水相',18),text(372,193,'水性核心',20),text(372,219,'親水藥可包在裡面',16),text(372,279,'磷脂雙層',20),text(372,305,'親脂藥可位於膜內',16),'<path d="M247 219L349 190M309 236L349 278" stroke="#729285" stroke-width="1.5" fill="none"/>',text(28,382,'兩排親水頭朝向水；疏水尾部相向，形成膜的內部。',16),text(28,411,'藥物實際分布依分子性質與配方而異；此圖未畫 PEG 外衣。',15)]
finish(p,'liposome')

p=start('輸注四小時後停止的濃度曲線與面積分區',680,460)
p += [text(28,36,'AUC 是面積：先分清時間範圍',24),text(28,65,'本題：輸注 180 mg/h，4 h 停止；CL＝12 L/h，k＝1 h⁻¹。',16)]
def infusion(t):return 15*(1-math.exp(-t)) if t<=4 else 15*(1-math.exp(-4))*math.exp(-(t-4))
def curve(start,end):return [(70+70*t,280-10*infusion(t)) for t in [start+(end-start)*i/100 for i in range(101)]]
def path(points):return ' '.join(('M' if i==0 else 'L')+f'{x:.2f},{y:.2f}' for i,(x,y) in enumerate(points))
for a,b,color in [(0,4,'#a9d7bc'),(4,8,'#abd2ef')]:
    pts=curve(a,b);p.append(f'<path d="M{pts[0][0]},280 '+path(pts).replace('M','L',1)+f' L{pts[-1][0]},280Z" fill="{color}"/>')
p += ['<path d="M70 100V280H648M350 105V285" stroke="#728a7b" fill="none" stroke-width="1.5"/>',f'<path d="{path(curve(0,8))}" stroke="{GREEN}" fill="none" stroke-width="3"/>','<path d="M70 130H350" stroke="#728a7b" stroke-dasharray="5 5"/>',text(37,135,'15',15),text(20,102,'mg/L',14),text(62,305,'0',16),text(341,305,'4',16),text(620,305,'8 h',16),text(338,94,'停止輸注',17),text(172,237,'約 45',22),text(370,260,'約 15',20,BLUE),text(28,347,'總面積＝總劑量 ÷ CL＝720 ÷ 12＝60 mg·h/L',19),text(28,380,'前 4 小時面積 ≈ 60 − 15＝45；停輸後尾段延伸到無限遠。',16),text(28,415,'圖依一室、一階模型由零開始；精確值為前段 45.275、尾段 14.725。',14),text(28,440,'題目把 4 小時視為接近穩態，答案取約數。',15)]
finish(p,'infusion-area')

p=start('層析解析度：兩峰保留時間差與基線寬',680,455)
p += [text(28,36,'兩個峰隔多遠，還要看它們多寬',24),text(28,65,'tR：峰頂對應的保留時間；W：峰的基線寬。',17)]
base=267;sigma=34;height=135
for center,color,label in [(210,GREEN,'A'),(470,BLUE,'B')]:
    pts=[(x,base-height*math.exp(-(x-center)**2/(2*sigma*sigma))) for x in range(int(center-3.8*sigma),int(center+3.8*sigma)+1,2)]
    p.append(f'<path d="{path(pts)}" fill="none" stroke="{color}" stroke-width="3"/>')
    p.append(f'<path d="M{center} {base-height}V{base}M{center-2*sigma} {base}L{center-.5*sigma} {base-height*math.exp(-.5)*1.5:.2f}M{center+2*sigma} {base}L{center+.5*sigma} {base-height*math.exp(-.5)*1.5:.2f}" stroke="{color}" stroke-dasharray="4 4" fill="none"/>')
    p += [text(center,110,'tR,'+label,17,color,'middle'),f'<path d="M{center-2*sigma} 284V304M{center+2*sigma} 284V304M{center-2*sigma} 294H{center+2*sigma}" stroke="{color}" fill="none"/>',text(center,320,'W'+label,17,color,'middle')]
p += ['<path d="M60 120V267H633" stroke="#728a7b" fill="none"/>',text(575,289,'時間',15),text(28,359,'Rs＝2 × (tR,B − tR,A) ÷ (WA ＋ WB)',21),text(28,397,'此式用基線寬：以峰兩側切線延伸到基線的位置來量。',16),text(28,428,'不要直接改用半高寬；所有時間與寬度要用相同單位。',16)]
finish(p,'chromatography-resolution')

p=start('糖苷的碳碳鍵與碳氧鍵連接方式',680,410)
p += [text(28,36,'C 與 O 說的是「糖怎麼接出去」',24),text(28,72,'O-糖苷：糖端的碳經由氧接到另一部分',18)]
p += [text(60,131,'糖端 C',24,GREEN),text(300,131,'O',28,BLUE),text(470,131,'苷元',24),'<path d="M164 122H280M330 122H448" stroke="#284d43" stroke-width="3"/>',text(28,201,'C-糖苷：糖端的碳直接接到另一個碳',18),text(60,260,'糖端 C',24,GREEN),text(450,260,'C（苷元）',24),'<path d="M164 251H427" stroke="#284d43" stroke-width="3"/>',text(28,316,'C＝碳，O＝氧；糖端 C 指形成糖苷連接的異頭碳。',16),text(28,348,'「同時有 C 與 O 型」表示同一分子有兩種連接，並非 C=O 雙鍵。',16),text(28,382,'概念片段圖：省略其他原子與鍵，不代表完整分子結構。',15)]
finish(p,'glycoside-links')
def benzene_on_edge(a,b,parent):
    dx,dy=b[0]-a[0],b[1]-a[1];edge=math.hypot(dx,dy);mid=((a[0]+b[0])/2,(a[1]+b[1])/2)
    candidates=[(mid[0]+sign*(-dy)*math.sqrt(3)/2,mid[1]+sign*dx*math.sqrt(3)/2) for sign in [-1,1]]
    center=max(candidates,key=lambda c:math.dist(c,parent));angle=math.atan2(a[1]-center[1],a[0]-center[0]);target=math.atan2(b[1]-center[1],b[0]-center[0]);delta=(target-angle+math.pi)%(2*math.pi)-math.pi;direction=1 if delta>0 else -1
    vertices=[(center[0]+edge*math.cos(angle+direction*i*math.pi/3),center[1]+edge*math.sin(angle+direction*i*math.pi/3)) for i in range(6)]
    return ''.join(bond(vertices[i],vertices[(i+1)%6],*center,i in (2,4)) for i in range(1,6))
def pyrrole_fused(cx,cy,two=False):
    pts=polygon(cx,cy,37,5,90)
    s=ring(cx,cy,37,n=5,nitrogens=(0,),doubles=(1,3),angle=90)
    s+=benzene_on_edge(pts[1],pts[2],(cx,cy))
    if two:s+=benzene_on_edge(pts[3],pts[4],(cx,cy))
    return s
p=start('Carbazole 與 indole：環的大小不同於氮的數量',680,355)
p += [text(28,36,'環的大小與氮的數量，分開看',24),text(28,74,'Carbazole 咔唑',21),pyrrole_fused(175,157,True),text(28,235,'三個環：6－5－6；只有 1 個環內 N。',16),text(370,74,'Indole 吲哚',21),pyrrole_fused(520,157),text(370,235,'兩個環：6－5；只有 1 個環內 N。',16),text(28,288,'「五員環」表示繞一圈經過 5 個原子；其中可以只有 1 個氮。',16),text(28,326,'環型示意：藍色 N 是氮；省略氫與其他取代基。',15)]
finish(p,'fused-ring-count')
print('Built 8 original SVG lesson diagrams.')
