
const $ = s => document.querySelector(s);
const demo = !window.NIIP_CONFIG?.firebase;

let items = [], user = null, db, auth, api, unsubscribe;
let view = 'all', editing = null;

const key = 'niip-demo-v1';

const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[c]));

const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
};

const categoryOf = x => ['commands','tutorials'].includes(x.category) ? x.category : '';
const isNote = x => x.type === 'note' && !categoryOf(x);
const late = x => x.type === 'reminder' && !x.done && x.due && x.due < today();
const date = d => d ? new Date(d+'T12:00:00').toLocaleDateString('pt-BR') : 'Sem prazo';

let timer;

function toast(message) {
  $('#toast').textContent = message;
  $('#toast').style.display = 'block';
  clearTimeout(timer);
  timer = setTimeout(() => $('#toast').style.display = 'none', 5000);
}

function typeLabel(x) {
  if (categoryOf(x) === 'commands') return '⌘ COMANDO ÚTIL';
  if (categoryOf(x) === 'tutorials') return '▥ TUTORIAL';
  return x.type === 'note' ? '▤ ANOTAÇÃO' : '◷ LEMBRETE';
}

function visibleInView(x) {
  if (view === 'done') return x.done;
  if (x.done) return false;

  if (view === 'all') return true;
  if (view === 'reminder') return x.type === 'reminder';
  if (view === 'note') return isNote(x);
  if (view === 'commands') return categoryOf(x) === 'commands';
  if (view === 'tutorials') return categoryOf(x) === 'tutorials';

  return false;
}

function render() {
  $('#open-count').textContent =
    items.filter(x => x.type === 'reminder' && !x.done).length;

  $('#late-count').textContent = items.filter(late).length;
  $('#notes-count').textContent = items.filter(isNote).length;
  $('#done-count').textContent = items.filter(x => x.done).length;

  const selectedPop = $('#pop-filter').value;

  $('#pop-filter').innerHTML =
    '<option value="">Todos os POPs / setores</option>' +
    [...new Set(items.map(x => x.pop).filter(Boolean))]
      .sort()
      .map(x => `<option value="${esc(x)}">${esc(x)}</option>`)
      .join('');

  $('#pop-filter').value = selectedPop;

  const search = $('#search').value.toLocaleLowerCase('pt-BR');

  const data = items
    .filter(x => visibleInView(x))
    .filter(x => !selectedPop || x.pop === selectedPop)
    .filter(x => !$('#priority-filter').value ||
      x.priority === $('#priority-filter').value)
    .filter(x => [x.title, x.body, x.pop, x.assignee]
      .join(' ')
      .toLocaleLowerCase('pt-BR')
      .includes(search))
    .sort((a,b) =>
      Number(late(b)) - Number(late(a)) ||
      (a.due || '9999').localeCompare(b.due || '9999') ||
      (b.createdMs || 0) - (a.createdMs || 0)
    );

  $('#result-count').textContent =
    `${data.length} registro${data.length === 1 ? '' : 's'}`;

  $('#records').innerHTML = data.length
    ? data.map(x => `
      <article class="card">
        <div class="card-top">
          <span>${typeLabel(x)}</span>
          <span class="badge ${x.priority === 'Alta' ? 'high' : ''}">
            ${esc(x.priority || 'Média')}
          </span>
        </div>
        <h3>${esc(x.title)}</h3>
        <p>${esc(x.body || 'Sem descrição adicional.')}</p>
        <div class="meta">
          <span class="tag">${esc(x.pop || 'NIIP')}</span>
          <span class="tag ${late(x) ? 'late' : ''}">
            ${x.done ? '✓ Concluído' : late(x) ? 'Prazo vencido · ' : ''}
            ${x.done ? '' : date(x.due)}
          </span>
          <span class="tag">${esc(x.assignee || 'Sem responsável')}</span>
        </div>
        <div class="card-actions">
          <button data-action="edit" data-id="${esc(x.id)}">Editar</button>
          <button data-action="toggle" data-id="${esc(x.id)}">
            ${x.done ? 'Reabrir' : 'Concluir'}
          </button>
          <button data-action="delete" data-id="${esc(x.id)}"
            aria-label="Excluir ${esc(x.title)}">Excluir</button>
        </div>
      </article>
    `).join('')
    : `<div class="empty">
        <strong>${!demo && !user ? 'Bem-vindo ao espaço do NIIP' : 'Tudo organizado por aqui'}</strong>
        <p>${!demo && !user
          ? 'Entre para acessar os registros da equipe.'
          : 'Nenhum registro nesta seção. Use “Novo registro” para começar.'}</p>
      </div>`;
}

function requireLogin() {
  if (!demo && !user) {
    $('#login').showModal();
    return false;
  }
  return true;
}

