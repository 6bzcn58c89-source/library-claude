// Busca de metadados de livros. Open Library cobre bem o catálogo
// internacional; BrasilAPI (base da Câmara Brasileira do Livro) cobre muito
// melhor livros nacionais, que costumam faltar na Open Library.
const BookApi = {
  async search(query) {
    const url = `https://openlibrary.org/search.json?q=${encodeURIComponent(query)}&fields=title,author_name,isbn,cover_i,number_of_pages_median&limit=12`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('Falha na busca');
    const data = await res.json();
    return (data.docs || []).map(doc => ({
      title: doc.title,
      author: (doc.author_name || []).join(', '),
      isbn: (doc.isbn || [])[0] || '',
      pages: doc.number_of_pages_median || null,
      coverUrl: doc.cover_i ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-M.jpg` : '',
    }));
  },

  async byIsbn(isbn) {
    const cleanIsbn = isbn.replace(/[^0-9Xx]/g, '');
    const fromBrasilApi = await this._byIsbnBrasilApi(cleanIsbn);
    const fromOpenLibrary = await this._byIsbnOpenLibrary(cleanIsbn);
    if (!fromBrasilApi && !fromOpenLibrary) return null;
    // Combina os dois: prioriza a BrasilAPI para os dados (melhor pra livros
    // nacionais), mas aproveita a capa da Open Library quando a BrasilAPI não tem.
    const base = fromBrasilApi || fromOpenLibrary;
    if (!base.coverUrl && fromOpenLibrary?.coverUrl) base.coverUrl = fromOpenLibrary.coverUrl;
    return base;
  },

  async _byIsbnBrasilApi(cleanIsbn) {
    try {
      const res = await fetch(`https://brasilapi.com.br/api/isbn/v1/${cleanIsbn}`);
      if (!res.ok) return null;
      const entry = await res.json();
      return {
        title: entry.title || '',
        author: (entry.authors || []).join(', '),
        isbn: cleanIsbn,
        pages: entry.page_count || null,
        coverUrl: entry.cover_url || '',
      };
    } catch {
      return null;
    }
  },

  async _byIsbnOpenLibrary(cleanIsbn) {
    try {
      const url = `https://openlibrary.org/api/books?bibkeys=ISBN:${cleanIsbn}&jscmd=data&format=json`;
      const res = await fetch(url);
      if (!res.ok) return null;
      const data = await res.json();
      const entry = data[`ISBN:${cleanIsbn}`];
      if (!entry) return null;
      return {
        title: entry.title || '',
        author: (entry.authors || []).map(a => a.name).join(', '),
        isbn: cleanIsbn,
        pages: entry.number_of_pages || null,
        coverUrl: entry.cover ? (entry.cover.medium || entry.cover.large || entry.cover.small || '') : '',
      };
    } catch {
      return null;
    }
  },
};

window.BookApi = BookApi;
