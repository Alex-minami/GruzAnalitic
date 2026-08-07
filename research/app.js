(() => {
  const qs=(s,r=document)=>r.querySelector(s), qsa=(s,r=document)=>[...r.querySelectorAll(s)];
  const research=qs('#research'), tocNav=qs('#toc-nav');
  const slugify=s=>s.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-zа-яё0-9]+/gi,'-').replace(/^-+|-+$/g,'').slice(0,100)||'section';
  const visuals={
    '3. Денежный объём рынка: 2022–2026':['chart-market','Рынок в деньгах','Динамика коммерческих автоперевозок и широкий контур.'],
    '4. Физические объёмы и структурный сдвиг':['chart-physical','Физическая работа','Тоннаж растёт быстрее транспортной работы — средняя дальность снижается.'],
    '5. Хронология рынка: пять фаз 2022–2026':['cycle-timeline','Пять фаз цикла','От шока 2022 года к отскоку «выживших» в 2026-м.'],
    '6. Парк и предложение транспорта':['chart-fleet','Парк и продажи','Обвал новых LCV/MCV формирует будущий дефицит предложения.'],
    '7. E-commerce — главный драйвер спроса':['chart-ecommerce','E-commerce и операции','Рост числа заказов ускоряет межузловой Middle Mile.'],
    '8. Ставки и тарифы: полная карта':['chart-rates','Коридоры ставок','Нормализованный коридор оплачиваемого километра по классам.'],
    '9. Себестоимость километра: три модели рядом':['chart-cost-mileage','Себестоимость и пробег','Постоянные расходы резко меняют экономику одного автомобиля.'],
    '10. Юнит-экономика автомобиля':['chart-pnl','Юнит-экономика','Маржа зависит от утилизации и модели владения.'],
    '12. Last Mile — центральный раздел':['chart-lastmile','Last Mile: плотность','Чем больше успешных точек на смену, тем ниже себестоимость точки.'],
    '13. Middle Mile против Last Mile — сводное сравнение':['chart-mile-compare','Middle vs Last Mile','Сравнение типичных диапазонов EBITDA.'],
    '15. Динамика затрат 2022–2026: полная карта':['chart-diesel','Топливо и затраты','Дизель стал главным волатильным драйвером 2026 года.'],
    '21. Прогнозы 2026–2028':['chart-scenarios','Сценарии 2026','Номинальный рост выручки не равен росту маржи.'],
    '22. Реестр рисков 2026–2028':['risk-matrix','Карта рисков','Вероятность × влияние по реестру исследования.']
  };

  async function boot(){
    try{
      const researchB64=(window.RESEARCH_DATA_PARTS||[]).join('');
      if(!researchB64) throw new Error('Данные исследования не загружены');
      const bytes=Uint8Array.from(atob(researchB64),c=>c.charCodeAt(0));
      const stream=new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
      let md=await new Response(stream).text();
      const audioB64=(window.RESEARCH_AUDIO_PARTS||[]).join('');
      if(audioB64){
        const ab=Uint8Array.from(atob(audioB64),c=>c.charCodeAt(0));
        const audioUrl=URL.createObjectURL(new Blob([ab],{type:'audio/ogg; codecs=opus'}));
        const audio=document.getElementById('research-audio'); if(audio) audio.src=audioUrl;
      }
      md=md.replace(/^---[\s\S]*?---\s*/,'').replace(/\[\[([^\]]+)\]\]/g,'<span class="source-ref">$1</span>');
      marked.setOptions({gfm:true,breaks:false});
      research.innerHTML=marked.parse(md);
      enhanceContent();
      initUX();
      initCharts();
    }catch(e){
      research.innerHTML=`<div class="load-error"><strong>Не удалось загрузить текст исследования.</strong><span>${e.message}</span><a href="research/source.md">Открыть исходный Markdown</a></div>`;
    }
  }

  function enhanceContent(){
    const seen={};
    qsa('h1,h2,h3',research).forEach(h=>{let base=slugify(h.textContent.trim());seen[base]=(seen[base]||0)+1;h.id=seen[base]===1?base:`${base}-${seen[base]}`;h.classList.add('research-heading')});
    qsa('table',research).forEach(t=>{t.classList.add('research-table');const w=document.createElement('div');w.className='table-wrap';t.parentNode.insertBefore(w,t);w.appendChild(t)});
    qsa('h2',research).forEach(h=>{
      const title=h.textContent.trim();
      if(title.startsWith('1. Executive Summary')){const ol=h.nextElementSibling;if(ol&&ol.tagName==='OL')ol.classList.add('thesis-grid')}
      if(visuals[title]){const [id,vtitle,sub]=visuals[title];const s=document.createElement('section');s.className='visual-block';s.innerHTML=`<div class="visual-head"><div><div class="eyebrow">Визуализация</div><h3>${vtitle}</h3><p>${sub}</p></div></div><div id="${id}" class="visual-canvas"><canvas aria-label="${vtitle}"></canvas></div>`;h.insertAdjacentElement('afterend',s)}
    });
    tocNav.innerHTML=qsa('h2',research).map(h=>`<a class="toc-link" href="#${h.id}"><span>${h.textContent}</span></a>`).join('');
  }

  function initUX(){
    const progress=qs('#reading-progress'), back=qs('#back-top'), toc=qs('#toc');
    const onScroll=()=>{const h=document.documentElement,p=(h.scrollTop/Math.max(1,h.scrollHeight-h.clientHeight))*100;progress.style.width=Math.max(0,Math.min(100,p))+'%';back.classList.toggle('show',h.scrollTop>700)};
    addEventListener('scroll',onScroll,{passive:true});onScroll();back.addEventListener('click',()=>scrollTo({top:0,behavior:'smooth'}));
    const links=qsa('.toc-link'), h2s=qsa('.research h2');
    const io=new IntersectionObserver(entries=>entries.forEach(e=>{if(e.isIntersecting)links.forEach(a=>a.classList.toggle('active',a.getAttribute('href')==='#'+e.target.id))}),{rootMargin:'-18% 0px -72% 0px',threshold:0});h2s.forEach(h=>io.observe(h));
    qs('#toc-open')?.addEventListener('click',()=>toc.classList.add('open'));qs('#toc-close')?.addEventListener('click',()=>toc.classList.remove('open'));links.forEach(a=>a.addEventListener('click',()=>toc.classList.remove('open')));
    const dlg=qs('#search-dialog'), sin=qs('#search-input'), results=qs('#search-results');
    qs('#search-open').addEventListener('click',()=>{dlg.showModal();setTimeout(()=>sin.focus(),30)});qs('#search-close').addEventListener('click',()=>dlg.close());
    const sections=h2s.map(h=>{let txt=h.textContent+' ',n=h.nextElementSibling;while(n&&n.tagName!=='H2'){txt+=n.textContent+' ';n=n.nextElementSibling}return{h,txt:txt.replace(/\s+/g,' ').trim()}});
    sin.addEventListener('input',()=>{const q=sin.value.trim().toLowerCase();if(q.length<2){results.innerHTML='<div class="search-result"><small>Введите минимум 2 символа.</small></div>';return}const found=sections.filter(s=>s.txt.toLowerCase().includes(q)).slice(0,12);results.innerHTML=found.length?found.map(s=>{const p=s.txt.toLowerCase().indexOf(q),ex=s.txt.slice(Math.max(0,p-55),p+q.length+95);return`<a class="search-result" href="#${s.h.id}"><b>${s.h.textContent}</b><small>…${ex}…</small></a>`}).join(''):'<div class="search-result"><small>Совпадений не найдено.</small></div>';qsa('.search-result[href]',results).forEach(a=>a.addEventListener('click',()=>dlg.close()))});
  }

  function initCharts(){
    if(!window.Chart)return;
    Chart.defaults.font.family='Inter, system-ui, sans-serif';Chart.defaults.color='#617086';Chart.defaults.borderColor='rgba(150,165,185,.18)';
    const compact=v=>new Intl.NumberFormat('ru-RU',{maximumFractionDigits:1}).format(v);
    const baseOpts=(suffix='')=>({responsive:true,maintainAspectRatio:false,interaction:{mode:'index',intersect:false},plugins:{legend:{position:'bottom',labels:{usePointStyle:true,boxWidth:8,padding:16}},tooltip:{callbacks:{label:c=>`${c.dataset.label}: ${compact(c.parsed.y)}${suffix}`}}},scales:{x:{grid:{display:false}},y:{beginAtZero:false,ticks:{callback:v=>compact(v)+suffix}}}});
    const chart=(id,cfg)=>{const el=qs('#'+id+' canvas');if(el)new Chart(el,cfg)};
    chart('chart-market',{type:'line',data:{labels:['2022','2023','2024','2025','2026E'],datasets:[{label:'Коммерческие автоперевозки, трлн ₽',data:[2.18,2.31,2.61,2.63,2.80],borderWidth:3,tension:.25,pointRadius:4},{label:'Рынок ТЛУ, трлн ₽',data:[9.2,10.6,11.7,13.13,null],borderWidth:2,borderDash:[6,4],tension:.25,pointRadius:3}]},options:baseOpts(' трлн ₽')});
    chart('chart-physical',{type:'line',data:{labels:['2022','2023','2024','2025'],datasets:[{label:'Автоперевозки всего, млрд т',data:[6.211,6.491,6.776,6.865],borderWidth:3,tension:.25},{label:'Коммерческие, млрд т',data:[2.169,2.373,2.668,2.817],borderWidth:3,tension:.25}]},options:baseOpts(' млрд т')});
    const cyc=qs('#cycle-timeline');if(cyc)cyc.innerHTML=`<div class="cycle-grid"><div class="cycle-phase"><span>2022 · I</span><b>Шок и перестройка</b><small>Европейские маршруты рушатся, тарифы +28,4%</small></div><div class="cycle-phase"><span>2023 · II</span><b>Адаптационный рост</b><small>Пик ставок и массовые закупки техники</small></div><div class="cycle-phase"><span>2024 · III</span><b>Перегрев предложения</b><small>Индекс ставок ATI.SU −8%</small></div><div class="cycle-phase"><span>2025 · IV</span><b>Кризис рентабельности</b><small>Тариф ~66 ₽ против себестоимости ~82 ₽</small></div><div class="cycle-phase"><span>2026 · V</span><b>Отскок «выживших»</b><small>Ставки +28,8% г/г, спрос лишь +~1%</small></div></div>`;
    chart('chart-fleet',{type:'bar',data:{labels:['LCV','MCV','HCV'],datasets:[{label:'Изменение продаж в 2025, %',data:[-21.9,-44,-52]}]},options:{...baseOpts('%'),scales:{x:{grid:{display:false}},y:{max:0,min:-60,ticks:{callback:v=>v+'%'}}}}});
    chart('chart-ecommerce',{type:'line',data:{labels:['2022','2023','2024','2025','2026E'],datasets:[{label:'Заказы e-commerce, млрд',data:[2.85,4.95,7.1,8.3,10.0],borderWidth:3,tension:.25,pointRadius:4}]},options:baseOpts(' млрд')});
    chart('chart-rates',{type:'line',data:{labels:['2022','2023','2024','2025','2026 YTD'],datasets:[{label:'Газель 1,5–2 т',data:[40,46.5,52,50,62.5],borderWidth:3,tension:.25},{label:'3–5 т',data:[51,60,69,67.5,80],borderWidth:3,tension:.25},{label:'5–10 т',data:[69,81.5,90,87.5,102.5],borderWidth:3,tension:.25}]},options:baseOpts(' ₽/км')});
    chart('chart-cost-mileage',{type:'line',data:{labels:['5 000','7 500','10 000'],datasets:[{label:'Газель',data:[82.45,61.52,51.05],borderWidth:3,tension:.2},{label:'3–5 т',data:[104.47,78.27,65.17],borderWidth:3,tension:.2},{label:'5–10 т',data:[133.74,100.74,84.24],borderWidth:3,tension:.2}]},options:{...baseOpts(' ₽/км'),scales:{x:{title:{display:true,text:'Фактический пробег, км/мес'},grid:{display:false}},y:{title:{display:true,text:'Полная себестоимость'},ticks:{callback:v=>v+' ₽'}}}}});
    chart('chart-pnl',{type:'bar',data:{labels:['Газель','3–5 т','5–10 т'],datasets:[{label:'Маржа при 5 000 км',data:[-17.8,-13.6,-16.3]},{label:'Маржа при 7 500 км',data:[12.1,14.9,12.4]},{label:'Маржа при 10 000 км',data:[27.1,29.2,26.7]}]},options:{...baseOpts('%'),scales:{x:{grid:{display:false}},y:{ticks:{callback:v=>v+'%'}}}}});
    chart('chart-lastmile',{type:'line',data:{labels:['10','15','20','25','30','40'],datasets:[{label:'Себестоимость одной точки',data:[1702,1135,851,681,567,426],borderWidth:3,tension:.2,pointRadius:4}]},options:{...baseOpts(' ₽'),scales:{x:{title:{display:true,text:'Точек за смену'},grid:{display:false}},y:{title:{display:true,text:'₽/точка'},ticks:{callback:v=>v+' ₽'}}}}});
    chart('chart-mile-compare',{type:'bar',data:{labels:['Middle Mile','Last Mile','Last Mile: высокая плотность'],datasets:[{label:'Нижняя граница EBITDA',data:[8,3,12]},{label:'Верхняя граница EBITDA',data:[18,12,25]}]},options:{...baseOpts('%'),scales:{x:{grid:{display:false}},y:{beginAtZero:true,max:30,ticks:{callback:v=>v+'%'}}}}});
    chart('chart-diesel',{type:'line',data:{labels:['Нач. 2022','Янв. 2026','6 июл. 2026','3 авг. 2026'],datasets:[{label:'Дизель, ₽/л',data:[53.94,77.03,87.76,91.29],borderWidth:3,tension:.22,pointRadius:5}]},options:baseOpts(' ₽/л')});
    chart('chart-scenarios',{type:'bar',data:{labels:['Негативный','Базовый','Позитивный для выручки'],datasets:[{label:'Центр денежного объёма 2026, трлн ₽',data:[2.70,2.815,2.925]}]},options:{...baseOpts(' трлн ₽'),scales:{x:{grid:{display:false}},y:{min:2.6,max:3.0,ticks:{callback:v=>v.toFixed(1)+' трлн'}}}}});
    const risk=qs('#risk-matrix');if(risk)risk.innerHTML=`<div class="risk-grid">${[['Топливо','Высокая вероятность · высокое влияние'],['Дорогой лизинг','Высокая · высокое'],['Дефицит водителей B/C','Высокая · высокое'],['Концентрация на одном заказчике','Высокая · высокое'],['Порожний пробег','Высокая · высокое'],['Падение спотовых ставок','Средняя · высокое'],['Старение парка','Высокая · средне-высокое'],['Штрафы и неоплачиваемый простой','Высокая · средне-высокое']].map(x=>`<div class="risk-item"><span>${x[1]}</span><b>${x[0]}</b></div>`).join('')}</div>`;
  }
  boot();
})();