function setFormType(record) {
  const f = $('#record-form');
  if (record) {
    f.elements.type.value = categoryOf(record) || record.type || 'note';
  } else {
    f.elements.type.value =
      ['commands','tutorials'].includes(view) ? view :
      view === 'reminder' ? 'reminder' :
      view === 'note' ? 'note' : 'note';
  }
}

function updateEditorLabels() {
  const f = $('#record-form');
  const type = f.elements.type.value;

  f.elements.title.placeholder =
    type === 'commands' ? 'Nome do comando ou ferramenta' :
    type === 'tutorials' ? 'Título do tutorial' :
    type === 'reminder' ? 'O que precisa ser lembrado?' :
    'O que a equipe precisa saber?';

  f.elements.body.placeholder =
    type === 'commands' ? 'Descreva o comando, ferramenta ou instrução' :
    type === 'tutorials' ? 'Descreva as etapas do tutorial' :
    'Contexto, orientações e próximos passos…';

  $('#edit-title').textContent =
    editing
      ? 'Editar registro'
      : type === 'commands' ? 'Adicionar comando'
      : type === 'tutorials' ? 'Novo tutorial'
      : 'Novo registro';
}

function openEditor(record) {
  if (!requireLogin()) return;

  editing = record?.id || null;

  const f = $('#record-form');
  f.reset();

  if (record) {
    for (const field of ['title','body','pop','assignee','due','priority']) {
      f.elements[field].value = record[field] ?? '';
    }
  } else {
    f.elements.pop.value = 'NIIP';
    f.elements.priority.value = 'Média';
  }

  setFormType(record);
  updateEditorLabels();
  $('#editor').showModal();
}

async function persist(id, data, remove = false) {
  if (demo) {
    let next;

    if (remove) {
      next = items.filter(x => x.id !== id);
    } else if (id) {
      next = items.map(x => {
        if (x.id !== id) return x;
        const updated = { ...x, ...data };
        if (data.category === null) delete updated.category;
        return updated;
      });
    } else {
      const created = { ...data, id: crypto.randomUUID() };
      if (created.category === null) delete created.category;
      next = [created, ...items];
    }

    localStorage.setItem(key, JSON.stringify(next));
    items = next;
    render();
    return;
  }

  if (!user) throw new Error('Entre para salvar.');

  if (remove) {
    await api.deleteDoc(api.doc(db, 'records', id));
    return;
  }

  const payload = { ...data };

  if (id) {
    if (payload.category === null) {
      payload.category = api.deleteField();
    }
    await api.updateDoc(api.doc(db, 'records', id), {
      ...payload,
      updatedBy: user.uid,
      updatedAt: api.serverTimestamp()
    });
  } else {
    delete payload.category;
    if (data.category) payload.category = data.category;

    await api.addDoc(api.collection(db, 'records'), {
      ...payload,
      createdBy: user.uid,
      updatedBy: user.uid,
      createdAt: api.serverTimestamp(),
      updatedAt: api.serverTimestamp()
    });
  }
}

$('#new').onclick = () => openEditor();

$('#record-form').elements.type.addEventListener('change', updateEditorLabels);

$('#record-form').onsubmit = async e => {
  e.preventDefault();

  const f = e.target;
  const selectedType = f.elements.type.value;
  const data = Object.fromEntries(new FormData(f));

  for (const k of ['title','body','pop','assignee']) {
    data[k] = (data[k] || '').trim();
  }

  if (!data.title || !data.pop) {
    toast('Informe o título e o POP / setor.');
    return;
  }

  if (['commands','tutorials'].includes(selectedType)) {
    data.type = 'note';
    data.category = selectedType;
  } else {
    data.type = selectedType;
    data.category = null;
  }

  $('#save').disabled = true;

  try {
    if (!editing) {
      data.done = false;
      data.createdMs = Date.now();
    }

    await persist(editing, data);
    $('#editor').close();
    toast('Registro salvo.');
  } catch (e) {
    console.error('Erro ao salvar registro:', e);
    toast(demo
      ? 'Não foi possível salvar no navegador.'
      : 'Falha ao salvar. Verifique as regras do Firestore e sua autorização na equipe.');
  } finally {
    $('#save').disabled = false;
  }
};

$('#records').onclick = async e => {
  const b = e.target.closest('button[data-action]');
  if (!b) return;

  const item = items.find(x => x.id === b.dataset.id);
  if (!item || !requireLogin()) return;

  if (b.dataset.action === 'edit') return openEditor(item);

  if (b.dataset.action === 'delete' &&
      !confirm(`Excluir “${item.title}”? Esta ação não pode ser desfeita.`)) {
    return;
  }

  b.disabled = true;

  try {
    if (b.dataset.action === 'toggle') {
      await persist(item.id, { done: !item.done });
    } else {
      await persist(item.id, null, true);
    }

    toast(b.dataset.action === 'delete'
      ? 'Registro excluído.'
      : 'Status atualizado.');
  } catch (e) {
    console.error('Erro ao atualizar registro:', e);
    toast('Não foi possível atualizar. Verifique sua conexão e permissão.');
  } finally {
    b.disabled = false;
  }
};

