// Busca de metadados de livros na Open Library (gratuito, sem chave de API).
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
    const url = `https://openlibrary.org/api/books?bibkeys=ISBN:${cleanIsbn}&jscmd=data&format=json`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('Falha na busca por ISBN');
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
  },
};

window.BookApi = BookApi;
