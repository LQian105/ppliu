const PALETTE = [
  { color: '#a78bdf', tint: '#e2d6ff', name: '薰衣草' },
  { color: '#f3a0b9', tint: '#ffcbe0', name: '草莓奶油' },
  { color: '#edae67', tint: '#ffe1ad', name: '杏桃' },
  { color: '#65b99d', tint: '#cef0c4', name: '薄荷' },
  { color: '#76a8df', tint: '#c5eaf9', name: '晴空蓝' },
  { color: '#d6b253', tint: '#fff2b8', name: '柠檬奶油' },
  { color: '#df6f91', tint: '#f39bb5', name: '临时工作红' },
  { color: '#58b4ae', tint: '#c6f1ef', name: '青柠苏打' },
  { color: '#b28bdc', tint: '#eadcff', name: '葡萄汽水' },
  { color: '#e7a080', tint: '#ffe0cf', name: '蜜桃奶茶' },
  { color: '#8db884', tint: '#dff0cf', name: '鼠尾草' },
  { color: '#779ed5', tint: '#d8e8ff', name: '雾霾蓝' }
];
const TEMPORARY_COLOR_INDEX = 6;
const ICONS = ['💡','🧩','✏️','💬','📚','🎨','📊','🌱','🍜','🍰','☕','🍱','🏍️','🚗','✈️','🏃','🧘','🎵','🎮','📷','🛍️','💻','📞','🧹','🐾','❤️'];
const STORE = 'pipi-workbench-v1';
const BACKUP_STORE = 'pipi-workbench-backup-v1';
const dateKey = (date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};
const zhDate = (date) => `${date.getMonth()+1} 月 ${date.getDate()} 日`;
const dayName = (date) => ['日','一','二','三','四','五','六'][date.getDay()];

function seed() {
  const today = dateKey();
  return {
    categories: [
      { id:'c1', name:'内容创作', icon:'✏️', time:'09:30', color:0 },
      { id:'c2', name:'项目推进', icon:'🧩', time:'14:00', color:2 },
      { id:'c3', name:'学习充电', icon:'📚', time:'20:00', color:3 },
      { id:'c4', name:'运动健身', icon:'🏃', time:'18:00', color:4 }
    ],
    tasks: {
      [today]: [
        { id:'t1', categoryId:'c1', name:'整理本周选题灵感', time:'09:30', done:false, fixed:true },
        { id:'t2', categoryId:'c2', name:'同步项目进度与待办', time:'14:00', done:true, fixed:true },
        { id:'t3', categoryId:'c3', name:'阅读行业报告 30 分钟', time:'20:00', done:false, fixed:true }
      ]
    },
    hiddenFixed: {}
  };
}
function readSavedState(key){try{const saved=JSON.parse(localStorage.getItem(key));return saved&&Array.isArray(saved.categories)&&saved.tasks&&typeof saved.tasks==='object'?saved:null;}catch{return null;}}
function persistState(nextState){try{const serialized=JSON.stringify(nextState);localStorage.setItem(BACKUP_STORE,serialized);localStorage.setItem(STORE,serialized);}catch{}}
function loadState(){const primary=readSavedState(STORE);if(primary)return primary;const backup=readSavedState(BACKUP_STORE);if(backup){persistState(backup);return backup;}const initial=seed();persistState(initial);return initial;}
let state=loadState();
const save = () => persistState(state);
if (!state.categories.some(category => category.name === '运动健身')) { state.categories.push({ id:'c4', name:'运动健身', icon:'🏃', time:'18:00', color:4 }); save(); }
const ARCHIVE_MIGRATION = 'pipi-archive-legacy-categories-v1';
if (!localStorage.getItem(ARCHIVE_MIGRATION)) {
  const retiredNames = new Set(['多少', '环境']);
  state.categories = state.categories.map(category => retiredNames.has(category.name) ? { ...category, archived:true } : category);
  save();
  localStorage.setItem(ARCHIVE_MIGRATION, 'true');
}
const existingTemporaryCategory = state.categories.find(category => category.id === 'temp');
if (existingTemporaryCategory && existingTemporaryCategory.color !== TEMPORARY_COLOR_INDEX) { existingTemporaryCategory.color = TEMPORARY_COLOR_INDEX; save(); }
let reportPeriod = 'week', calendarPeriod = 'week', modalMode = null, editCategoryId = null, pickedColor = 0;
let calendarCursor = new Date(), calendarTaskDate = null;
const byId = (id) => document.getElementById(id);
let soundContext, soundUnlockPromise=null, soundPrimed=false;
function getSoundContext(){const AudioContextClass=window.AudioContext||window.webkitAudioContext;if(!AudioContextClass)return null;if(!soundContext||soundContext.state==='closed'){soundContext=new AudioContextClass();soundPrimed=false;}return soundContext;}
function primeSound(context){if(soundPrimed||context?.state!=='running')return;soundPrimed=true;const oscillator=context.createOscillator(),gain=context.createGain(),now=context.currentTime;gain.gain.setValueAtTime(.00001,now);oscillator.connect(gain).connect(context.destination);oscillator.start(now);oscillator.stop(now+.02);}
function scheduleSound(context,kind){const notes={complete:[[659,0,.13],[880,.14,.14],[1047,.3,.24]],undo:[[523,0,.12],[392,.14,.17]],modal:[[587,0,.12],[784,.13,.18]],confirm:[[440,0,.15],[349,.17,.2]],navigate:[[740,0,.1],[988,.11,.15]]}[kind];if(!notes||context.state==='closed')return;const now=context.currentTime+.02,volume=kind==='complete'?.23:kind==='undo'?.18:kind==='navigate'?.16:.18;notes.forEach(([frequency,offset,duration])=>{const oscillator=context.createOscillator(),gain=context.createGain(),start=now+offset;oscillator.type=kind==='complete'||kind==='navigate'?'triangle':'sine';oscillator.frequency.setValueAtTime(frequency,start);gain.gain.setValueAtTime(.0001,start);gain.gain.exponentialRampToValueAtTime(volume,start+.02);gain.gain.exponentialRampToValueAtTime(.0001,start+duration);oscillator.connect(gain).connect(context.destination);oscillator.start(start);oscillator.stop(start+duration+.04);});}
function unlockSound(){try{const context=getSoundContext();if(!context)return Promise.resolve();if(context.state==='running'){primeSound(context);return Promise.resolve();}if(!soundUnlockPromise)soundUnlockPromise=context.resume().then(()=>primeSound(context)).catch(()=>{}).finally(()=>{soundUnlockPromise=null;});return soundUnlockPromise;}catch{return Promise.resolve();}}
function playSound(kind){if(kind==='navigate')return;try{const context=getSoundContext();if(!context)return;scheduleSound(context,kind);if(context.state!=='running')unlockSound();}catch{}}
document.addEventListener('pointerdown',unlockSound,{passive:true,capture:true});
document.addEventListener('touchend',unlockSound,{passive:true,capture:true});
document.addEventListener('keydown',unlockSound,{passive:true,capture:true});
const getCat = (id) => state.categories.find(c => c.id === id);
const colorFor = (id) => PALETTE[getCat(id)?.color ?? 0];
const colorForTask = (task) => PALETTE[task?.categoryId === 'temp' ? TEMPORARY_COLOR_INDEX : (Number.isInteger(task?.color) ? task.color : (getCat(task?.categoryId)?.color ?? 0))];
const taskForDay = (key) => state.tasks[key] || [];
const startDay = (date, monday = true) => { const copy = new Date(date); const offset = monday ? (copy.getDay() + 6) % 7 : copy.getDay(); copy.setDate(copy.getDate()-offset); copy.setHours(0,0,0,0); return copy; };
const addDays = (date, number) => { const copy = new Date(date); copy.setDate(copy.getDate()+number); return copy; };

