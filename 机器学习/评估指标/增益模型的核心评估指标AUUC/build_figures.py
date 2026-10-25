"""Rebuild AUUC figures. Dependencies: matplotlib, numpy, scikit-uplift.

Figure contracts:
- flow: how scores become AUUC; left-to-right ranking, then cumulative
  estimation and integration; no optional edges or repeated model blocks.
- gain curve: separate total area from random baseline area using the exact
  five-bucket article data; axes and figures are derived from sklift output.
- cover: 16:9; one ranking motif and one gain curve; no scientific upper bound.
SVG/PNG pairs remain together. Figure numbers belong to article captions.
"""
from pathlib import Path
from html import escape
import numpy as np
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib import font_manager
from matplotlib.ticker import PercentFormatter
from sklift.metrics import uplift_curve
from sklearn.metrics import auc

ROOT = Path(__file__).resolve().parent
FONT = '/System/Library/Fonts/Supplemental/Arial Unicode.ttf'
font_manager.fontManager.addfont(FONT)
plt.rcParams.update({
    'font.family': font_manager.FontProperties(fname=FONT).get_name(),
    'font.size': 18, 'axes.unicode_minus': False, 'svg.fonttype': 'none',
    'axes.spines.top': False, 'axes.spines.right': False,
    'axes.edgecolor': '#8B9AA8', 'text.color': '#1F2D3D',
    'axes.labelcolor': '#1F2D3D', 'xtick.color': '#607080',
    'ytick.color': '#607080',
})

# Exact individual-level observations also used by the article's runnable code.
y, w, scores = [], [], []
for r, s in [(20,.30), (10,.22), (15,.16), (5,.05), (0,-.08)]:
    y.extend([1]*r + [0]*(50-r) + [1]*5 + [0]*45)
    w.extend([1]*50+[0]*50)
    scores.extend([s]*100)
x, gain = uplift_curve(y, scores, w)
q = x / len(y)
assert np.allclose(gain, [0,30,40,60,60,50])
assert np.isclose(auc(q,gain), 43)
base = q*gain[-1]

fig, ax = plt.subplots(figsize=(12.8,8), dpi=125)
fig.subplots_adjust(left=.12, right=.95, top=.86, bottom=.19)
fig.suptitle('同一条增益曲线，两部分面积', fontsize=27, y=.96, fontweight='bold')
ax.fill_between(q, 0, base, color='#FFF1E7', zorder=1)
ax.fill_between(q, base, gain, color='#E2EEFF', zorder=2)
ax.plot(q, gain, '-o', color='#4879BF', linewidth=3, markersize=7,
        label='模型累计增益', zorder=4)
ax.plot(q, base, '--', color='#D18B50', linewidth=2.5,
        label='随机基线', zorder=3)
ax.set(xlim=(0,1), ylim=(0,70), xlabel='累计覆盖比例 q', ylabel='估计新增购买人数 G(q)')
ax.set_xticks(q)
ax.xaxis.set_major_formatter(PercentFormatter(1))
ax.set_yticks(range(0,71,10))
ax.grid(axis='y', alpha=.24, color='#9DAAB8')
ax.set_axisbelow(True)
ax.legend(loc='upper left', frameon=False, fontsize=17)
for a,b in zip(q[1:], gain[1:]):
    ax.annotate(str(int(round(b))),(a,b),xytext=(-13 if a==1 else 0,13),
                textcoords='offset points',ha='center',fontsize=17,color='#4879BF')
ax.text(.63,38,'超额面积 = 18',ha='center',fontsize=21,color='#3B66A4')
ax.text(.74,12,'随机面积 = 25',ha='center',fontsize=21,color='#A36735')
fig.text(.5,.045,'原始 AUUC = 43     =     随机面积 25  +  超额面积 18',
         ha='center',fontsize=21,
         bbox={'boxstyle':'round,pad=.7','facecolor':'#F6F8FA','edgecolor':'#D7DFE7'})
fig.savefig(ROOT/'auuc-gain-curve.svg',metadata={'Date':None})
svg_path = ROOT/'auuc-gain-curve.svg'
svg = svg_path.read_text().replace('<svg ', '<svg role="img" aria-labelledby="curve-title curve-desc" ', 1)
svg = svg.replace(' <metadata>', ' <title id="curve-title">累计增益曲线与面积</title>\n <desc id="curve-desc">模型原始面积43，随机面积25，超额面积18。</desc>\n <metadata>', 1)
svg_path.write_text(svg)
fig.savefig(ROOT/'auuc-gain-curve.png')
plt.close(fig)

TEXT = '#1F2D3D'
MUTED = '#607080'
BLUE = '#6791D7'
def t(x,y,s,size=30,color=TEXT,weight=400,anchor='start'):
    return f'<text x="{x}" y="{y}" font-size="{size}" fill="{color}" font-weight="{weight}" text-anchor="{anchor}">{escape(s)}</text>'
