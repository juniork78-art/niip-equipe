const $ = s => document.querySelector(s);
const demo = !window.NIIP_CONFIG?.firebase;
let items = [], user = null, db, auth, api, unsubscribe, view = 'all', editing = null, openedRecord = null;
const key = 'niip-demo-v1';
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const today = () => { const d=new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };
const late = x => x.type === 'reminder' && !x.done && x.due && x.due < today();
// Compatibilidade com comandos antigos criados antes de existir o campo category.
const categoryOf = x => x.category || (['Comandos de rede (tudo que o técnico precisa)', 'Instalar Wine 11 Stable no Debian 13 (Trixie)'].includes(String(x.title || '').trim()) ? 'commands' : '');
const date = d => d ? new Date(d+'T12:00:00').toLocaleDateString('pt-BR') : 'Sem prazo';
let timer;
function toast(message){ $('#toast').textContent=message; $('#toast').style.display='block';clearTimeout(timer);timer=setTimeout(()=>$('#toast').style.display='none',5000); }
function render(){
 $('#open-count').textContent=items.filter(x=>x.type==='reminder'&&!x.done).length;
 $('#late-count').textContent=items.filter(late).length;
 $('#notes-count').textContent=items.filter(x=>x.type==='note'&&!['commands','tutorials'].includes(categoryOf(x))).length;
 $('#done-count').textContent=items.filter(x=>x.done).length;
 const selected=$('#pop-filter').value;
 $('#pop-filter').innerHTML='<option value="">Todos os POPs / setores</option>'+[...new Set(items.map(x=>x.pop))].sort().map(x=>`<option>${esc(x)}</option>`).join('');
 $('#pop-filter').value=selected;
 const search=$('#search').value.toLocaleLowerCase('pt-BR');
 const data=items.filter(x=>(view==='done'?x.done&&!['commands','tutorials'].includes(categoryOf(x)):view==='all'?!x.done&&!['commands','tutorials'].includes(categoryOf(x)):['commands','tutorials'].includes(view)?!x.done&&categoryOf(x)===view:!x.done&&x.type===view&&!['commands','tutorials'].includes(categoryOf(x)))&&(!selected||x.pop===selected)&&(!$('#priority-filter').value||x.priority===$('#priority-filter').value)&&[x.title,x.body,x.pop,x.assignee].join(' ').toLocaleLowerCase('pt-BR').includes(search)).sort((a,b)=>Number(late(b))-Number(late(a))||(a.due||'9999').localeCompare(b.due||'9999')||b.createdMs-a.createdMs);
 $('#result-count').textContent=`${data.length} registro${data.length===1?'':'s'}`;
 if(['commands','tutorials'].includes(view)){
  $('#records').innerHTML=data.length?data.map(x=>`<article class="card record-card simple-command" data-open-record="${esc(x.id)}" tabindex="0" role="button" aria-label="Abrir ${esc(x.title)}"><h3>${esc(x.title)}</h3></article>`).join(''):'<div class="empty"><strong>Nenhum '+(view==='commands'?'comando':'tutorial')+' cadastrado</strong><p>Use o botão acima para adicionar.</p></div>';
 }else{
  $('#records').innerHTML=data.length?data.map(x=>`<article class="card record-card" data-open-record="${esc(x.id)}" tabindex="0" role="button" aria-label="Abrir ${esc(x.title)}"><div class="card-top"><span>${x.type==='note'?'▤ ANOTAÇÃO':'◷ LEMBRETE'}</span><span class="badge ${x.priority==='Alta'?'high':''}">${esc(x.priority)}</span></div><h3>${esc(x.title)}</h3><p>${esc(x.body||'Sem descrição adicional.')}</p><div class="meta"><span class="tag">${esc(x.pop)}</span><span class="tag ${late(x)?'late':''}">${x.done?'✓ Concluído':late(x)?'Prazo vencido · ':''}${x.done?'':date(x.due)}</span><span class="tag">${esc(x.assignee||'Sem responsável')}</span></div><div class="card-actions"><button data-action="edit" data-id="${esc(x.id)}">Editar</button><button data-action="toggle" data-id="${esc(x.id)}">${x.done?'Reabrir':'Concluir'}</button><button data-action="delete" data-id="${esc(x.id)}" aria-label="Excluir ${esc(x.title)}">Excluir</button></div></article>`).join(''):'<div class="empty"><strong>'+(!demo&&!user?'Bem-vindo ao espaço do NIIP':'Tudo organizado por aqui')+'</strong>'+(!demo&&!user?'Entre para acessar os registros da equipe.':'Nenhum registro neste filtro. Use “Novo registro” para começar.')+'</div>';
 }
}
function requireLogin(){if(!demo&&!user){$('#login').showModal();return false;}return true;}
function openEditor(record){if(!requireLogin())return;editing=record?.id||null;const f=$('#record-form');f.reset();for(const field of ['type','title','body','pop','assignee','due','priority'])if(record)f.elements[field].value=record[field]||'';if(record&&['commands','tutorials'].includes(categoryOf(record)))f.elements.type.value=categoryOf(record);if(!record)f.elements.pop.value='NIIP';$('#edit-title').textContent=record?'Editar registro':'Novo registro';$('#editor').showModal();}
async function persist(id,data,remove=false){
 if(demo){const next=remove?items.filter(x=>x.id!==id):id?items.map(x=>x.id===id?{...x,...data}:x):[{...data,id:crypto.randomUUID()},...items];localStorage.setItem(key,JSON.stringify(next));items=next;render();return;}
 if(!user)throw new Error('Entre para salvar.');
 if(remove)await api.deleteDoc(api.doc(db,'records',id));
 else if(id)await api.updateDoc(api.doc(db,'records',id),{...data,updatedBy:user.uid,updatedAt:api.serverTimestamp()});
 else await api.addDoc(api.collection(db,'records'),{...data,createdBy:user.uid,updatedBy:user.uid,createdAt:api.serverTimestamp(),updatedAt:api.serverTimestamp()});
}
function createForCurrentView(){openEditor();if(view==='commands'||view==='tutorials'){const f=$('#record-form');f.elements.type.value=view;f.elements.title.placeholder=view==='commands'?'Nome do comando ou ferramenta':'Título do tutorial';f.elements.body.placeholder=view==='commands'?'Descreva o comando ou ferramenta':'Descreva as etapas do tutorial';$('#edit-title').textContent=view==='commands'?'Adicionar comando':'Novo tutorial';}}
$('#new').onclick=createForCurrentView;
$('#section-new').onclick=createForCurrentView;
$('#record-form').onsubmit=async e=>{e.preventDefault();const f=e.target;const data=Object.fromEntries(new FormData(f));if(['commands','tutorials'].includes(data.type)){data.category=data.type;data.type='note';}else if(['commands','tutorials'].includes(view))data.category=view;else if(editing){const old=items.find(x=>x.id===editing);if(old?.category)data.category=old.category;}for(const k of ['title','body','pop','assignee'])data[k]=data[k].trim();if(!data.title||!data.pop)return toast('Informe o título e o POP / setor.');$('#save').disabled=true;try{await persist(editing,{...data,...(!editing?{done:false,createdMs:Date.now()}:{} )});$('#editor').close();toast('Registro salvo.');}catch(e){toast(demo?'Não foi possível salvar no navegador.':'Falha ao salvar. Confira a conexão e sua autorização na equipe.');}finally{$('#save').disabled=false;}};
function openRecordDetail(item, push=true){if(!item)return;openedRecord=item;if(push)history.pushState({niipRecord:item.id},'',`#registro-${encodeURIComponent(item.id)}`);$('#detail-title').textContent=item.title;$('#detail-type').textContent=categoryOf(item)==='commands'?'COMANDO ÚTIL':categoryOf(item)==='tutorials'?'TUTORIAL':item.type==='note'?'ANOTAÇÃO':'LEMBRETE';$('#detail-body').textContent=item.body||'Sem descrição adicional.';$('#detail-meta').textContent=[item.pop,item.assignee||'Sem responsável',item.due?date(item.due):'Sem prazo',item.priority||'Média'].join(' · ');$('#record-detail').showModal();}
$('#records').onclick=async e=>{const b=e.target.closest('button[data-action]');if(b){const item=items.find(x=>x.id===b.dataset.id);if(!item||!requireLogin())return;if(b.dataset.action==='edit')return openEditor(item);if(b.dataset.action==='delete'&&!confirm(`Excluir “${item.title}”? Esta ação não pode ser desfeita.`))return;b.disabled=true;try{await persist(item.id,b.dataset.action==='toggle'?{done:!item.done}:null,b.dataset.action==='delete');toast(b.dataset.action==='delete'?'Registro excluído.':'Status atualizado.');}catch{toast('Não foi possível atualizar. Verifique sua conexão e permissão.');}finally{b.disabled=false;}return;}const card=e.target.closest('[data-open-record]');if(card)openRecordDetail(items.find(x=>x.id===card.dataset.openRecord));};
$('#records').onkeydown=e=>{const card=e.target.closest('[data-open-record]');if(card&&(e.key==='Enter'||e.key===' ')){e.preventDefault();openRecordDetail(items.find(x=>x.id===card.dataset.openRecord));}};
$('#detail-back').onclick=()=>{if(location.hash.startsWith('#registro-'))history.back();else {$('#record-detail').close();goMainView();}};$('#record-detail').addEventListener('close',()=>{openedRecord=null;});
function goMainView(){view='all';document.querySelectorAll('[data-view]').forEach(x=>x.classList.toggle('active',x.dataset.view==='all'));$('#view-title').textContent='Mural da equipe';$('.stats').hidden=false;$('.intro').hidden=false;$('.filters').hidden=false;$('#section-new').hidden=false;$('#section-new').textContent='＋ Novo registro';render();}
window.addEventListener('popstate',()=>{if($('#record-detail').open)$('#record-detail').close();if(!location.hash.startsWith('#registro-'))goMainView();else {const id=decodeURIComponent(location.hash.slice('#registro-'.length));openRecordDetail(items.find(x=>x.id===id),false);}});
for(const b of document.querySelectorAll('[data-close]'))b.onclick=()=>document.getElementById(b.dataset.close).close();
for(const b of document.querySelectorAll('[data-view]'))b.onclick=()=>{view=b.dataset.view;document.querySelectorAll('[data-view]').forEach(x=>x.classList.toggle('active',x===b));$('#view-title').textContent={all:'Mural da equipe',reminder:'Lembretes',note:'Anotações',commands:'Comandos úteis',tutorials:'Tutoriais',done:'Registros concluídos'}[view];const isInfo=['commands','tutorials'].includes(view);$('.stats').hidden=isInfo;$('.intro').hidden=isInfo;$('.filters').hidden=isInfo;$('#new').hidden=true;$('#section-new').hidden=view==='done';$('#section-new').textContent=({all:'＋ Novo registro',reminder:'＋ Novo lembrete',note:'＋ Nova anotação',commands:'＋ Adicionar comando',tutorials:'＋ Novo tutorial'})[view]||'＋ Adicionar';$('#result-count').textContent=isInfo?'':'';if(isInfo){$('#search').placeholder=view==='commands'?'Buscar comando, ferramenta ou descrição…':'Buscar tutorial ou procedimento…';$('.filters').hidden=false;render();}else{ $('#search').placeholder='Buscar título, anotação ou responsável…';render();}};
for(const id of ['search','pop-filter','priority-filter'])$('#'+id).addEventListener(id==='search'?'input':'change',render);
$('#account').onclick=async()=>{if(demo)return toast('Demonstração local: o acesso da equipe será ativado após configurar o Firebase.');if(user){try{await api.signOut(auth);}catch{toast('Não foi possível sair.');}}else $('#login').showModal();};
$('#login-form').onsubmit=async e=>{e.preventDefault();const b=e.target.querySelector('button.primary');b.disabled=true;try{await api.signInWithEmailAndPassword(auth,e.target.elements.email.value,e.target.elements.password.value);e.target.reset();$('#login').close();}catch{toast('Não foi possível entrar. Confira o e-mail, a senha e a conexão.');}finally{b.disabled=false;}};
if(demo){
 $('#notice').textContent='DEMONSTRAÇÃO LOCAL · Registros salvos apenas neste navegador, sem compartilhamento entre pessoas. Firebase ainda não configurado.';$('#account').textContent='Modo demonstração';
 try{items=JSON.parse(localStorage.getItem(key)||'[]');if(!Array.isArray(items))items=[];}catch{toast('O armazenamento local não está disponível.');items=[];}
 render();
}else{
 $('#notice').textContent='Conectando ao ambiente da equipe…';render();
 try{
 const [app,a,f]=await Promise.all([import('https://www.gstatic.com/firebasejs/13.0.0/firebase-app.js'),import('https://www.gstatic.com/firebasejs/13.0.0/firebase-auth.js'),import('https://www.gstatic.com/firebasejs/13.0.0/firebase-firestore.js')]);
 api={...a,...f};const instance=app.initializeApp(window.NIIP_CONFIG.firebase);auth=a.getAuth(instance);db=f.getFirestore(instance);
 a.onAuthStateChanged(auth,current=>{unsubscribe?.();user=current;items=[];render();$('#account').textContent=current?'Sair · '+current.email:'Entrar';if(!current){$('#notice').textContent='ACESSO RESTRITO · Entre para consultar e atualizar os registros do NIIP.';return;}$('#notice').textContent='Carregando registros da equipe…';unsubscribe=f.onSnapshot(f.collection(db,'records'),snapshot=>{items=snapshot.docs.map(d=>({...d.data(),id:d.id}));render();$('#notice').textContent='EQUIPE NIIP · Registros sincronizados. Alterações aparecem em tempo real.';},error=>{items=[];render();$('#notice').textContent=error.code==='permission-denied'?'Acesso não autorizado. Solicite ao administrador a inclusão do seu usuário na equipe.':'Não foi possível sincronizar. Verifique a conexão e a configuração do Firebase.';});});
 }catch{$('#notice').textContent='Falha ao conectar ao Firebase. Verifique a configuração e sua conexão.';$('#account').disabled=true;$('#new').disabled=true;}
}
