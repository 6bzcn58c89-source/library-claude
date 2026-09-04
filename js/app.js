// App principal: roteamento por hash + renderização de telas. Sem framework.

const STATUS_LABELS = {
  quero_comprar: 'Quero comprar',
  quero_ler: 'Quero ler',
  lendo: 'Lendo',
  lido: 'Lido',
  abandonado: 'Abandonado',
};
const STATUS_ORDER = ['lendo', 'quero_ler', 'lido', 'abandonado', 'quero_comprar'];

const app = document.getElementById('app');

function esc(str) {
  return String(str ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function setActiveNav(route) {
  document.querySelectorAll('.navbtn').forEach(b => b.classList.toggle('active', b.dataset.route === route));
}

async function render() {
  const hash = location.hash || '#/estante';
  const m = hash.match(/^#\/([a-z]+)(?:\/(.+))?$/);
  const route = m ? m[1] : 'estante';
  const param = m ? m[2] : undefined;
  app.scrollTop = 0;

  setActiveNav(['estante', 'wishlist', 'citacoes', 'backup'].includes(route) ? route : '');

  try {
    if (route === 'estante') return screenEstante();
    if (route === 'wishlist') return screenWishlist();
    if (route === 'citacoes') return screenCitacoes();
    if (route === 'backup') return screenBackup();
    if (route === 'livro' && param === 'novo') return screenLivroForm();
    if (route === 'livro' && param) return screenLivroDetalhe(Number(param));
    location.hash = '#/estante';
  } catch (err) {
    app.innerHTML = `<div class="empty">Algo deu errado: ${esc(err.message)}</div>`;
    console.error(err);
  }
}

window.addEventListener('hashchange', render);
window.addEventListener('DOMContentLoaded', render);

// ---------- Componentes reutilizáveis ----------

function bookCardHtml(book) {
  const cover = book.coverUrl
    ? `<img src="${esc(book.coverUrl)}" alt="" class="cover">`
    : `<div class="cover cover-placeholder">${esc((book.title || '?').slice(0, 1))}</div>`;
  return `
    <a class="book-card" href="#/livro/${book.id}">
      ${cover}
      <div class="book-info">
        <div class="book-title">${esc(book.title)}</div>
        <div class="book-author">${esc(book.author || '')}</div>
        <div class="book-status status-${book.status}">${STATUS_LABELS[book.status] || book.status}</div>
      </div>
    </a>`;
}

function starsHtml(rating, interactive) {
  let html = '<div class="stars">';
  for (let i = 1; i <= 5; i++) {
    const filled = rating >= i ? 'filled' : '';
    html += interactive
      ? `<button type="button" class="star ${filled}" data-star="${i}">★</button>`
      : `<span class="star ${filled}">★</span>`;
  }
  return html + '</div>';
}

// ---------- Tela: Estante ----------

async function screenEstante() {
  const all = await DB.getAllBooks();
  const books = all.filter(b => b.status !== 'quero_comprar');
  const filter = app.dataset.filter || 'todos';

  const filtered = filter === 'todos' ? books : books.filter(b => b.status === filter);
  const tabs = ['todos', 'lendo', 'quero_ler', 'lido', 'abandonado'];

  app.innerHTML = `
    <div class="screen">
      <h1>Minha Estante</h1>
      <div class="tabs">
        ${tabs.map(t => `<button class="tab ${t === filter ? 'active' : ''}" data-filter="${t}">${t === 'todos' ? 'Todos' : STATUS_LABELS[t]}</button>`).join('')}
      </div>
      ${filtered.length ? `<div class="book-grid">${filtered.map(bookCardHtml).join('')}</div>`
        : `<div class="empty">Nenhum livro aqui ainda.<br>Toque em + para adicionar.</div>`}
    </div>
    <a href="#/livro/novo" class="fab" aria-label="Adicionar livro">+</a>
  `;
  app.querySelectorAll('.tab').forEach(btn => btn.addEventListener('click', () => {
    app.dataset.filter = btn.dataset.filter;
    screenEstante();
  }));
}

// ---------- Tela: Wishlist ----------

async function screenWishlist() {
  const all = await DB.getAllBooks();
  const items = all.filter(b => b.status === 'quero_comprar')
    .sort((a, b) => (a.priority ?? 9) - (b.priority ?? 9));

  app.innerHTML = `
    <div class="screen">
      <h1>Quero Comprar</h1>
      ${items.length ? `<div class="wishlist-list">${items.map(w => `
        <div class="wish-card">
          <a href="#/livro/${w.id}" class="wish-main">
            <div class="book-title">${esc(w.title)}</div>
            <div class="book-author">${esc(w.author || '')}</div>
            ${w.estimatedPrice ? `<div class="wish-price">~ ${esc(w.estimatedPrice)}</div>` : ''}
          </a>
          <button class="btn-small btn-buy" data-id="${w.id}">Já comprei</button>
        </div>`).join('')}</div>`
        : `<div class="empty">Sua lista de desejos está vazia.<br>Toque em + para adicionar um livro.</div>`}
    </div>
    <a href="#/livro/novo" class="fab" aria-label="Adicionar à wishlist">+</a>
  `;
  app.querySelectorAll('.btn-buy').forEach(btn => btn.addEventListener('click', async () => {
    await DB.updateBook(Number(btn.dataset.id), { status: 'quero_ler' });
    screenWishlist();
  }));
}

// ---------- Tela: Citações ----------

async function screenCitacoes() {
  const [quotes, books] = await Promise.all([DB.getAllQuotes(), DB.getAllBooks()]);
  const bookById = Object.fromEntries(books.map(b => [b.id, b]));
  const tagFilter = app.dataset.tagFilter || '';
  const allTags = [...new Set(quotes.flatMap(q => q.tags || []))].sort();

  const filtered = tagFilter ? quotes.filter(q => (q.tags || []).includes(tagFilter)) : quotes;

  app.innerHTML = `
    <div class="screen">
      <h1>Citações</h1>
      ${allTags.length ? `<div class="tabs">
        <button class="tab ${!tagFilter ? 'active' : ''}" data-tag="">Todas</button>
        ${allTags.map(t => `<button class="tab ${tagFilter === t ? 'active' : ''}" data-tag="${esc(t)}">${esc(t)}</button>`).join('')}
      </div>` : ''}
      ${filtered.length ? `<div class="quote-list">${filtered.map(q => `
        <div class="quote-card">
          <div class="quote-text">"${esc(q.text)}"</div>
          <div class="quote-meta">
            <a href="#/livro/${q.bookId}">${esc(bookById[q.bookId]?.title || 'Livro removido')}</a>
            ${q.page ? ` · p. ${esc(q.page)}` : ''}
          </div>
          ${(q.tags || []).length ? `<div class="tag-list">${q.tags.map(t => `<span class="tag">${esc(t)}</span>`).join('')}</div>` : ''}
        </div>`).join('')}</div>`
        : `<div class="empty">Nenhuma citação ainda.<br>Adicione uma pelo livro correspondente.</div>`}
    </div>
  `;
  app.querySelectorAll('[data-tag]').forEach(btn => btn.addEventListener('click', () => {
    app.dataset.tagFilter = btn.dataset.tag;
    screenCitacoes();
  }));
}

// ---------- Tela: Adicionar livro ----------

function emptyDraft() {
  return { title: '', author: '', isbn: '', pages: '', coverUrl: '', format: 'fisico', status: 'quero_ler' };
}

async function screenLivroForm() {
  const draft = app._draft || emptyDraft();
  app._draft = draft;

  app.innerHTML = `
    <div class="screen">
      <a href="#/estante" class="back-link">← Voltar</a>
      <h1>Adicionar Livro</h1>

      <div class="search-box">
        <input type="text" id="searchInput" placeholder="Buscar por título ou autor" value="">
        <button id="searchBtn" class="btn-small">Buscar</button>
      </div>
      <div class="search-box">
        <input type="text" id="isbnInput" placeholder="Ou buscar por ISBN">
        <button id="isbnBtn" class="btn-small">Buscar ISBN</button>
      </div>
      <div id="searchResults" class="search-results"></div>

      <h2>Dados do livro</h2>
      <form id="bookForm" class="form">
        <label>Título<input name="title" required value="${esc(draft.title)}"></label>
        <label>Autor<input name="author" value="${esc(draft.author)}"></label>
        <label>ISBN<input name="isbn" value="${esc(draft.isbn)}"></label>
        <label>Páginas<input name="pages" type="number" min="1" value="${esc(draft.pages)}"></label>
        <label>Formato
          <select name="format">
            <option value="fisico" ${draft.format === 'fisico' ? 'selected' : ''}>Físico</option>
            <option value="digital" ${draft.format === 'digital' ? 'selected' : ''}>Digital</option>
          </select>
        </label>
        <label>Status inicial
          <select name="status">
            <option value="quero_comprar" ${draft.status === 'quero_comprar' ? 'selected' : ''}>Quero comprar</option>
            <option value="quero_ler" ${draft.status === 'quero_ler' ? 'selected' : ''}>Quero ler</option>
            <option value="lendo" ${draft.status === 'lendo' ? 'selected' : ''}>Lendo</option>
            <option value="lido" ${draft.status === 'lido' ? 'selected' : ''}>Lido</option>
          </select>
        </label>
        <input type="hidden" name="coverUrl" value="${esc(draft.coverUrl)}">
        <button type="submit" class="btn-primary">Salvar livro</button>
      </form>
    </div>
  `;

  $('#searchBtn').addEventListener('click', async () => {
    const q = $('#searchInput').value.trim();
    if (!q) return;
    $('#searchResults').innerHTML = '<div class="empty small">Buscando...</div>';
    try {
      const results = await BookApi.search(q);
      renderSearchResults(results);
    } catch {
      $('#searchResults').innerHTML = '<div class="empty small">Busca falhou. Tente de novo ou preencha manualmente.</div>';
    }
  });

  $('#isbnBtn').addEventListener('click', async () => {
    const isbn = $('#isbnInput').value.trim();
    if (!isbn) return;
    $('#searchResults').innerHTML = '<div class="empty small">Buscando...</div>';
    try {
      const result = await BookApi.byIsbn(isbn);
      renderSearchResults(result ? [result] : []);
    } catch {
      $('#searchResults').innerHTML = '<div class="empty small">Busca falhou. Tente de novo ou preencha manualmente.</div>';
    }
  });

  function renderSearchResults(results) {
    const box = $('#searchResults');
    if (!results.length) { box.innerHTML = '<div class="empty small">Nada encontrado.</div>'; return; }
    box.innerHTML = results.map((r, i) => `
      <button type="button" class="result-card" data-i="${i}">
        ${r.coverUrl ? `<img src="${esc(r.coverUrl)}" class="cover-sm">` : '<div class="cover-sm cover-placeholder"></div>'}
        <div>
          <div class="book-title">${esc(r.title)}</div>
          <div class="book-author">${esc(r.author)}</div>
        </div>
      </button>`).join('');
    box.querySelectorAll('.result-card').forEach(btn => btn.addEventListener('click', () => {
      const r = results[Number(btn.dataset.i)];
      app._draft = { ...draft, title: r.title, author: r.author, isbn: r.isbn, pages: r.pages || '', coverUrl: r.coverUrl };
      screenLivroForm();
    }));
  }

  $('#bookForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const book = {
      title: fd.get('title').trim(),
      author: fd.get('author').trim(),
      isbn: fd.get('isbn').trim(),
      pages: fd.get('pages') ? Number(fd.get('pages')) : null,
      format: fd.get('format'),
      status: fd.get('status'),
      coverUrl: fd.get('coverUrl'),
      currentPage: null,
      progressLog: [],
      rating: null,
      review: '',
      priority: null,
      estimatedPrice: '',
      buyLink: '',
      startedAt: fd.get('status') === 'lendo' ? new Date().toISOString() : null,
      finishedAt: fd.get('status') === 'lido' ? new Date().toISOString() : null,
    };
    if (!book.title) return;
    const saved = await DB.addBook(book);
    app._draft = null;
    location.hash = `#/livro/${saved}`;
  });
}

// ---------- Tela: Detalhe do livro ----------

async function screenLivroDetalhe(id) {
  const book = await DB.getBook(id);
  if (!book) { app.innerHTML = '<div class="empty">Livro não encontrado.</div>'; return; }
  const quotes = await DB.getQuotesByBook(id);

  const cover = book.coverUrl
    ? `<img src="${esc(book.coverUrl)}" class="cover-lg">`
    : `<div class="cover-lg cover-placeholder">${esc((book.title || '?').slice(0, 1))}</div>`;

  const pct = book.pages && book.currentPage ? Math.min(100, Math.round((book.currentPage / book.pages) * 100)) : null;

  app.innerHTML = `
    <div class="screen">
      <a href="#/estante" class="back-link">← Voltar</a>
      <div class="detail-header">
        ${cover}
        <div>
          <h1>${esc(book.title)}</h1>
          <div class="book-author">${esc(book.author || '')}</div>
          <div class="book-meta-line">${book.format === 'digital' ? 'Digital' : 'Físico'}${book.pages ? ` · ${book.pages} páginas` : ''}${book.isbn ? ` · ISBN ${esc(book.isbn)}` : ''}</div>
        </div>
      </div>

      <label class="status-select-label">Status
        <select id="statusSelect">
          ${STATUS_ORDER.map(s => `<option value="${s}" ${book.status === s ? 'selected' : ''}>${STATUS_LABELS[s]}</option>`).join('')}
        </select>
      </label>

      ${book.status === 'quero_comprar' ? `
        <section class="card">
          <h2>Lista de desejos</h2>
          <label>Prioridade
            <select id="priority">
              <option value="1" ${book.priority === 1 ? 'selected' : ''}>Alta</option>
              <option value="2" ${book.priority === 2 ? 'selected' : ''}>Média</option>
              <option value="3" ${book.priority === 3 ? 'selected' : ''}>Baixa</option>
            </select>
          </label>
          <label>Preço aproximado<input id="estimatedPrice" value="${esc(book.estimatedPrice || '')}" placeholder="R$ 00,00"></label>
          <label>Onde comprar (link)<input id="buyLink" value="${esc(book.buyLink || '')}" placeholder="https://..."></label>
          <button id="saveWishInfo" class="btn-small">Salvar</button>
          <button id="markBought" class="btn-primary">Já comprei</button>
        </section>` : ''}

      ${book.status === 'lendo' ? `
        <section class="card">
          <h2>Progresso</h2>
          ${pct !== null ? `<div class="progress-bar"><div class="progress-fill" style="width:${pct}%"></div></div><div class="progress-pct">${pct}% lido (p. ${book.currentPage} de ${book.pages})</div>` : ''}
          <div class="inline-form">
            <input id="pageInput" type="number" min="1" max="${book.pages || ''}" placeholder="Página atual">
            <button id="savePage" class="btn-small">Atualizar</button>
          </div>
          ${(book.progressLog || []).length ? `<details class="log-details"><summary>Histórico</summary>
            <ul class="log-list">${[...book.progressLog].reverse().map(p => `<li>p. ${p.page} — ${new Date(p.date).toLocaleDateString('pt-BR')}</li>`).join('')}</ul>
          </details>` : ''}
        </section>` : ''}

      ${(book.status === 'lido' || book.status === 'abandonado') ? `
        <section class="card">
          <h2>Resenha</h2>
          ${starsHtml(book.rating || 0, true)}
          <textarea id="reviewText" placeholder="O que você achou?">${esc(book.review || '')}</textarea>
          <button id="saveReview" class="btn-small">Salvar resenha</button>
        </section>` : ''}

      <section class="card">
        <h2>Citações e trechos</h2>
        <form id="quoteForm" class="form">
          <textarea name="text" placeholder="Trecho ou citação" required></textarea>
          <div class="inline-form">
            <input name="page" type="number" min="1" placeholder="Página">
            <input name="tags" placeholder="tags separadas por vírgula">
          </div>
          <button type="submit" class="btn-small">Adicionar citação</button>
        </form>
        ${quotes.length ? `<div class="quote-list">${quotes.map(q => `
          <div class="quote-card">
            <div class="quote-text">"${esc(q.text)}"</div>
            <div class="quote-meta">${q.page ? `p. ${esc(q.page)}` : ''}
              <button class="link-btn del-quote" data-id="${q.id}">excluir</button>
            </div>
            ${(q.tags || []).length ? `<div class="tag-list">${q.tags.map(t => `<span class="tag">${esc(t)}</span>`).join('')}</div>` : ''}
          </div>`).join('')}</div>` : '<div class="empty small">Nenhuma citação ainda.</div>'}
      </section>

      <button id="deleteBook" class="btn-danger">Excluir livro</button>
    </div>
  `;

  $('#statusSelect').addEventListener('change', async (e) => {
    const status = e.target.value;
    const patch = { status };
    if (status === 'lendo' && !book.startedAt) patch.startedAt = new Date().toISOString();
    if (status === 'lido' && !book.finishedAt) patch.finishedAt = new Date().toISOString();
    await DB.updateBook(id, patch);
    screenLivroDetalhe(id);
  });

  if (book.status === 'quero_comprar') {
    $('#saveWishInfo').addEventListener('click', async () => {
      await DB.updateBook(id, {
        priority: Number($('#priority').value),
        estimatedPrice: $('#estimatedPrice').value.trim(),
        buyLink: $('#buyLink').value.trim(),
      });
      screenLivroDetalhe(id);
    });
    $('#markBought').addEventListener('click', async () => {
      await DB.updateBook(id, { status: 'quero_ler' });
      screenLivroDetalhe(id);
    });
  }

  if (book.status === 'lendo') {
    $('#savePage').addEventListener('click', async () => {
      const page = Number($('#pageInput').value);
      if (!page) return;
      const log = [...(book.progressLog || []), { page, date: new Date().toISOString() }];
      await DB.updateBook(id, { currentPage: page, progressLog: log });
      screenLivroDetalhe(id);
    });
  }

  if (book.status === 'lido' || book.status === 'abandonado') {
    let selectedRating = book.rating || 0;
    app.querySelectorAll('.star').forEach(btn => btn.addEventListener('click', () => {
      selectedRating = Number(btn.dataset.star);
      app.querySelectorAll('.star').forEach(s => s.classList.toggle('filled', Number(s.dataset.star) <= selectedRating));
    }));
    $('#saveReview').addEventListener('click', async () => {
      await DB.updateBook(id, { rating: selectedRating, review: $('#reviewText').value.trim() });
      screenLivroDetalhe(id);
    });
  }

  $('#quoteForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const text = fd.get('text').trim();
    if (!text) return;
    const tags = fd.get('tags').split(',').map(t => t.trim()).filter(Boolean);
    await DB.addQuote({ bookId: id, text, page: fd.get('page') ? Number(fd.get('page')) : null, tags });
    screenLivroDetalhe(id);
  });

  app.querySelectorAll('.del-quote').forEach(btn => btn.addEventListener('click', async () => {
    await DB.deleteQuote(Number(btn.dataset.id));
    screenLivroDetalhe(id);
  }));

  $('#deleteBook').addEventListener('click', async () => {
    if (!confirm(`Excluir "${book.title}"? Isso apaga também as citações dele.`)) return;
    await DB.deleteBook(id);
    location.hash = '#/estante';
  });
}