for (const b of document.querySelectorAll('[data-close]')) {
  b.onclick = () => document.getElementById(b.dataset.close).close();
}

for (const b of document.querySelectorAll('[data-view]')) {
  b.onclick = () => {
    view = b.dataset.view;

    document.querySelectorAll('[data-view]').forEach(x =>
      x.classList.toggle('active', x === b)
    );

    $('#view-title').textContent = {
      all: 'Mural da equipe',
      reminder: 'Lembretes',
      note: 'Anotações',
      commands: 'Comandos úteis',
      tutorials: 'Tutoriais',
      done: 'Registros concluídos'
    }[view];

    const isInfo = ['commands','tutorials'].includes(view);

    $('.stats').hidden = isInfo;
    $('.intro').hidden = isInfo;
    $('.filters').hidden = isInfo;
    $('#new').hidden = view === 'done';

    $('#new').textContent =
      view === 'commands' ? '＋ Adicionar comando' :
      view === 'tutorials' ? '＋ Novo tutorial' :
      view === 'note' ? '＋ Nova anotação' :
      view === 'reminder' ? '＋ Novo lembrete' :
      '＋ Novo registro';

    render();
  };
}

for (const id of ['search','pop-filter','priority-filter']) {
  $('#'+id).addEventListener(id === 'search' ? 'input' : 'change', render);
}

$('#account').onclick = async () => {
  if (demo) {
    toast('Demonstração local: configure o Firebase para compartilhar os registros.');
    return;
  }

  if (user) {
    try {
      await api.signOut(auth);
    } catch {
      toast('Não foi possível sair.');
    }
  } else {
    $('#login').showModal();
  }
};

$('#login-form').onsubmit = async e => {
  e.preventDefault();

  const b = e.target.querySelector('button.primary');
  b.disabled = true;

  try {
    await api.signInWithEmailAndPassword(
      auth,
      e.target.elements.email.value,
      e.target.elements.password.value
    );
    e.target.reset();
    $('#login').close();
  } catch (e) {
    console.error('Erro de login:', e);
    toast('Não foi possível entrar. Confira o e-mail, a senha e a conexão.');
  } finally {
    b.disabled = false;
  }
};

if (demo) {
  $('#notice').textContent =
    'DEMONSTRAÇÃO LOCAL · Registros salvos apenas neste navegador, sem compartilhamento entre pessoas. Firebase ainda não configurado.';
  $('#account').textContent = 'Modo demonstração';

  try {
    items = JSON.parse(localStorage.getItem(key) || '[]');
    if (!Array.isArray(items)) items = [];
  } catch {
    toast('O armazenamento local não está disponível.');
    items = [];
  }

  render();
} else {
  $('#notice').textContent = 'Conectando ao ambiente da equipe…';
  render();

  try {
    const [app,a,f] = await Promise.all([
      import('https://www.gstatic.com/firebasejs/13.0.0/firebase-app.js'),
      import('https://www.gstatic.com/firebasejs/13.0.0/firebase-auth.js'),
      import('https://www.gstatic.com/firebasejs/13.0.0/firebase-firestore.js')
    ]);

    api = { ...a, ...f };
    const instance = app.initializeApp(window.NIIP_CONFIG.firebase);
    auth = a.getAuth(instance);
    db = f.getFirestore(instance);

    a.onAuthStateChanged(auth, current => {
      unsubscribe?.();
      user = current;
      items = [];
      render();

      $('#account').textContent = current
        ? 'Sair · ' + current.email
        : 'Entrar';

      if (!current) {
        $('#notice').textContent =
          'ACESSO RESTRITO · Entre para consultar e atualizar os registros do NIIP.';
        return;
      }

      $('#notice').textContent = 'Carregando registros da equipe…';

      unsubscribe = f.onSnapshot(
        f.collection(db, 'records'),
        snapshot => {
          items = snapshot.docs.map(d => ({ ...d.data(), id: d.id }));
          render();
          $('#notice').textContent =
            'EQUIPE NIIP · Registros sincronizados. Alterações aparecem em tempo real.';
        },
        error => {
          console.error('Erro de sincronização:', error);
          items = [];
          render();
          $('#notice').textContent =
            error.code === 'permission-denied'
              ? 'Acesso não autorizado. Solicite ao administrador a inclusão do seu usuário na equipe.'
              : 'Não foi possível sincronizar. Verifique a conexão e a configuração do Firebase.';
        }
      );
    });
  } catch (e) {
    console.error('Erro ao conectar ao Firebase:', e);
    $('#notice').textContent =
      'Falha ao conectar ao Firebase. Verifique a configuração e sua conexão.';
    $('#account').disabled = true;
    $('#new').disabled = true;
  }
}