const WEATHER_LOCATION = { latitude:30.6424, longitude:104.0431, city:'成都·武侯' };
const weatherInfo = (code) => {
  if (code === 0) return { icon:'☀️', label:'晴朗' };
  if ([1, 2].includes(code)) return { icon:'🌤️', label:'晴间多云' };
  if (code === 3) return { icon:'☁️', label:'阴天' };
  if ([45, 48].includes(code)) return { icon:'🌫️', label:'有雾' };
  if ([51, 53, 55, 56, 57].includes(code)) return { icon:'🌦️', label:'可能有毛毛雨' };
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return { icon:'🌧️', label:'可能下雨' };
  if ([71, 73, 75, 77, 85, 86].includes(code)) return { icon:'❄️', label:'可能下雪' };
  if ([95, 96, 99].includes(code)) return { icon:'⛈️', label:'可能有雷雨' };
  return { icon:'🌤️', label:'天气不错' };
};
function nextHourLabel(time){const hour=Number(time.slice(11,13));return `${String((hour+1)%24).padStart(2,'0')}:00`;}
function rainForecastText(hourly, currentTime) {
  const times = hourly?.time || [];
  const upcoming = times.map((time, index) => ({
    time,
    chance: Number(hourly?.precipitation_probability?.[index] ?? 0)
  })).filter(hour => !currentTime || hour.time >= currentTime).slice(0,12);
  if (!upcoming.length) return '未来 12 小时降雨预报暂不可用';
  const highestChance = Math.max(...upcoming.map(hour => hour.chance));
  const firstRainIndex = upcoming.findIndex(hour => hour.chance >= 20);
  if (firstRainIndex < 0) return `未来 12 小时暂无下雨预报（最高 ${highestChance}%）`;
  let lastRainIndex=firstRainIndex;
  while(upcoming[lastRainIndex+1]?.chance>=20)lastRainIndex++;
  const start=upcoming[firstRainIndex].time.slice(11,16),end=upcoming[lastRainIndex+1]?.time.slice(11,16)||nextHourLabel(upcoming[lastRainIndex].time);
  const peak=Math.max(...upcoming.slice(firstRainIndex,lastRainIndex+1).map(hour=>hour.chance));
  return `未来 12 小时：${start}–${end} 有雨，最高 ${peak}%`;
}
function showWeather({ current, hourly }, city) {
  const info = weatherInfo(current?.weather_code);
  const temperature = Math.round(current?.temperature_2m);
  byId('weather-city').textContent = city;
  byId('weather-icon').textContent = info.icon;
  byId('weather-status').textContent = `${info.label} · ${rainForecastText(hourly, current?.time)}`;
  byId('weather-temperature').textContent = Number.isFinite(temperature) ? `${temperature}°` : '--°';
}
function weatherUnavailable() {
  byId('weather-status').textContent = '天气暂时未连接';
}
function loadWeather(location = WEATHER_LOCATION) {
  const { latitude, longitude, city } = location;
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,weather_code&hourly=precipitation_probability&timezone=auto&forecast_days=2`;
  fetch(url).then(response => response.ok ? response.json() : Promise.reject()).then(data => showWeather(data, city)).catch(weatherUnavailable);
}
function startWeather() { loadWeather(); }

function ensureFixedTasks(key) {
  if (key !== dateKey()) return;
  const tasks = state.tasks[key] ||= [];
  const hiddenCategories = state.hiddenFixed?.[key] || [];
  state.categories.forEach(cat => { if (cat.fixed === false || cat.archived || hiddenCategories.includes(cat.id) || tasks.some(t => t.fixed && t.categoryId === cat.id)) return; tasks.push({id:`t${Date.now()}${Math.random()}`,categoryId:cat.id,name:defaultTaskName(cat.name),time:cat.time,done:false,fixed:true}); });
  state.tasks[key] = tasks.filter(t => !t.fixed || getCat(t.categoryId)); save();
}
function defaultTaskName(name) { return ({'内容创作':'完成今日内容创作','项目推进':'推进手头项目','学习充电':'学习与复盘'}[name] || `完成${name}`); }
function formatDateHeader() { const d = new Date(); byId('today-date').textContent = `${zhDate(d)} · 星期${dayName(d)}`; }
function renderToday() {
  ensureFixedTasks(dateKey()); formatDateHeader(); const list = byId('task-list'); const tasks = taskForDay(dateKey()).slice().sort((a,b)=>(Number(a.done)-Number(b.done))||(Number(b.categoryId==='temp')-Number(a.categoryId==='temp'))||a.time.localeCompare(b.time));
  const done = tasks.filter(t=>t.done).length, pct = tasks.length ? Math.round(done/tasks.length*100) : 0;
  byId('progress-number').textContent = `${pct}%`; byId('progress-copy').textContent = pct===100 && tasks.length ? '今天的你闪闪发光！' : pct ? '继续保持这份小小专注' : '慢慢来，也很厉害'; byId('progress-fill').style.width = `${pct}%`; byId('progress-fill').parentElement.setAttribute('aria-valuenow', pct); byId('schedule-count').textContent = tasks.length ? `今天有 ${tasks.length} 件小事等你完成` : '今天还没有安排哦';
  list.innerHTML = tasks.length ? tasks.map(t => { const c=colorForTask(t); return `<article class="task-card ${t.done?'done':''} ${t.categoryId==='temp'?'temporary-task':''}" style="--card-color:${c.color};--task-tint:${c.tint}" data-id="${t.id}"><button class="check" data-action="toggle-task" aria-label="完成工作"></button><div class="task-copy"><span class="task-name">${escapeHtml(t.name)}</span><span class="task-meta">${getCat(t.categoryId)?.icon || '✨'} ${escapeHtml(getCat(t.categoryId)?.name || '临时工作')}${t.fixed?' · 固定':''}</span></div><span class="task-time">${t.time || '全天'}</span></article>`; }).join('') : `<div class="empty-message">今天还没有工作，添加一件开始吧 ✨</div>`;
}
function taskSummary(tasks) { const done=tasks.filter(t=>t.done).length; return `${done}/${tasks.length} 完成`; }
function datesFor(period, anchor = new Date()) { const now=anchor, result=[]; if(period==='week'){ const start=startDay(now); for(let i=0;i<7;i++)result.push(addDays(start,i)); } else { const start=new Date(now.getFullYear(),now.getMonth(),1); const end=new Date(now.getFullYear(),now.getMonth()+1,0).getDate(); for(let i=0;i<end;i++)result.push(addDays(start,i)); } return result; }
function renderCalendar() {
  const isWeek=calendarPeriod==='week', dates=datesFor(calendarPeriod, calendarCursor), all=dates.flatMap(d=>taskForDay(dateKey(d))), done=all.filter(t=>t.done).length;
  const focusDate=isWeek?addDays(startDay(calendarCursor),3):calendarCursor, firstDay=new Date(focusDate.getFullYear(),focusDate.getMonth(),1), weekNumber=Math.ceil((focusDate.getDate()+((firstDay.getDay()+6)%7))/7), label=isWeek?`${focusDate.getMonth()+1} 月第 ${weekNumber} 周`:`${calendarCursor.getFullYear()} 年 ${calendarCursor.getMonth()+1} 月`;
  byId('calendar-title').textContent=isWeek?'看看这一周':'看看这一月'; byId('current-period').textContent=label; byId('current-period').setAttribute('aria-label',isWeek?'回到本周':'回到本月'); byId('previous-period').setAttribute('aria-label',isWeek?'上一周':'上一月'); byId('next-period').setAttribute('aria-label',isWeek?'下一周':'下一月');
  byId('calendar-summary').innerHTML=`<div><b>${all.length}</b><p>${label} · 共安排 ${all.length} 件工作，已完成 ${done} 件</p></div><span>${done===all.length&&all.length?'🌟':'🍡'}</span>`;
  const container=byId('calendar-content');
  const leadingBlanks=isWeek?0:(dates[0].getDay()+6)%7, trailingBlanks=isWeek?0:(7-((leadingBlanks+dates.length)%7))%7;
  const taskBlocks=(tasks)=>tasks.slice().sort((a,b)=>(Number(a.done)-Number(b.done))||(Number(b.categoryId==='temp')-Number(a.categoryId==='temp'))||(a.time||'').localeCompare(b.time||'')).map(t=>{const color=colorForTask(t);return `<div class="month-chip ${t.done?'completed':''} ${t.categoryId==='temp'?'temporary-task':''}" style="--chip:${color.tint};--chip-color:${color.color}"><span>${getCat(t.categoryId)?.icon || '✨'} ${escapeHtml(t.name)}</span><small>${t.time||'全天'}</small></div>`;}).join('');
  container.innerHTML=`<section class="month-board ${isWeek?'week-board':''}"><div class="month-board-head"><b>${isWeek?'本周排期':`${calendarCursor.getMonth()+1} 月排期`}</b><span>点击日期可管理工作</span></div><div class="month-grid visual-calendar-grid">${'<i class="month-blank"></i>'.repeat(leadingBlanks)}${dates.map(d=>{const key=dateKey(d),ts=taskForDay(key);return `<article class="month-day ${key===dateKey()?'today':''}" data-date="${key}"><div class="month-day-head"><b>${d.getDate()}</b><small>周${dayName(d)}</small></div>${ts.length?`<div class="month-chips">${taskBlocks(ts)}</div>`:''}</article>`}).join('')}${'<i class="month-blank"></i>'.repeat(trailingBlanks)}</div></section>`;
}
function reportData(period) { const dates=datesFor(period), tasks=dates.flatMap(d=>taskForDay(dateKey(d))); const total=tasks.length, done=tasks.filter(t=>t.done).length; const groups=state.categories.map(category=>{const cat=category.id==='temp'?{...category,color:TEMPORARY_COLOR_INDEX}:category;return {cat,count:tasks.filter(task=>task.categoryId===cat.id).length,done:tasks.filter(task=>task.categoryId===cat.id&&task.done).length};}).filter(group=>group.count); return {dates,tasks,total,done,groups}; }
function renderReport() { const {total,done,groups}=reportData(reportPeriod), label=reportPeriod==='week'?'本周':'本月', rate=total?Math.round(done/total*100):0; let cursor=0; const pie=groups.map(group=>{const start=cursor, end=cursor+group.count/total*100;cursor=end;return `${PALETTE[group.cat.color].tint} ${start}% ${end}%`;}).join(','); byId('report-content').innerHTML=`<section class="report-hero"><div><p>${label}完成度</p><small>${total?`完成 ${done} 项，还有 ${total-done} 项待续`:'开始记录第一件工作吧'}</small></div><strong>${rate}%</strong></section><section class="report-panel distribution-panel"><div class="distribution-heading"><h3>工作内容分布</h3><span>${label}共 ${total} 项</span></div>${groups.length?`<div class="pie-layout"><div class="pie-chart" style="--pie:conic-gradient(${pie})" role="img" aria-label="工作内容扇形图"></div><p class="pie-caption">${label}工作类目占比</p><div class="pie-legend">${groups.map(group=>`<div><i style="--legend:${PALETTE[group.cat.color].tint}"></i><span>${group.cat.icon} ${escapeHtml(group.cat.name)}</span><b>${group.count} 项 · ${Math.round(group.count/total*100)}%</b></div>`).join('')}</div></div>`:'<div class="empty-message">还没有工作记录，报表会在这里慢慢长出来。</div>'}</section>`; }
function switchView(id) { document.querySelector('.app-shell').classList.toggle('showing-today',id==='today'); document.querySelectorAll('.view').forEach(v=>v.classList.toggle('active',v.id===id)); document.querySelectorAll('.nav-item').forEach(b=>b.classList.toggle('active',b.dataset.view===id)); if(id==='today')renderToday(); if(id==='calendar')renderCalendar();if(id==='report')renderReport(); }
function showModal(mode, item) { modalMode=mode; const category=mode.includes('category')?item:null, task=mode==='edit-task'?item:null; editCategoryId=category?.id||task?.id||null; const isCategory=mode.includes('category'), isCalendarTask=mode==='calendar-task',todayCategoryTask=category?taskForDay(dateKey()).find(candidate=>candidate.fixed&&candidate.categoryId===category.id):null; byId('modal-kicker').textContent=isCategory?'工作类目设置':isCalendarTask?`${calendarTaskDate?.slice(5).replace('-', ' 月 ')} 日 · 日历工作`:'每日工作'; byId('modal-title').textContent=mode==='task'?'添加临时工作':isCalendarTask?'添加工作':mode==='edit-task'?'编辑每日工作':category?'编辑工作类目':'添加工作类目'; if(isCategory) pickedColor=category?.color??0; const form=byId('modal-form');
  if(isCategory) form.innerHTML=`<label class="form-field"><span>类目名称</span><input required name="name" maxlength="18" placeholder="例如：客户沟通" value="${category?escapeAttr(category.name):''}" /></label>${category?`<label class="form-field"><span>今天要做什么？</span><input required name="taskName" maxlength="40" value="${escapeAttr(todayCategoryTask?.name||defaultTaskName(category.name))}" /></label>`:''}<div class="form-grid"><label class="form-field"><span>显示时间</span><input required name="time" type="time" value="${category?.time||'09:00'}" /></label><label class="form-field"><span>可爱图标</span><select name="icon">${ICONS.map(i=>`<option ${category?.icon===i?'selected':''}>${i}</option>`).join('')}</select></label></div><label class="form-field"><span>选择颜色</span><div class="color-options">${PALETTE.map((p,i)=>`<button type="button" class="color-choice ${i===pickedColor?'selected':''}" data-color="${i}" style="background:${p.color}" aria-label="${p.name}"></button>`).join('')}</div></label>${formActions(category?'保存修改':'添加类目')}`;
  else {const startsTemporary=modalMode==='task'&&!task,selectableCategories=state.categories.filter(category=>category.id!=='temp'&&!category.archived&&category.fixed!==false);pickedColor=task?.categoryId==='temp'&&Number.isInteger(task.color)?task.color:(startsTemporary?(getCat('temp')?.color??1):state.categories.length%PALETTE.length);const colorPicker=()=>`<div class="color-options">${PALETTE.map((color,index)=>`<button type="button" class="color-choice ${index===pickedColor?'selected':''}" data-color="${index}" style="background:${color.color}" aria-label="${color.name}"></button>`).join('')}</div>`;const fixedQuestion=`<button type="button" class="fixed-category-button" data-action="toggle-fixed-category" aria-pressed="false"><span>要把这个自定义类目加入固定类目吗？</span><b>暂不加入</b></button><input type="hidden" name="makeFixed" value="false" />`;form.innerHTML=`<label class="form-field"><span>${isCalendarTask?'这天要做什么？':'今天要做什么？'}</span><input required name="name" maxlength="40" autofocus value="${task?escapeAttr(task.name):''}" /></label><div class="form-grid"><label class="form-field"><span>所属类目</span><select required name="categoryId">${selectableCategories.map(c=>`<option value="${c.id}" ${task?.categoryId===c.id?'selected':''}>${c.icon} ${escapeHtml(c.name)}</option>`).join('')}<option value="temporary" ${task?.categoryId==='temp'||startsTemporary?'selected':''}>✨ 临时工作</option><option value="custom-category">＋ 自定义类目</option></select></label><label class="form-field"><span>安排时间</span><input name="time" type="time" value="${task?.time||new Date().toTimeString().slice(0,5)}" /></label></div><div id="custom-category-fields" class="custom-category-fields" hidden><label class="form-field"><span>自定义类目名称</span><input name="customCategoryName" maxlength="18" placeholder="例如：客户沟通" /></label><small id="custom-category-hint" class="category-color-hint"></small><label class="form-field"><span>选择图标</span><select name="customCategoryIcon">${ICONS.map(icon=>`<option value="${icon}">${icon}</option>`).join('')}</select></label><label class="form-field"><span>选择颜色</span>${colorPicker()}</label>${fixedQuestion}</div><div id="temporary-color-fields" class="custom-category-fields" ${startsTemporary||task?.categoryId==='temp'?'':'hidden'}><label class="form-field"><span>临时工作颜色</span>${colorPicker()}</label><small id="temporary-color-hint" class="category-color-hint"></small></div>${formActions(task?'保存修改':isCalendarTask?'添加到日历':'添加到今日')}`;}
  byId('modal').classList.remove('hidden');playSound('modal');
}
function formActions(label){return `<div class="form-actions"><button type="button" class="cancel" data-action="close-modal">取消</button><button class="submit" type="submit">${label}</button></div>`}
function closeModal(){byId('modal').classList.add('hidden');modalMode=null;}
let confirmationResolver=null;
function askConfirm(message){byId('confirm-message').textContent=message;byId('confirmation').classList.remove('hidden');playSound('confirm');return new Promise(resolve=>{confirmationResolver=resolve;});}
function closeConfirmation(accepted){byId('confirmation').classList.add('hidden');if(confirmationResolver){confirmationResolver(accepted);confirmationResolver=null;}}
function selectColor(index){pickedColor=index;document.querySelectorAll('.color-choice').forEach(button=>button.classList.toggle('selected',Number(button.dataset.color)===pickedColor));}
function latestTemporaryColor(name){const target=name.trim();if(!target)return null;const tasks=Object.values(state.tasks).flat().filter(task=>task.categoryId==='temp'&&task.name.trim()===target&&Number.isInteger(task.color));return tasks.length?tasks[tasks.length-1].color:null;}
function handleForm(form){ const data=new FormData(form); if(modalMode==='task'||modalMode==='edit-task'||modalMode==='calendar-task'){const taskName=data.get('name').trim(),taskTime=data.get('time'),makeFixed=data.get('makeFixed')==='true';let cid=data.get('categoryId'),customName=data.get('customCategoryName')?.trim();if(makeFixed){if(!customName){toast('请填写自定义类目名称');return;}const existing=state.categories.find(category=>category.name===customName&&!category.archived);if(existing){existing.time=taskTime;existing.color=pickedColor;existing.fixed=true;cid=existing.id;}else{const category={id:`c${Date.now()}`,name:customName,icon:data.get('customCategoryIcon')||'✨',time:taskTime,color:pickedColor};state.categories.push(category);cid=category.id;}}else if(cid==='custom-category'){if(!customName){toast('请填写自定义类目名称');return;}const existing=state.categories.find(category=>category.name===customName&&!category.archived);if(existing)cid=existing.id;else{const category={id:`c${Date.now()}`,name:customName,icon:data.get('customCategoryIcon')||'✨',time:'',color:pickedColor,fixed:false};state.categories.push(category);cid=category.id;}}if(cid==='temporary'){ const temp=state.categories.find(c=>c.id==='temp'); if(!temp){state.categories.push({id:'temp',name:'临时工作',icon:'✨',time:'',color:1,fixed:false});}cid='temp'; } if(modalMode==='edit-task'){const task=taskForDay(dateKey()).find(t=>t.id===editCategoryId); if(task){task.name=taskName;task.time=taskTime;task.categoryId=cid;if(cid==='temp')task.color=pickedColor;else delete task.color;}} else {const targetDate=modalMode==='calendar-task'?calendarTaskDate:dateKey();const newTask={id:`t${Date.now()}`,categoryId:cid,name:taskName,time:taskTime,done:false,fixed:makeFixed};if(cid==='temp')newTask.color=pickedColor;(state.tasks[targetDate] ||= []).push(newTask);} save();renderToday();if(modalMode==='calendar-task')renderCalendar();toast(makeFixed?'已加入固定类目':modalMode==='edit-task'?'工作已更新':modalMode==='calendar-task'?'工作已添加到日历':'已经放进今天的工作台啦');}
 else {const obj={id:editCategoryId||`c${Date.now()}`,name:data.get('name').trim(),time:data.get('time'),icon:data.get('icon'),color:pickedColor}; if(editCategoryId){state.categories=state.categories.map(c=>c.id===editCategoryId?obj:c); Object.values(state.tasks).flat().filter(t=>t.fixed&&t.categoryId===editCategoryId).forEach(t=>{t.time=obj.time;t.name=defaultTaskName(obj.name)});const todayFixedTask=taskForDay(dateKey()).find(t=>t.fixed&&t.categoryId===editCategoryId);if(todayFixedTask)todayFixedTask.name=data.get('taskName')?.trim()||defaultTaskName(obj.name);}else state.categories.push(obj);save();ensureFixedTasks(dateKey());renderToday();toast(editCategoryId?'类目已更新':'新的工作类目已添加');}closeModal(); }
function deleteCategory(id){const c=getCat(id);if(!c)return;askConfirm(`确定删除「${c.name}」吗？相关固定工作也会移除。`).then(confirmed=>{if(!confirmed)return;state.categories=state.categories.filter(c=>c.id!==id);Object.keys(state.tasks).forEach(k=>state.tasks[k]=state.tasks[k].filter(t=>t.categoryId!==id));save();renderToday();closeModal();toast('工作类目已删除');});}
function toggleTask(id){const t=taskForDay(dateKey()).find(t=>t.id===id);if(t){t.done=!t.done;save();renderToday();playSound(t.done?'complete':'undo');}}
function deleteTask(id){const task=taskForDay(dateKey()).find(t=>t.id===id);if(!task)return;askConfirm(`确定删除「${task.name}」吗？`).then(confirmed=>{if(!confirmed)return;state.tasks[dateKey()]=taskForDay(dateKey()).filter(t=>t.id!==id);save();renderToday();closeModal();toast('这件工作已删除');});}
function showCalendarTaskModal(key){calendarTaskDate=key;showModal('calendar-task');}
function deleteCalendarTask(key,id){const task=taskForDay(key).find(t=>t.id===id);if(!task)return;askConfirm(`确定删除「${task.name}」吗？`).then(confirmed=>{if(!confirmed)return;if(task.fixed){state.hiddenFixed ||= {};const hidden=state.hiddenFixed[key] ||= [];if(!hidden.includes(task.categoryId))hidden.push(task.categoryId);state.categories=state.categories.map(category=>category.id===task.categoryId?{...category,archived:true}:category);}state.tasks[key]=taskForDay(key).filter(t=>t.id!==id);save();renderCalendar();if(key===dateKey())renderToday();closeModal();toast('该日期的工作已删除');});}
function showCalendarDayActions(key){const date=new Date(`${key}T00:00:00`),tasks=taskForDay(key);modalMode='calendar-day-actions';byId('modal-kicker').textContent=`${zhDate(date)} · 周${dayName(date)}`;byId('modal-title').textContent='管理这天的工作';byId('modal-form').innerHTML=`<div class="action-list"><button type="button" data-action="new-calendar-task" data-date="${key}">＋ 添加工作</button>${tasks.map(t=>`<button type="button" data-action="delete-calendar-task" data-date="${key}" data-task-id="${t.id}" class="danger">⌫ 删除「${escapeHtml(t.name)}」</button>`).join('')}</div>${tasks.length?'':'<p class="action-note" style="margin-top:14px">这天还没有工作安排。</p>'}`;byId('modal').classList.remove('hidden');playSound('modal');}
function showTaskActions(id){const task=taskForDay(dateKey()).find(t=>t.id===id);if(!task)return;modalMode='task-actions';editCategoryId=id;byId('modal-kicker').textContent='双击菜单';byId('modal-title').textContent=task.fixed?'管理固定工作':'管理这件工作';const form=byId('modal-form');const category=getCat(task.categoryId);form.innerHTML=task.fixed&&category?`<p class="action-note">「${escapeHtml(task.name)}」来自工作类目「${escapeHtml(category.name)}」。</p><div class="action-list"><button type="button" data-action="edit-category" data-id="${category.id}">✎ 编辑工作类目</button><button type="button" data-action="delete-category" data-id="${category.id}" class="danger">⌫ 删除工作类目</button></div>`:`<p class="action-note">你可以修改内容或移除这件临时工作。</p><div class="action-list"><button type="button" data-action="edit-task" data-task-id="${task.id}">✎ 编辑工作</button><button type="button" data-action="delete-task" data-task-id="${task.id}" class="danger">⌫ 删除工作</button></div>`;byId('modal').classList.remove('hidden');playSound('modal');}
function toast(message){const el=byId('toast');el.textContent=message;el.classList.add('show');setTimeout(()=>el.classList.remove('show'),1900)}
function escapeHtml(s=''){return String(s).replace(/[&<>'"]/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]));}function escapeAttr(s=''){return escapeHtml(s);}
document.addEventListener('click',e=>{const action=e.target.closest('[data-action]')?.dataset.action;if(action==='new-task')showModal('task');if(action==='new-calendar-task')showCalendarTaskModal(e.target.closest('[data-date]').dataset.date);if(action==='delete-calendar-task')deleteCalendarTask(e.target.closest('[data-date]').dataset.date,e.target.closest('[data-task-id]').dataset.taskId);if(action==='toggle-task')toggleTask(e.target.closest('.task-card').dataset.id);if(action==='edit-category')showModal('category',getCat(e.target.closest('[data-id]').dataset.id));if(action==='delete-category')deleteCategory(e.target.closest('[data-id]').dataset.id);if(action==='new-category')showModal('category');if(action==='edit-task')showModal('edit-task',taskForDay(dateKey()).find(t=>t.id===e.target.closest('[data-task-id]').dataset.taskId));if(action==='delete-task')deleteTask(e.target.closest('[data-task-id]').dataset.taskId);if(action==='close-modal')closeModal();if(action==='toggle-fixed-category'){const button=e.target.closest('[data-action="toggle-fixed-category"]'),enabled=button.getAttribute('aria-pressed')!=='true';button.setAttribute('aria-pressed',String(enabled));button.classList.toggle('selected',enabled);button.querySelector('b').textContent=enabled?'加入所属类目':'暂不加入';button.parentElement.querySelector('input[name="makeFixed"]').value=String(enabled);}if(!action){const day=e.target.closest('.month-day, .week-day-row');if(day)showCalendarDayActions(day.dataset.date);}if(e.target.matches('.color-choice'))selectColor(Number(e.target.dataset.color));});
document.addEventListener('change',e=>{if(e.target.name!=='categoryId')return;const customFields=byId('custom-category-fields'),temporaryFields=byId('temporary-color-fields');if(!customFields||!temporaryFields)return;const isCustom=e.target.value==='custom-category',isTemporary=e.target.value==='temporary';customFields.hidden=!isCustom;temporaryFields.hidden=!isTemporary;customFields.querySelector('input[name="customCategoryName"]').required=isCustom;if(isCustom)customFields.querySelector('input[name="customCategoryName"]').focus();if(isTemporary){const priorColor=latestTemporaryColor(e.target.form?.elements.name?.value||'');const temporaryCategory=getCat('temp');selectColor(Number.isInteger(priorColor)?priorColor:(temporaryCategory?.color??1));byId('temporary-color-hint').textContent=Number.isInteger(priorColor)?'已选中同名临时工作上次使用的颜色':'';}});
document.addEventListener('input',e=>{if(e.target.name==='customCategoryName'){const category=state.categories.find(item=>item.name===e.target.value.trim());const hint=byId('custom-category-hint');if(category){selectColor(category.color);hint.textContent=`已找到同名类目，已选中「${category.name}」之前的颜色`; }else hint.textContent='';}if(e.target.name==='name'){const categorySelect=e.target.form?.elements.categoryId;if(categorySelect?.value!=='temporary')return;const color=latestTemporaryColor(e.target.value);const hint=byId('temporary-color-hint');if(Number.isInteger(color)){selectColor(color);hint.textContent='已选中同名临时工作上次使用的颜色';}else hint.textContent='';}});
document.addEventListener('dblclick',e=>{const card=e.target.closest('.task-card');if(!card||e.target.closest('[data-action="toggle-task"]'))return;e.preventDefault();showTaskActions(card.dataset.id);});
window.addEventListener('pagehide',save);
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')save();});
document.querySelectorAll('.nav-item').forEach(b=>b.addEventListener('click',()=>{playSound('navigate');switchView(b.dataset.view);}));document.querySelectorAll('.report-switch').forEach(b=>b.addEventListener('click',()=>{reportPeriod=b.dataset.reportPeriod;document.querySelectorAll('.report-switch').forEach(x=>x.classList.toggle('active',x===b));renderReport();}));document.querySelectorAll('.calendar-switch-button').forEach(b=>b.addEventListener('click',()=>{calendarPeriod=b.dataset.calendarPeriod;calendarCursor=calendarPeriod==='week'?startDay(new Date()):new Date(new Date().getFullYear(),new Date().getMonth(),1);document.querySelectorAll('.calendar-switch-button').forEach(x=>x.classList.toggle('active',x===b));renderCalendar();}));byId('previous-period').addEventListener('click',()=>{calendarCursor=calendarPeriod==='week'?addDays(calendarCursor,-7):new Date(calendarCursor.getFullYear(),calendarCursor.getMonth()-1,1);renderCalendar();});byId('next-period').addEventListener('click',()=>{calendarCursor=calendarPeriod==='week'?addDays(calendarCursor,7):new Date(calendarCursor.getFullYear(),new Date().getMonth()+1,1);renderCalendar();});byId('current-period').addEventListener('click',()=>{calendarCursor=calendarPeriod==='week'?startDay(new Date()):new Date(new Date().getFullYear(),new Date().getMonth(),1);renderCalendar();});byId('close-modal').addEventListener('click',closeModal);byId('modal').addEventListener('click',e=>{if(e.target===byId('modal'))closeModal();});byId('modal-form').addEventListener('submit',e=>{e.preventDefault();handleForm(e.currentTarget)});byId('cancel-confirmation').addEventListener('click',()=>closeConfirmation(false));byId('accept-confirmation').addEventListener('click',()=>closeConfirmation(true));byId('confirmation').addEventListener('click',e=>{if(e.target===byId('confirmation'))closeConfirmation(false);});
renderToday();
requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(() => byId('launch-splash')?.classList.add('is-hidden'),120)));
const runWhenIdle = callback => window.requestIdleCallback ? window.requestIdleCallback(callback,{timeout:1200}) : setTimeout(callback,350);
runWhenIdle(startWeather);
if ('serviceWorker' in navigator && window.isSecureContext) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
}
