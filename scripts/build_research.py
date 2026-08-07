from pathlib import Path
import base64, gzip, html, re, sys
import markdown
from bs4 import BeautifulSoup, Tag

ROOT=Path(__file__).resolve().parents[1]
OUT=Path(sys.argv[1]) if len(sys.argv)>1 else ROOT/'logistics-research.html'

parts=[]
for p in sorted((ROOT/'research').glob('data-[0-9][0-9].js')):
    m=re.search(r"push\('([^']+)'\)",p.read_text(encoding='utf-8'))
    if m: parts.append(m.group(1))
if not parts:
    raise SystemExit('Research data parts not found')
raw=base64.b64decode(''.join(parts))
md=gzip.decompress(raw).decode('utf-8')
md=re.sub(r'^---\n.*?\n---\n','',md,flags=re.S)
md=re.sub(r'^# Рынок логистики РФ:[\s\S]*?\n---\n','',md,count=1)
md=re.sub(r'\[\[([^\]]+)\]\]',r'<a class="source-ref" href="#sources">\1</a>',md)
rendered=markdown.markdown(md,extensions=['tables','fenced_code'])
soup=BeautifulSoup(rendered,'html.parser')

def slug(s):
    s=s.lower().replace('ё','е')
    return re.sub(r'[^a-zа-я0-9]+','-',s,flags=re.I).strip('-')[:90] or 'section'

seen={}
for h in soup.find_all(['h2','h3']):
    b=slug(h.get_text(' ',strip=True)); seen[b]=seen.get(b,0)+1
    h['id']=b if seen[b]==1 else f'{b}-{seen[b]}'
for t in list(soup.find_all('table')):
    w=soup.new_tag('div',attrs={'class':'table-wrap'}); t.wrap(w); t['class']=['research-table']
for pre in soup.find_all('pre'): pre['class']=['formula-block']

for h2 in soup.find_all('h2'):
    title=h2.get_text(' ',strip=True)
    if title.startswith('1. Executive Summary') or title.startswith('27. Двадцать выводов'):
        ol=h2.find_next_sibling('ol')
        if ol:
            grid=soup.new_tag('div',attrs={'class':'thesis-grid'})
            for i,li in enumerate(ol.find_all('li',recursive=False),1):
                c=soup.new_tag('article',attrs={'class':'thesis-card'})
                n=soup.new_tag('div',attrs={'class':'thesis-num'}); n.string=f'{i:02d}'
                b=soup.new_tag('div',attrs={'class':'thesis-body'})
                for child in list(li.contents): b.append(child.extract() if hasattr(child,'extract') else child)
                c.extend([n,b]); grid.append(c)
            ol.replace_with(grid)

for p in soup.find_all('p'):
    txt=p.get_text(' ',strip=True)
    if txt.startswith(('Ключевой вывод','Стратегический вывод','Практический вывод','Критическое следствие','Принципиальный вывод','Важная оговорка')):
        p['class']=p.get('class',[])+['callout']

COLORS=['#2463eb','#0f9f6e','#d97706']
def esc(x): return html.escape(str(x))
def line_chart(title,labels,series,unit='',note=''):
    W,H,L,R,T,B=760,320,58,20,42,56
    vals=[v for _,a in series for v in a if v is not None]; mn=min(0,min(vals)); mx=max(vals); rng=max(mx-mn,.001)
    pw=W-L-R; ph=H-T-B; sx=lambda i:L+pw*i/max(1,len(labels)-1); sy=lambda v:T+ph*(1-(v-mn)/rng)
    x=[f'<section class="visual-block"><div class="visual-head"><span class="eyebrow">Визуализация</span><h3>{esc(title)}</h3>{f"<p>{esc(note)}</p>" if note else ""}</div><div class="visual-canvas"><svg viewBox="0 0 {W} {H}" role="img" aria-label="{esc(title)}">']
    for k in range(5):
        y=T+ph*k/4; v=mx-(mx-mn)*k/4
        x.append(f'<line x1="{L}" y1="{y}" x2="{W-R}" y2="{y}" class="v-grid"/><text x="{L-8}" y="{y+4}" text-anchor="end" class="v-axis">{v:.1f}{esc(unit)}</text>')
    for i,l in enumerate(labels): x.append(f'<text x="{sx(i)}" y="{H-20}" text-anchor="middle" class="v-axis">{esc(l)}</text>')
    lg=[]
    for si,(name,a) in enumerate(series):
        col=COLORS[si%len(COLORS)]; pts=' '.join(f'{sx(i):.1f},{sy(v):.1f}' for i,v in enumerate(a) if v is not None)
        x.append(f'<polyline points="{pts}" fill="none" stroke="{col}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>')
        for i,v in enumerate(a):
            if v is not None: x.append(f'<circle cx="{sx(i)}" cy="{sy(v)}" r="4" fill="{col}"/><text x="{sx(i)}" y="{sy(v)-9}" text-anchor="middle" class="v-label">{v:g}</text>')
        lg.append(f'<span><i style="background:{col}"></i>{esc(name)}</span>')
    x.append('</svg></div><div class="v-legend">'+''.join(lg)+'</div></section>'); return ''.join(x)

