// Camada de dados: IndexedDB. Um único banco local, dois stores: books e quotes.
const DB_NAME = 'minha-biblioteca';
const DB_VERSION = 1;

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('books')) {
        const books = db.createObjectStore('books', { keyPath: 'id', autoIncrement: true });
        books.createIndex('status', 'status');
      }
      if (!db.objectStoreNames.contains('quotes')) {
        const quotes = db.createObjectStore('quotes', { keyPath: 'id', autoIncrement: true });
        quotes.createIndex('bookId', 'bookId');
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

let dbPromise = openDb();

function withStore(storeName, mode, fn) {
  return dbPromise.then(db => new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, mode);
    const store = tx.objectStore(storeName);
    const result = fn(store);
    tx.oncomplete = () => resolve(result.value ?? result);
    tx.onerror = () => reject(tx.error);
  }));
}

function reqAsPromise(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

const DB = {
  async addBook(book) {
    const now = new Date().toISOString();
    const record = { ...book, createdAt: now, updatedAt: now };
    return withStore('books', 'readwrite', store => ({ value: reqAsPromise(store.add(record)) }));
  },

  async updateBook(id, patch) {
    const db = await dbPromise;
    return new Promise((resolve, reject) => {
      const tx = db.transaction('books', 'readwrite');
      const store = tx.objectStore('books');
      const getReq = store.get(id);
      getReq.onsuccess = () => {
        const existing = getReq.result;
        if (!existing) return reject(new Error('Livro não encontrado'));
        const updated = { ...existing, ...patch, id, updatedAt: new Date().toISOString() };
        store.put(updated);
        tx.oncomplete = () => resolve(updated);
      };
      getReq.onerror = () => reject(getReq.error);
    });
  },

  async deleteBook(id) {
    const db = await dbPromise;
    return new Promise((resolve, reject) => {
      const tx = db.transaction(['books', 'quotes'], 'readwrite');
      tx.objectStore('books').delete(id);
      const quoteStore = tx.objectStore('quotes');
      const idx = quoteStore.index('bookId');
      const range = IDBKeyRange.only(id);
      idx.openCursor(range).onsuccess = (e) => {
        const cursor = e.target.result;
        if (cursor) {
          quoteStore.delete(cursor.primaryKey);
          cursor.continue();
        }
      };
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  },

  async getBook(id) {
    const db = await dbPromise;
    const tx = db.transaction('books', 'readonly');
    return reqAsPromise(tx.objectStore('books').get(id));
  },

  async getAllBooks() {
    const db = await dbPromise;
    const tx = db.transaction('books', 'readonly');
    const all = await reqAsPromise(tx.objectStore('books').getAll());
    return all.sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
  },

  async addQuote(quote) {
    const now = new Date().toISOString();
    const record = { ...quote, createdAt: now };
    const db = await dbPromise;
    const tx = db.transaction('quotes', 'readwrite');
    const id = await reqAsPromise(tx.objectStore('quotes').add(record));
    return { ...record, id };
  },

  async deleteQuote(id) {
    const db = await dbPromise;
    const tx = db.transaction('quotes', 'readwrite');
    tx.objectStore('quotes').delete(id);
    return new Promise((resolve) => { tx.oncomplete = () => resolve(); });
  },

  async getQuotesByBook(bookId) {
    const db = await dbPromise;
    const tx = db.transaction('quotes', 'readonly');
    const idx = tx.objectStore('quotes').index('bookId');
    const all = await reqAsPromise(idx.getAll(IDBKeyRange.only(bookId)));
    return all.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  },

  async getAllQuotes() {
    const db = await dbPromise;
    const tx = db.transaction('quotes', 'readonly');
    const all = await reqAsPromise(tx.objectStore('quotes').getAll());
    return all.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  },

  async exportAll() {
    const [books, quotes] = await Promise.all([this.getAllBooks(), this.getAllQuotes()]);
    return { version: DB_VERSION, exportedAt: new Date().toISOString(), books, quotes };
  },

  async importAll(data, mode = 'merge') {
    if (!data || !Array.isArray(data.books)) throw new Error('Arquivo de backup inválido');
    const db = await dbPromise;
    const tx = db.transaction(['books', 'quotes'], 'readwrite');
    const bookStore = tx.objectStore('books');
    const quoteStore = tx.objectStore('quotes');
    if (mode === 'replace') {
      bookStore.clear();
      quoteStore.clear();
    }
    for (const book of data.books) bookStore.put(book);
    for (const quote of (data.quotes || [])) quoteStore.put(quote);
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  },
};

window.DB = DB;