def rect(x,y,w,h,fill='#F6F8FA',stroke='#CDD7E1',r=20):
    return f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{r}" fill="{fill}" stroke="{stroke}" stroke-width="2"/>'
def arrow(x1,y1,x2,y2):
    return f'<path d="M{x1},{y1} L{x2},{y2}" stroke="#6F8190" stroke-width="3" fill="none" marker-end="url(#arrow)"/>'
def wrap(name,w,h,parts,desc):
    body=''.join(parts)
    out=f'''<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="0 0 {w} {h}" role="img" aria-labelledby="title desc">
<title id="title">{escape(name)}</title><desc id="desc">{escape(desc)}</desc>
<defs><marker id="arrow" markerUnits="userSpaceOnUse" markerWidth="10" markerHeight="10" refX="9" refY="5" orient="auto"><path d="M0,0 L10,5 L0,10 Z" fill="#6F8190"/></marker></defs>
<rect width="{w}" height="{h}" fill="white"/>
<g font-family="Arial, PingFang SC, Microsoft YaHei, sans-serif">{body}</g></svg>'''
    (ROOT/(name+'.svg')).write_text(out)

p=[t(70,80,'从模型分数到 AUUC',42,weight=700)]
# Reading order is left to right; lower strip expands the cumulative-prefix node.
xs=[70,460,850,1240]
labels=[('独立测试集',['分组 W','购买结果 Y','预测 uplift 分数']),
        ('按分数降序',['高分用户在前','相同分数一起取点']),
        ('累计增益曲线',['取前 k 位用户','率差 × 累计人数']),
        ('曲线积分',['补上原点','梯形法计算面积'])]
for i,(xx,(title,lines)) in enumerate(zip(xs,labels)):
    p.append(rect(xx,145,290,250,['#EAF3FF','#EDF7E8','#EAF3FF','#F4EDFF'][i]))
    p.append(t(xx+145,203,title,32,weight=650,anchor='middle'))
    for j,line in enumerate(lines):
        p.append(t(xx+145,258+j*47,line,27,color=MUTED,anchor='middle'))
    if i<3: p.append(arrow(xx+290,270,xs[i+1]-10,270))
p += [rect(70,460,1460,255,'#FAFBFC'),
      t(110,515,'每个点都重新统计累计前缀',30,weight=650)]
for i,(a,b,c) in enumerate([('前 100 人','20/50 − 5/50','增益 30 人'),
                            ('前 200 人','30/100 − 10/100','增益 40 人'),
                            ('前 500 人','50/250 − 25/250','增益 50 人')]):
    xx=145+i*470
    p += [t(xx,575,a,29,weight=600),t(xx,625,b,29,color=MUTED),t(xx,674,c,29,color='#4879BF',weight=600)]
wrap('auuc-evaluation-flow',1600,780,p,'按预测分数排序，在累计前缀中统计两组率差，乘累计人数后积分。')

p=[t(95,180,'AUUC',90,weight=700),
   t(100,252,'用增益曲线评估排序',36,color=MUTED),
   t(100,685,'按预测 uplift 排序',30,color=MUTED)]
# A small stack encodes ranking, without claiming known individual treatment effects.
for i,(yy,fill,lab) in enumerate([(348,'#EAF3FF','高分'),(445,'#EDF7E8','中分'),(542,'#FFF1E7','低分')]):
    p += [rect(100,yy,345,76,fill),t(135,yy+49,lab,29,weight=600)]
    for j in range(5-i):
        p.append(rect(235+32*j,yy+27,20,22,'#91ADD1','#91ADD1',4))
p.append(arrow(490,481,660,481))
X=lambda v:740+v*710
Y=lambda v:700-v*7
points=' '.join(f'{X(a)},{Y(b)}' for a,b in zip(q,gain))
poly=points+f' {X(1)},{Y(50)} {X(0)},{Y(0)}'
p.append(f'<polygon points="{poly}" fill="#E2EEFF"/>')
p += [f'<path d="M740,700 L1450,700 M740,700 L740,230" fill="none" stroke="#8B9AA8" stroke-width="3"/>',
      f'<path d="M740,700 L1450,350" fill="none" stroke="#D18B50" stroke-width="4" stroke-dasharray="12 10"/>',
      f'<polyline points="{points}" fill="none" stroke="#4879BF" stroke-width="6" stroke-linejoin="round"/>',
      t(740,187,'累计增益',30,color=MUTED),t(1450,750,'覆盖比例',30,color=MUTED,anchor='end')]
for a,b in zip(q[1:],gain[1:]):
    p.append(f'<circle cx="{X(a)}" cy="{Y(b)}" r="7" fill="#4879BF"/>')
wrap('auuc-cover',1600,900,p,'根据预测 uplift 排序后，以累计增益曲线下的面积评估排序效果。')
print('Created 3 SVG figures and gain-curve PNG; render remaining SVGs with a font-aware SVG renderer.')