def bar_chart(title,labels,vals,unit='',note=''):
    W,H,L,R,T,B=760,305,58,18,45,64; mx=max(vals)*1.18; pw=W-L-R; ph=H-T-B; step=pw/len(labels); bw=step*.55
    x=[f'<section class="visual-block"><div class="visual-head"><span class="eyebrow">Визуализация</span><h3>{esc(title)}</h3>{f"<p>{esc(note)}</p>" if note else ""}</div><div class="visual-canvas"><svg viewBox="0 0 {W} {H}" role="img" aria-label="{esc(title)}">']
    for k in range(5):
        y=T+ph*k/4; v=mx*(1-k/4); x.append(f'<line x1="{L}" y1="{y}" x2="{W-R}" y2="{y}" class="v-grid"/><text x="{L-8}" y="{y+4}" text-anchor="end" class="v-axis">{v:.1f}{esc(unit)}</text>')
    for i,(lab,v) in enumerate(zip(labels,vals)):
        bx=L+i*step+(step-bw)/2; by=T+ph*(1-v/mx); bh=T+ph-by
        x.append(f'<rect x="{bx}" y="{by}" width="{bw}" height="{bh}" rx="8" class="v-bar"/><text x="{bx+bw/2}" y="{by-8}" text-anchor="middle" class="v-label">{v:g}{esc(unit)}</text><text x="{bx+bw/2}" y="{H-22}" text-anchor="middle" class="v-axis">{esc(lab)}</text>')
    x.append('</svg></div></section>'); return ''.join(x)

visuals={
'3. Денежный объём рынка: 2022–2026':line_chart('Коммерческие автоперевозки: денежный объём',['2022','2023','2024','2025','2026E'],[('Рынок, трлн ₽',[2.18,2.31,2.61,2.63,2.80])],' трлн ₽','2026 — базовая оценка исследования.'),
'4. Физические объёмы и структурный сдвиг':line_chart('Физический объём автоперевозок',['2022','2023','2024','2025'],[('Всего, млрд т',[6.211,6.491,6.776,6.865]),('Коммерческие, млрд т',[2.169,2.373,2.668,2.817])],' млрд т'),
'6. Парк и предложение транспорта':bar_chart('Падение продаж новой техники в 2025',['LCV','MCV','HCV'],[21.9,44,52],'%','HCV: падение более чем вдвое; 52% — визуальный ориентир.'),
'7. E-commerce — главный драйвер спроса':line_chart('Количество заказов e-commerce',['2022','2023','2024','2025','2026E'],[('Заказы, млрд',[2.85,4.95,7.1,8.3,10])],' млрд'),
'8. Ставки и тарифы: полная карта':line_chart('Расчётные ставки по классам',['2022','2023','2024','2025','2026 YTD'],[('Газель 1,5–2 т',[40,46.5,52,50,62.5]),('3–5 т',[51,60,69,67.5,80]),('5–10 т',[69,81.5,90,87.5,102.5])],' ₽/км','Середины расчётных диапазонов.'),
'9. Себестоимость километра: три модели рядом':line_chart('Полная себестоимость и пробег',['5 000','7 500','10 000'],[('Газель',[82.45,61.52,51.05]),('3–5 т',[104.47,78.27,65.17]),('5–10 т',[133.74,100.74,84.24])],' ₽/км'),
'10. Юнит-экономика автомобиля':bar_chart('Маржа при 7 500 км/мес',['Газель','3–5 т','5–10 т'],[12.1,14.9,12.4],'%'),
'12. Last Mile — центральный раздел':line_chart('Last Mile: себестоимость одной точки',['10','15','20','25','30','40'],[('₽ за точку',[1702,1135,851,681,567,426])],' ₽','Плотность маршрута резко меняет экономику.'),
'13. Middle Mile против Last Mile — сводное сравнение':bar_chart('Верхняя граница типичной EBITDA-маржи',['Middle Mile','Last Mile','Плотный LM'],[18,12,25],'%'),
'15. Динамика затрат 2022–2026: полная карта':line_chart('Дизель: ценовая траектория',['нач. 2022','янв. 2026','06.07.26','03.08.26'],[('Дизель, ₽/л',[53.94,77.03,87.76,91.29])],' ₽/л'),
'16. Кадры: структурный дефицит водителей':line_chart('Дефицит водителей',['2022','2023','2025'],[('Дефицит, %',[21,25,30])],'%'),
'21. Прогнозы 2026–2028':bar_chart('Сценарии денежного объёма рынка 2026',['Негативный','Базовый','Позитивный'],[2.70,2.815,2.925],' трлн ₽','Середины сценарных диапазонов.')
}
for h2 in soup.find_all('h2'):
    title=h2.get_text(' ',strip=True)
    if title in visuals:
        h2.insert_after(BeautifulSoup(visuals[title],'html.parser'))
    if title.startswith('25. Источники'): h2['id']='sources'

