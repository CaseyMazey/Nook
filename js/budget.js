// =========================
// BUDGET
// =========================

let budgetRecurring = DB.get('budgetRecurring', []);
let budgetOnetime   = DB.get('budgetOnetime', []);
let budgetGoals     = DB.get('budgetGoals', []);
let budgetMonth     = new Date();
let kontostand      = DB.get('kontostand', null); // null = not set yet

function saveBudgetRecurring(){ DB.set('budgetRecurring', budgetRecurring); }
function saveBudgetOnetime(){   DB.set('budgetOnetime',   budgetOnetime);   }
function saveBudgetGoals(){     DB.set('budgetGoals',     budgetGoals);     }

function budgetMonthKey(date){
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}`;
}
function budgetMonthLabel(date){
  return date.toLocaleDateString('de-DE',{month:'long',year:'numeric'});
}
function getRecurringForMonth(date){
  const m=date.getMonth()+1;
  return budgetRecurring.filter(r=>{
    if(r.freq==='monthly') return true;
    if(r.freq==='yearly')  return r.dateMonth===m;
    return false;
  });
}

function renderBudget(){
  const now=new Date();
  const monthRec=getRecurringForMonth(now);
  const recIncome  = monthRec.filter(r=>r.type==='income') .reduce((s,r)=>s+r.amount,0);
  const recExpense = monthRec.filter(r=>r.type==='expense').reduce((s,r)=>s+r.amount,0);
  const mk=budgetMonthKey(now);
  const otIncome  = budgetOnetime.filter(e=>e.monthKey===mk&&e.type==='income') .reduce((s,e)=>s+e.amount,0);
  const otExpense = budgetOnetime.filter(e=>e.monthKey===mk&&e.type==='expense').reduce((s,e)=>s+e.amount,0);
  const totalIn=recIncome+otIncome, totalOut=recExpense+otExpense, balance=totalIn-totalOut;

  document.getElementById('budget-summary-bar').innerHTML=`
    <div class="budget-summary-grid">
      <div class="budget-stat income">
        <div class="budget-stat-label">Einnahmen &middot; ${budgetMonthLabel(now)}</div>
        <div class="budget-stat-value">+${totalIn.toFixed(2)} &euro;</div>
      </div>
      <div class="budget-stat expense">
        <div class="budget-stat-label">Ausgaben &middot; ${budgetMonthLabel(now)}</div>
        <div class="budget-stat-value">-${totalOut.toFixed(2)} &euro;</div>
      </div>
      <div class="budget-stat ${balance>=0?'positive':'negative'}">
        <div class="budget-stat-label">Verfügbar</div>
        <div class="budget-stat-value">${balance>=0?'+':''}${balance.toFixed(2)} &euro;</div>
      </div>
    </div>`;

  document.getElementById('budget-month-label').textContent=budgetMonthLabel(budgetMonth);

  // One-time list
  const viewMk=budgetMonthKey(budgetMonth);
  const onetimeList=document.getElementById('budget-onetime-list');
  onetimeList.innerHTML='';
  const otEntries=budgetOnetime.filter(e=>e.monthKey===viewMk);
  if(otEntries.length===0){
    onetimeList.innerHTML='<div class="empty-state">Keine einmaligen Buchungen in diesem Monat.</div>';
  } else {
    otEntries.forEach(e=>onetimeList.appendChild(makeBudgetRow(e.name,e.amount,e.type,()=>{
      budgetOnetime=budgetOnetime.filter(x=>x.id!==e.id); saveBudgetOnetime(); renderBudget();
    })));
  }

  // Recurring list
  const recList=document.getElementById('budget-recurring-list');
  recList.innerHTML='';
  if(budgetRecurring.length===0){
    recList.innerHTML='<div class="empty-state">Noch keine wiederkehrenden Posten.</div>';
  } else {
    budgetRecurring.forEach(r=>{
      const sub=r.freq==='monthly'
        ? `jeden ${r.day}.`
        : `${r.dateDay}.${String(r.dateMonth).padStart(2,'0')}. \u00b7 j\u00e4hrlich`;
      recList.appendChild(makeBudgetRow(r.name,r.amount,r.type,()=>{
        budgetRecurring=budgetRecurring.filter(x=>x.id!==r.id); saveBudgetRecurring(); renderBudget();
      },sub));
    });
  }

  renderBudgetTimeline();
  renderBudgetGoals();
  renderLiquidity();
}

// =========================
// LIQUIDITY FORECAST
// =========================

function getMonthRecurringItems(year, month) {
  // Returns all recurring items that fire in given month (month = 1-12)
  return budgetRecurring.filter(r => {
    if (r.freq === 'monthly') return true;
    if (r.freq === 'yearly')  return r.dateMonth === month;
    return false;
  }).map(r => {
    const day = r.freq === 'monthly' ? r.day : r.dateDay;
    return { name: r.name, type: r.type, amount: r.amount, day };
  });
}

function renderLiquidity() {
  const container = document.getElementById('budget-liquidity');
  container.innerHTML = '';

  // Kontostand bar — always shown
  const kBar = document.createElement('div');
  kBar.className = 'liquidity-kontostand-bar';

  if (kontostand === null) {
    kBar.innerHTML = `
      <span class="liquidity-kontostand-label">Kontostand nicht gesetzt</span>
      <button class="btn-ghost liquidity-edit-btn" id="kontostand-edit-btn" style="font-size:12px;padding:4px 12px;">Kontostand eingeben</button>`;
  } else {
    kBar.innerHTML = `
      <span class="liquidity-kontostand-label">Kontostand</span>
      <span class="liquidity-kontostand-value" style="color:${kontostand>=0?'var(--budget-income)':'var(--budget-expense)'}">
        ${kontostand>=0?'+':''}${kontostand.toFixed(2)} €
      </span>
      <button class="btn-ghost liquidity-edit-btn" id="kontostand-edit-btn" style="font-size:12px;padding:4px 12px;">Anpassen</button>`;
  }
  container.appendChild(kBar);
  document.getElementById('kontostand-edit-btn').addEventListener('click', openKontostandModal);

  if (kontostand === null || budgetRecurring.length === 0) return;

  const now = new Date();
  const todayDay = now.getDate();
  const curMonth = now.getMonth() + 1;
  const curYear  = now.getFullYear();

  // Next month
  const nextMonthDate = new Date(curYear, now.getMonth() + 1, 1);
  const nextMonth = nextMonthDate.getMonth() + 1;
  const nextYear  = nextMonthDate.getFullYear();

  // --- Current month: items still pending (day >= today) ---
  const curItems = getMonthRecurringItems(curYear, curMonth);

  // Also add this month's one-time entries
  const curMk = budgetMonthKey(now);
  const curOneTime = budgetOnetime.filter(e => e.monthKey === curMk);

  let curPendingIncome  = 0;
  let curPendingExpense = 0;
  curItems.forEach(item => {
    if (item.day >= todayDay) {
      if (item.type === 'income')   curPendingIncome  += item.amount;
      else                          curPendingExpense += item.amount;
    }
  });
  // One-time entries this month always count as pending (we don't track if paid)
  curOneTime.forEach(e => {
    if (e.type === 'income')  curPendingIncome  += e.amount;
    else                      curPendingExpense += e.amount;
  });

  const endOfMonth = kontostand + curPendingIncome - curPendingExpense;

  // --- Next month: find first income day (= salary threshold) ---
  const nextItems = getMonthRecurringItems(nextYear, nextMonth);
  const nextIncomes  = nextItems.filter(i => i.type === 'income').sort((a,b) => a.day - b.day);
  const nextExpenses = nextItems.filter(i => i.type === 'expense');

  // Expenses BEFORE first income in next month
  const firstIncomeDay = nextIncomes.length > 0 ? nextIncomes[0].day : 31;
  const expensesBeforeSalary = nextExpenses
    .filter(i => i.day < firstIncomeDay)
    .reduce((s, i) => s + i.amount, 0);

  const canAfford = endOfMonth >= expensesBeforeSalary;
  const gap = endOfMonth - expensesBeforeSalary;

  // Build the two forecast cards
  const grid = document.createElement('div');
  grid.className = 'liquidity-grid';

  // Card 1: This month
  const card1 = document.createElement('div');
  card1.className = 'liquidity-card';
  card1.innerHTML = `
    <div class="liquidity-card-title">Dieser Monat</div>
    <div class="liquidity-row">
      <span class="liquidity-row-label">Kontostand jetzt</span>
      <span class="liquidity-row-value">${fmtEur(kontostand)}</span>
    </div>
    <div class="liquidity-row">
      <span class="liquidity-row-label">Noch eingehend</span>
      <span class="liquidity-row-value income">+${curPendingIncome.toFixed(2)} €</span>
    </div>
    <div class="liquidity-row">
      <span class="liquidity-row-label">Noch ausgehend</span>
      <span class="liquidity-row-value expense">-${curPendingExpense.toFixed(2)} €</span>
    </div>
    <div class="liquidity-divider"></div>
    <div class="liquidity-row liquidity-row-total">
      <span class="liquidity-row-label">Voraussichtlich Ende ${now.toLocaleDateString('de-DE',{month:'long'})}</span>
      <span class="liquidity-row-value ${endOfMonth>=0?'income':'expense'}">${fmtEur(endOfMonth)}</span>
    </div>`;

  // Card 2: Next month
  const card2 = document.createElement('div');
  card2.className = `liquidity-card ${canAfford ? 'liquidity-ok' : 'liquidity-warn'}`;

  const nextMonthName = nextMonthDate.toLocaleDateString('de-DE', {month:'long'});
  const expensesList = nextExpenses.filter(i=>i.day<firstIncomeDay)
    .map(i=>`<div class="liquidity-expense-item"><span>${i.name}</span><span class="expense">-${i.amount.toFixed(2)} €</span></div>`).join('');

  card2.innerHTML = `
    <div class="liquidity-card-title">
      ${nextMonthName}
      <span class="liquidity-status-badge ${canAfford?'ok':'warn'}">${canAfford ? '✓ Ausreichend' : '⚠ Puffer fehlt'}</span>
    </div>
    <div class="liquidity-row">
      <span class="liquidity-row-label">Du startest mit</span>
      <span class="liquidity-row-value ${endOfMonth>=0?'income':'expense'}">${fmtEur(endOfMonth)}</span>
    </div>
    <div class="liquidity-row">
      <span class="liquidity-row-label">Ausgaben vor ${firstIncomeDay>28?'Monatsende':'Tag '+firstIncomeDay} (vor Gehalt)</span>
      <span class="liquidity-row-value expense">-${expensesBeforeSalary.toFixed(2)} €</span>
    </div>
    ${expensesList ? `<div class="liquidity-expense-list">${expensesList}</div>` : ''}
    <div class="liquidity-divider"></div>
    <div class="liquidity-row liquidity-row-total">
      <span class="liquidity-row-label">${canAfford ? 'Puffer nach Ausgaben' : 'Fehlender Betrag'}</span>
      <span class="liquidity-row-value ${canAfford?'income':'expense'}">${canAfford?'+':''}${gap.toFixed(2)} €</span>
    </div>
    ${!canAfford ? `<div class="liquidity-hint">Du brauchst mindestens <strong>${expensesBeforeSalary.toFixed(2)} €</strong> aus ${now.toLocaleDateString('de-DE',{month:'long'})} rüberretten.</div>` : ''}`;

  grid.append(card1, card2);
  container.appendChild(grid);
}

function fmtEur(amount) {
  return (amount >= 0 ? '+' : '') + amount.toFixed(2) + ' €';
}

// Kontostand Modal
function openKontostandModal() {
  document.getElementById('kontostand-input').value = kontostand !== null ? kontostand.toFixed(2) : '';
  document.getElementById('kontostand-modal-overlay').classList.remove('hidden');
  setTimeout(() => document.getElementById('kontostand-input').focus(), 50);
}

document.getElementById('kontostand-modal-close').addEventListener('click', () =>
  document.getElementById('kontostand-modal-overlay').classList.add('hidden'));
document.getElementById('kontostand-cancel').addEventListener('click', () =>
  document.getElementById('kontostand-modal-overlay').classList.add('hidden'));
document.getElementById('kontostand-modal-overlay').addEventListener('click', e => {
  if (e.target === document.getElementById('kontostand-modal-overlay'))
    document.getElementById('kontostand-modal-overlay').classList.add('hidden');
});
document.getElementById('kontostand-save').addEventListener('click', () => {
  const val = parseFloat(document.getElementById('kontostand-input').value);
  if (isNaN(val)) return;
  kontostand = val;
  DB.set('kontostand', kontostand);
  document.getElementById('kontostand-modal-overlay').classList.add('hidden');
  renderBudget();
});

function makeBudgetRow(name,amount,type,onDel,subtitle){
  const row=document.createElement('div'); row.className='budget-row';
  const left=document.createElement('div'); left.className='budget-row-left';
  const nm=document.createElement('span'); nm.className='budget-row-name'; nm.textContent=name;
  left.appendChild(nm);
  if(subtitle){const sub=document.createElement('span');sub.className='budget-row-sub';sub.textContent=subtitle;left.appendChild(sub);}
  const right=document.createElement('div'); right.className='budget-row-right';
  const amt=document.createElement('span'); amt.className='budget-row-amount';
  amt.textContent=(type==='income'?'+':'-')+amount.toFixed(2)+' \u20ac';
  amt.style.color=type==='income'?'var(--budget-income)':'var(--budget-expense)';
  const del=document.createElement('button'); del.className='task-delete'; del.textContent='\u2715';
  del.addEventListener('click',onDel);
  right.append(amt,del); row.append(left,right); return row;
}

function renderBudgetTimeline(){
  const tl=document.getElementById('budget-timeline'); tl.innerHTML='';
  const now=new Date(); now.setHours(0,0,0,0);
  const upcoming=[];
  for(let offset=0;offset<60;offset++){
    const d=new Date(now); d.setDate(now.getDate()+offset);
    const dy=d.getDate(), dm=d.getMonth()+1;
    budgetRecurring.forEach(r=>{
      let match=false;
      if(r.freq==='monthly'&&r.day===dy) match=true;
      if(r.freq==='yearly'&&r.dateDay===dy&&r.dateMonth===dm) match=true;
      if(match) upcoming.push({date:new Date(d),name:r.name,amount:r.amount,type:r.type});
    });
  }
  upcoming.sort((a,b)=>a.date-b.date).slice(0,8).forEach(item=>{
    const row=document.createElement('div'); row.className='budget-timeline-row';
    const ds=document.createElement('span'); ds.className='budget-timeline-date';
    ds.textContent=item.date.toLocaleDateString('de-DE',{day:'numeric',month:'short'});
    const nm=document.createElement('span'); nm.className='budget-timeline-name'; nm.textContent=item.name;
    const am=document.createElement('span'); am.className='budget-timeline-amount';
    am.textContent=(item.type==='income'?'+':'-')+item.amount.toFixed(2)+' \u20ac';
    am.style.color=item.type==='income'?'var(--budget-income)':'var(--budget-expense)';
    row.append(ds,nm,am); tl.appendChild(row);
  });
  if(upcoming.length===0) tl.innerHTML='<div class="empty-state">Keine bevorstehenden Buchungen.</div>';
}

function renderBudgetGoals(){
  const container=document.getElementById('budget-goals-list'); container.innerHTML='';
  if(budgetGoals.length===0){container.innerHTML='<div class="empty-state">Noch keine Sparziele.</div>';return;}
  budgetGoals.forEach(goal=>{
    const pct=goal.target>0?Math.min(100,Math.round((goal.current/goal.target)*100)):0;
    const card=document.createElement('div'); card.className='budget-goal-card';
    const head=document.createElement('div'); head.className='budget-goal-head';
    const nm=document.createElement('span'); nm.className='budget-row-name'; nm.textContent=goal.name;
    const del=document.createElement('button'); del.className='task-delete'; del.textContent='\u2715'; del.style.opacity='0';
    card.addEventListener('mouseenter',()=>del.style.opacity='1');
    card.addEventListener('mouseleave',()=>del.style.opacity='0');
    del.addEventListener('click',()=>{budgetGoals=budgetGoals.filter(g=>g.id!==goal.id);saveBudgetGoals();renderBudgetGoals();});
    head.append(nm,del);
    const bar=document.createElement('div'); bar.className='budget-goal-bar';
    const fill=document.createElement('div'); fill.className='budget-goal-fill'; fill.style.width=pct+'%';
    bar.appendChild(fill);
    const info=document.createElement('div'); info.className='budget-goal-info-row';
    const txt=document.createElement('span');
    txt.style.cssText='font-size:12px;color:var(--text-3);font-family:var(--mono);';
    txt.textContent=`${goal.current.toFixed(2)} \u20ac / ${goal.target.toFixed(2)} \u20ac (${pct}%)`;
    const btns=document.createElement('div'); btns.style.cssText='display:flex;gap:6px;';
    const dep=document.createElement('button'); dep.className='btn-ghost'; dep.style.cssText='font-size:11px;padding:3px 10px;'; dep.textContent='Einzahlen';
    dep.addEventListener('click',()=>openGoalTx(goal,'deposit'));
    const wit=document.createElement('button'); wit.className='btn-ghost'; wit.style.cssText='font-size:11px;padding:3px 10px;'; wit.textContent='Abheben';
    wit.addEventListener('click',()=>openGoalTx(goal,'withdraw'));
    btns.append(dep,wit); info.append(txt,btns);
    card.append(head,bar,info); container.appendChild(card);
  });
}

document.getElementById('budget-month-prev').addEventListener('click',()=>{
  budgetMonth=new Date(budgetMonth.getFullYear(),budgetMonth.getMonth()-1,1); renderBudget();
});
document.getElementById('budget-month-next').addEventListener('click',()=>{
  budgetMonth=new Date(budgetMonth.getFullYear(),budgetMonth.getMonth()+1,1); renderBudget();
});

// RECURRING MODAL
let recurringType='income', recurringFreq='monthly';

document.getElementById('add-recurring-btn').addEventListener('click',()=>{
  ['recurring-name','recurring-amount','recurring-day','recurring-date-day','recurring-date-month'].forEach(id=>document.getElementById(id).value='');
  recurringType='income'; recurringFreq='monthly';
  ['income','expense'].forEach(t=>document.getElementById(`recurring-type-${t}`).classList.toggle('active',t==='income'));
  ['monthly','yearly'].forEach(f=>document.getElementById(`recurring-freq-${f}`).classList.toggle('active',f==='monthly'));
  document.getElementById('recurring-day-row').classList.remove('hidden');
  document.getElementById('recurring-date-row').classList.add('hidden');
  document.getElementById('recurring-modal-overlay').classList.remove('hidden');
  setTimeout(()=>document.getElementById('recurring-name').focus(),50);
});

['income','expense'].forEach(t=>{
  document.getElementById(`recurring-type-${t}`).addEventListener('click',()=>{
    recurringType=t;
    ['income','expense'].forEach(x=>document.getElementById(`recurring-type-${x}`).classList.toggle('active',x===t));
  });
});
['monthly','yearly'].forEach(f=>{
  document.getElementById(`recurring-freq-${f}`).addEventListener('click',()=>{
    recurringFreq=f;
    ['monthly','yearly'].forEach(x=>document.getElementById(`recurring-freq-${x}`).classList.toggle('active',x===f));
    document.getElementById('recurring-day-row').classList.toggle('hidden',f!=='monthly');
    document.getElementById('recurring-date-row').classList.toggle('hidden',f!=='yearly');
  });
});

document.getElementById('recurring-modal-close').addEventListener('click',()=>document.getElementById('recurring-modal-overlay').classList.add('hidden'));
document.getElementById('recurring-cancel').addEventListener('click',()=>document.getElementById('recurring-modal-overlay').classList.add('hidden'));
document.getElementById('recurring-modal-overlay').addEventListener('click',e=>{if(e.target===document.getElementById('recurring-modal-overlay'))document.getElementById('recurring-modal-overlay').classList.add('hidden');});

document.getElementById('recurring-save').addEventListener('click',()=>{
  const name=document.getElementById('recurring-name').value.trim(); if(!name) return;
  const amount=parseFloat(document.getElementById('recurring-amount').value)||0;
  const entry={id:crypto.randomUUID(),name,type:recurringType,amount,freq:recurringFreq};
  if(recurringFreq==='monthly') entry.day=parseInt(document.getElementById('recurring-day').value)||1;
  else { entry.dateDay=parseInt(document.getElementById('recurring-date-day').value)||1; entry.dateMonth=parseInt(document.getElementById('recurring-date-month').value)||1; }
  budgetRecurring.push(entry); saveBudgetRecurring();
  document.getElementById('recurring-modal-overlay').classList.add('hidden');
  renderBudget();
});

// ONE-TIME MODAL
let onetimeType='expense';

document.getElementById('add-onetime-btn').addEventListener('click',()=>{
  document.getElementById('onetime-name').value=''; document.getElementById('onetime-amount').value='';
  onetimeType='expense';
  ['income','expense'].forEach(t=>document.getElementById(`onetime-type-${t}`).classList.toggle('active',t==='expense'));
  document.getElementById('onetime-modal-overlay').classList.remove('hidden');
  setTimeout(()=>document.getElementById('onetime-name').focus(),50);
});

['income','expense'].forEach(t=>{
  document.getElementById(`onetime-type-${t}`).addEventListener('click',()=>{
    onetimeType=t;
    ['income','expense'].forEach(x=>document.getElementById(`onetime-type-${x}`).classList.toggle('active',x===t));
  });
});

document.getElementById('onetime-modal-close').addEventListener('click',()=>document.getElementById('onetime-modal-overlay').classList.add('hidden'));
document.getElementById('onetime-cancel').addEventListener('click',()=>document.getElementById('onetime-modal-overlay').classList.add('hidden'));
document.getElementById('onetime-modal-overlay').addEventListener('click',e=>{if(e.target===document.getElementById('onetime-modal-overlay'))document.getElementById('onetime-modal-overlay').classList.add('hidden');});

document.getElementById('onetime-save').addEventListener('click',()=>{
  const name=document.getElementById('onetime-name').value.trim(); if(!name) return;
  const amount=parseFloat(document.getElementById('onetime-amount').value)||0;
  budgetOnetime.push({id:crypto.randomUUID(),name,type:onetimeType,amount,monthKey:budgetMonthKey(budgetMonth)});
  saveBudgetOnetime();
  document.getElementById('onetime-modal-overlay').classList.add('hidden');
  renderBudget();
});

// GOAL MODALS
document.getElementById('add-goal-btn').addEventListener('click',()=>{
  document.getElementById('goal-name').value=''; document.getElementById('goal-target').value='';
  document.getElementById('goal-modal-overlay').classList.remove('hidden');
  setTimeout(()=>document.getElementById('goal-name').focus(),50);
});
document.getElementById('goal-modal-close').addEventListener('click',()=>document.getElementById('goal-modal-overlay').classList.add('hidden'));
document.getElementById('goal-cancel').addEventListener('click',()=>document.getElementById('goal-modal-overlay').classList.add('hidden'));
document.getElementById('goal-modal-overlay').addEventListener('click',e=>{if(e.target===document.getElementById('goal-modal-overlay'))document.getElementById('goal-modal-overlay').classList.add('hidden');});
document.getElementById('goal-save').addEventListener('click',()=>{
  const name=document.getElementById('goal-name').value.trim(); if(!name) return;
  const target=parseFloat(document.getElementById('goal-target').value)||0;
  budgetGoals.push({id:crypto.randomUUID(),name,target,current:0});
  saveBudgetGoals(); document.getElementById('goal-modal-overlay').classList.add('hidden'); renderBudgetGoals();
});

let goalTxTarget=null, goalTxMode='deposit';
function openGoalTx(goal,mode){
  goalTxTarget=goal; goalTxMode=mode;
  document.getElementById('goal-tx-title').textContent=mode==='deposit'?`Einzahlen \u2014 ${goal.name}`:`Abheben \u2014 ${goal.name}`;
  document.getElementById('goal-tx-amount').value='';
  document.getElementById('goal-tx-modal-overlay').classList.remove('hidden');
  setTimeout(()=>document.getElementById('goal-tx-amount').focus(),50);
}
document.getElementById('goal-tx-close').addEventListener('click',()=>document.getElementById('goal-tx-modal-overlay').classList.add('hidden'));
document.getElementById('goal-tx-cancel').addEventListener('click',()=>document.getElementById('goal-tx-modal-overlay').classList.add('hidden'));
document.getElementById('goal-tx-modal-overlay').addEventListener('click',e=>{if(e.target===document.getElementById('goal-tx-modal-overlay'))document.getElementById('goal-tx-modal-overlay').classList.add('hidden');});
document.getElementById('goal-tx-save').addEventListener('click',()=>{
  if(!goalTxTarget) return;
  const amt=parseFloat(document.getElementById('goal-tx-amount').value)||0;
  goalTxTarget.current=Math.max(0,goalTxMode==='deposit'?goalTxTarget.current+amt:goalTxTarget.current-amt);
  saveBudgetGoals(); document.getElementById('goal-tx-modal-overlay').classList.add('hidden'); renderBudgetGoals(); goalTxTarget=null;
});