// ---------- Tela: Backup ----------

async function screenBackup() {
  app.innerHTML = `
    <div class="screen">
      <h1>Backup</h1>
      <section class="card">
        <h2>Exportar</h2>
        <p class="hint">Salva todos os seus livros e citações em um arquivo .json.</p>
        <button id="exportBtn" class="btn-primary">Exportar backup</button>
      </section>
      <section class="card">
        <h2>Importar</h2>
        <p class="hint">Restaura a partir de um arquivo exportado anteriormente.</p>
        <input type="file" id="importFile" accept="application/json">
        <label class="checkbox-label"><input type="checkbox" id="replaceMode"> Substituir tudo (em vez de mesclar)</label>
        <button id="importBtn" class="btn-small">Importar</button>
        <div id="importMsg"></div>
      </section>
    </div>
  `;

  $('#exportBtn').addEventListener('click', async () => {
    const data = await DB.exportAll();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `minha-biblioteca-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  });

  $('#importBtn').addEventListener('click', async () => {
    const file = $('#importFile').files[0];
    const msg = $('#importMsg');
    if (!file) { msg.textContent = 'Escolha um arquivo primeiro.'; return; }
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      await DB.importAll(data, $('#replaceMode').checked ? 'replace' : 'merge');
      msg.textContent = 'Importado com sucesso!';
    } catch (err) {
      msg.textContent = 'Erro ao importar: ' + err.message;
    }
  });
}

function $(sel) { return app.querySelector(sel); }

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  });
}
