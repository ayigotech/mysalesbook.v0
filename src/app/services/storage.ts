// services/storage.service.ts
import { Injectable } from '@angular/core';
import { Transaction, Sale, Expense, DailySummary, 
  UserPreferences,
   AppSettings, 
   TransactionType, 
   PinSettings }
  from 'src/models';

@Injectable({
  providedIn: 'root'
})
export class StorageService {
  private dbName = 'MySalesBookDB';
  private dbVersion = 1;
  private db: IDBDatabase | null = null;

  constructor() {
    this.initDB();
  }

  // ==================== DATABASE INITIALIZATION ====================
  private async initDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve(request.result);
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;


        //Pin management
        if (!db.objectStoreNames.contains('pinSettings')) {
          const store = db.createObjectStore('pinSettings', { keyPath: 'id', autoIncrement: true });
        }


        // Transactions store (Sales + Expenses)
        if (!db.objectStoreNames.contains('transactions')) {
          const store = db.createObjectStore('transactions', { keyPath: 'id' });
          store.createIndex('datetime', 'datetime', { unique: false });
          store.createIndex('type', 'type', { unique: false });
        }

        // Daily summaries store
        if (!db.objectStoreNames.contains('summaries')) {
          db.createObjectStore('summaries', { keyPath: 'dateKey' });
        }

        // User preferences store
        if (!db.objectStoreNames.contains('preferences')) {
          db.createObjectStore('preferences', { keyPath: 'id' });
        }

        // App settings store
        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings', { keyPath: 'id' });
        }
      };
    });
  }

  private async ensureDB(): Promise<IDBDatabase> {
    if (this.db) return this.db;
    return await this.initDB();
  }



 // ==================== PIN MANAGEMENT ====================
 // Save/update PIN settings