root=BeautifulSoup('<article class="research"></article>','html.parser').article
cur=None
for node in list(soup.contents):
    if isinstance(node,Tag) and node.name=='h2':
        cur=soup.new_tag('section',attrs={'class':'research-section'})
        if node.get_text(' ',strip=True).startswith('12. Last Mile'): cur['class'].append('spotlight-section')
        root.append(cur)
    if cur is None:
        cur=soup.new_tag('section',attrs={'class':'research-section'}); root.append(cur)
    cur.append(node)
heads=root.find_all('h2')
toc=''.join(f'<a class="toc-link" href="#{h["id"]}">{html.escape(h.get_text(" ",strip=True))}</a>' for h in heads)

hero='''<header class="site-header"><div class="header-inner"><a class="brand" href="#top"><span class="brand-mark">LI</span><span class="brand-copy"><b>Logistics Intelligence</b><small>Russia · 2022–2026</small></span></a><div class="header-actions"><button id="search-open" class="header-button">Поиск</button><button id="toc-open" class="header-button mobile-only">Главы</button></div></div></header><main id="top"><section class="hero"><div class="hero-inner"><div class="hero-kicker">Сводное исследование · срез на 7 августа 2026</div><h1>Рынок логистики РФ<br><span>2022–2026</span></h1><p class="hero-lead">Автомобильные грузоперевозки, Middle Mile и Last Mile: деньги, физические объёмы, ставки, себестоимость, парк, кадры, e-commerce, юнит-экономика и сценарии до 2028 года.</p><div class="hero-metrics"><div class="metric"><span>Коммерческие автоперевозки 2025</span><strong>2,63 трлн ₽</strong><small>рынок услуг</small></div><div class="metric"><span>Индекс ставок ATI.SU</span><strong>+28,8%</strong><small>г/г к 13.07.2026</small></div><div class="metric"><span>Газель · полная себестоимость</span><strong>61,5 ₽/км</strong><small>7 500 км/мес, модель</small></div><div class="metric"><span>Last Mile</span><strong>30–53%</strong><small>логистических затрат e-commerce</small></div></div><div class="hero-links"><a href="#1-executive-summary-18-тезисов">18 тезисов</a><a href="#8-ставки-и-тарифы-полная-карта">Ставки</a><a href="#9-себестоимость-километра-три-модели-рядом">Себестоимость</a><a href="#11-middle-mile-глубокий-анализ">Middle Mile</a><a href="#12-last-mile-центральный-раздел">Last Mile</a><a href="#21-прогнозы-2026-2028">Прогноз</a></div></div></section><section class="method-strip"><div class="method-inner"><div class="method-item"><span class="confidence high">High</span><div><b>Первичные данные</b><small>Росстат, Минтранс, ЦБ, ФНС, Автостат и отчётность.</small></div></div><div class="method-item"><span class="confidence medium">Medium</span><div><b>Отраслевые оценки</b><small>ATI.SU, Data Insight, АКИТ, Kept и другие источники.</small></div></div><div class="method-item"><span class="confidence model">Model</span><div><b>Расчётные модели</b><small>Ставки, юнит-экономика, Middle Mile и Last Mile.</small></div></div></div></section>'''

doc=f'''<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="theme-color" content="#0b1426"><meta name="description" content="Большое исследование рынка логистики и автомобильных грузоперевозок РФ 2022–2026: Middle Mile, Last Mile, ставки, себестоимость, парк, e-commerce и прогнозы."><title>Рынок логистики РФ 2022–2026 — глубокое исследование</title><link rel="stylesheet" href="research/styles-v2.css?v=20260807-static"></head><body><div class="reading-progress" id="reading-progress"></div>{hero}<div class="toc-overlay" id="toc-overlay"></div><div class="page-layout"><aside class="toc" id="toc"><div class="toc-head"><b>Оглавление</b><button id="toc-close" class="header-button mobile-only">Закрыть</button></div><nav>{toc}</nav></aside>{root}</div></main><footer class="site-footer">Исследование подготовлено 7 августа 2026 года на основе 13 материалов. Прогнозы отделены от фактических данных; расчётные модели воспроизводимы по формулам раздела 26.</footer><dialog class="search-dialog" id="search-dialog"><div class="search-shell"><div class="search-top"><b>Поиск по исследованию</b><button id="search-close">×</button></div><input id="search-input" type="search" placeholder="Например: холостой пробег, Газель, Last Mile…"><div id="search-results" class="search-results"></div></div></dialog><button class="back-top" id="back-top">↑</button><script src="research/static-site.js?v=20260807-static"></script></body></html>'''
OUT.parent.mkdir(parents=True,exist_ok=True)
OUT.write_text(doc,encoding='utf-8')
print(f'Built {OUT} ({len(doc)} chars), sections={len(heads)}, tables={len(root.find_all("table"))}')