async savePinSettings(pinSettings: PinSettings): Promise<void> {
  const db = await this.ensureDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('pinSettings', 'readwrite');
    const store = tx.objectStore('pinSettings');
    store.put(pinSettings);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// Get PIN settings
async getPinSettings(): Promise<PinSettings | null> {
  const db = await this.ensureDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('pinSettings', 'readonly');
    const store = tx.objectStore('pinSettings');
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result[0] || null);
    req.onerror = () => reject(req.error);
  });
}








  // ==================== TRANSACTIONS ====================



  async addTransaction(tx: Omit<Transaction, 'id'>): Promise<string> {
  const db = await this.ensureDB();
  const id = this.generateId();
  const dateKey = new Date(tx.datetime).toISOString().split('T')[0];

  
  let stored: Transaction & { dateKey: string };

if (tx.type === 'sale') {
  stored = {
    ...(tx as Sale),
    id,
    datetime: new Date(tx.datetime),
    dateKey,
    type: TransactionType.SALE // assign from enum
  };
} else {
  stored = {
    ...(tx as Expense),
    id,
    datetime: new Date(tx.datetime),
    dateKey,
    type: TransactionType.EXPENSE, // assign from enum
    paymentMethod: (tx as Expense).paymentMethod
  };
}


  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['transactions', 'summaries'], 'readwrite');
    const store = transaction.objectStore('transactions');

    const request = store.add(stored);

    // update daily summary within same transaction
    this._updateSummaryInTx(
      transaction,
      stored.dateKey,
       stored.type as TransactionType,
      stored.amount
    );

    request.onsuccess = () => resolve(id);
    request.onerror = () => reject(request.error);
  });


}










  async getTransactions(date?: string): Promise<Transaction[]> {
    const db = await this.ensureDB();
    return new Promise((resolve, reject) => {
      const store = db.transaction('transactions').objectStore('transactions');
      const index = store.index('datetime');
      const request = index.getAll();

      request.onsuccess = () => {
        let result = request.result as Transaction[];
        if (date) {
          result = result.filter(t => {
            const tDate = new Date(t.datetime).toISOString().split('T')[0];
            return tDate === date;
          });
        }
        // sort newest first
        result.sort((a, b) => new Date(b.datetime).getTime() - new Date(a.datetime).getTime());
        resolve(result);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async getTransactionsByDateRange(startDate: string, endDate: string): Promise<Transaction[]> {
    const db = await this.ensureDB();
    return new Promise((resolve, reject) => {
      const store = db.transaction('transactions').objectStore('transactions');
      const index = store.index('datetime');
      const range = IDBKeyRange.bound(new Date(startDate).toISOString(), new Date(endDate).toISOString());
      const request = index.getAll(range);

      request.onsuccess = () => resolve(request.result as Transaction[]);
      request.onerror = () => reject(request.error);
    });
  }

  // ==================== DAILY SUMMARIES ====================
  async getDailySummary(dateKey: string): Promise<DailySummary> {
    const db = await this.ensureDB();
    return new Promise((resolve, reject) => {
      const store = db.transaction('summaries').objectStore('summaries');
      const request = store.get(dateKey);

      request.onsuccess = () => {
        resolve(
          request.result || this.createEmptySummary(dateKey)
        );
      };
      request.onerror = () => reject(request.error);
    });
  }

  private _updateSummaryInTx(
    tx: IDBTransaction,
    dateKey: string,
    type: TransactionType,
    amount: number
  ) {
    const store = tx.objectStore('summaries');
    const req = store.get(dateKey);

    req.onsuccess = () => {
      const summary: DailySummary = req.result || this.createEmptySummary(dateKey);
      if (type === TransactionType.SALE) summary.totalSales += amount;
      else summary.totalExpenses += amount;

      summary.netProfit = summary.totalSales - summary.totalExpenses;
      summary.transactionCount += 1;

      store.put(summary);
    };
  }

  private createEmptySummary(dateKey: string): DailySummary {
    return {
      date: new Date(dateKey),
      dateKey,
      totalSales: 0,
      totalExpenses: 0,
      netProfit: 0,
      transactionCount: 0
    };
  }

  // ==================== USER PREFERENCES ====================
  async getUserPreferences(): Promise<UserPreferences> {
    const db = await this.ensureDB();
    return new Promise((resolve, reject) => {
      const store = db.transaction('preferences').objectStore('preferences');
      const request = store.get('default');

      request.onsuccess = () => {
        resolve(
          request.result || this.getDefaultPreferences()
        );
      };
      request.onerror = () => reject(request.error);
    });
  }

  async saveUserPreferences(prefs: UserPreferences): Promise<void> {
    const db = await this.ensureDB();
    return new Promise((resolve, reject) => {
      const store = db.transaction('preferences', 'readwrite').objectStore('preferences');
      const req = store.put({ ...prefs, id: 'default' });

      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  private getDefaultPreferences(): UserPreferences {
    return {
      theme: 'light',
      currency: 'GHS',
      defaultCategories: [],
      notificationEnabled: true
    };
  }

  // ==================== BACKUP & RESTORE ====================
  async exportData(): Promise<string> {
    const db = await this.ensureDB();
    const [transactions, summaries, prefs] = await Promise.all([
      this._getAll('transactions'),
      this._getAll('summaries'),
      this._getAll('preferences')
    ]);

    const backup = {
      transactions,
      summaries,
      preferences: prefs,
      exportDate: new Date().toISOString(),
      version: '1.0'
    };

    return JSON.stringify(backup, null, 2);
  }

  async importData(jsonData: string): Promise<boolean> {
    const db = await this.ensureDB();
    const data = JSON.parse(jsonData);

    return new Promise((resolve, reject) => {
      const tx = db.transaction(['transactions', 'summaries', 'preferences'], 'readwrite');

      ['transactions', 'summaries', 'preferences'].forEach(storeName => {
        tx.objectStore(storeName).clear();
      });

      data.transactions?.forEach((t: Transaction) => tx.objectStore('transactions').add(t));
      data.summaries?.forEach((s: DailySummary) => tx.objectStore('summaries').add(s));
      data.preferences?.forEach((p: UserPreferences & { id: string }) => tx.objectStore('preferences').add(p));

      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error);
    });
  }

  private async _getAll(storeName: string): Promise<any[]> {
    const db = await this.ensureDB();
    return new Promise((resolve, reject) => {
      const store = db.transaction(storeName).objectStore(storeName);
      const req = store.getAll();

      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  // ==================== UTILITY ====================
  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substring(2);
  }
}
