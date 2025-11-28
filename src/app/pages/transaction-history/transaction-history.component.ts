// transaction-history.component.ts
import { Component, OnInit, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule, ModalController } from '@ionic/angular';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { StorageService } from 'src/app/services/storage';
import { NotificationService } from 'src/app/services/notification';
import { Transaction, TransactionType, DailySummary } from 'src/models';

@Component({
  selector: 'app-transaction-history',
  templateUrl: './transaction-history.component.html',
  styleUrls: ['./transaction-history.component.scss'],
  imports: [CommonModule, IonicModule, FormsModule]
})
export class TransactionHistoryComponent implements OnInit, AfterViewInit {

  TransactionType = TransactionType;

  selectedFilter: string = 'today';
  searchQuery: string = '';
  isLoading = true;
  isRefreshing = false;
  
  // Real transaction data from storage
  transactions: Transaction[] = [];
  filteredTransactions: Transaction[] = [];
  dailySummaries: DailySummary[] = [];

  constructor(
    private router: Router,
    private modalCtrl: ModalController,
    private storageService: StorageService,
    private notificationService: NotificationService
  ) {}

  async ngOnInit() {
    await this.loadTransactions();
    this.calculateDailySummaries();
  }

  ngAfterViewInit() {
    // Initialize AOS animations after view is ready
    this.initAnimations();
  }

  // Load transactions from storage
  async loadTransactions() {
    this.isLoading = true;
    try {
      this.transactions = await this.storageService.getTransactions();
      this.filterTransactions();
    } catch (error) {
      console.error('Error loading transactions:', error);
      this.notificationService.error('Failed to load transactions', 'Data Error');
      this.transactions = [];
      this.filteredTransactions = [];
    } finally {
      this.isLoading = false;
    }
  }

  // Navigation
  goBack() {
    this.router.navigate(['/tabs/home']);
  }

  // Filtering
  filterTransactions() {
    let filtered = [...this.transactions];
    
    // Apply date filter
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    switch(this.selectedFilter) {
      case 'today':
        filtered = filtered.filter(t => {
          const transDate = new Date(t.datetime);
          transDate.setHours(0, 0, 0, 0);
          return transDate.getTime() === today.getTime();
        });
        break;
      case 'yesterday':
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        filtered = filtered.filter(t => {
          const transDate = new Date(t.datetime);
          transDate.setHours(0, 0, 0, 0);
          return transDate.getTime() === yesterday.getTime();
        });
        break;
      case 'week':
        const weekAgo = new Date(today);
        weekAgo.setDate(weekAgo.getDate() - 7);
        filtered = filtered.filter(t => new Date(t.datetime) >= weekAgo);
        break;
      case 'month':
        const monthAgo = new Date(today);
        monthAgo.setDate(monthAgo.getDate() - 30);
        filtered = filtered.filter(t => new Date(t.datetime) >= monthAgo);
        break;
      case 'all':
        // No date filtering
        break;
    }
    
    // Apply search filter
    if (this.searchQuery) {
      const query = this.searchQuery.toLowerCase();
      filtered = filtered.filter(t => {
        const transaction = t as any; // Cast to access dynamic properties
        return (
          (transaction.customer && transaction.customer.toLowerCase().includes(query)) ||
          (transaction.vendor && transaction.vendor.toLowerCase().includes(query)) ||
          (transaction.description && transaction.description.toLowerCase().includes(query)) ||
          (transaction.category && transaction.category.toLowerCase().includes(query)) ||
          t.amount.toString().includes(query)
        );
      });
    }
    
    this.filteredTransactions = filtered.sort((a, b) => 
      new Date(b.datetime).getTime() - new Date(a.datetime).getTime()
    );
  }

  onFilterChange() {
    this.filterTransactions();
  }

  onSearchChange() {
    this.filterTransactions();
  }

  // Daily Summaries
  async calculateDailySummaries() {
    try {
      // Get recent transactions for summary calculation
      const recentTransactions = this.transactions
        .sort((a, b) => new Date(b.datetime).getTime() - new Date(a.datetime).getTime())
        .slice(0, 50); // Last 50 transactions for summary
      
      const summaries = new Map();
      
      recentTransactions.forEach(transaction => {
        const date = new Date(transaction.datetime);
        date.setHours(0, 0, 0, 0);
        const dateKey = date.toISOString().split('T')[0];
        
        if (!summaries.has(dateKey)) {
          summaries.set(dateKey, {
            date: new Date(date),
            dateKey,
            totalSales: 0,
            totalExpenses: 0,
            netProfit: 0,
            transactionCount: 0
          });
        }
        
        const summary = summaries.get(dateKey);
        summary.transactionCount++;
        
        if (transaction.type === TransactionType.SALE) {
          summary.totalSales += transaction.amount;
        } else {
          summary.totalExpenses += transaction.amount;
        }
        
        summary.netProfit = summary.totalSales - summary.totalExpenses;
      });
      
      this.dailySummaries = Array.from(summaries.values())
        .sort((a, b) => b.date.getTime() - a.date.getTime())
        .slice(0, 3); // Show last 3 days
    } catch (error) {
      console.error('Error calculating daily summaries:', error);
      this.dailySummaries = [];
    }
  }

  // Transaction Actions
  async deleteTransaction(transaction: Transaction) {
    // Show confirmation before deleting
    if (confirm('Are you sure you want to delete this transaction?')) {
      try {
        // Note: You'll need to add a deleteTransaction method to your StorageService
        // For now, we'll filter it out from the local array
        this.transactions = this.transactions.filter(t => t.id !== transaction.id);
        this.filterTransactions();
        this.calculateDailySummaries();
        
        this.notificationService.success('Transaction deleted successfully', 'Deleted');
        
        // TODO: Implement actual deletion in StorageService
        console.log('Transaction to delete:', transaction);
        
      } catch (error) {
        console.error('Error deleting transaction:', error);
        this.notificationService.error('Failed to delete transaction', 'Error');
      }
    }
  }

  editTransaction(transaction: Transaction) {
    // Navigate to edit page based on transaction type
    if (transaction.type === TransactionType.SALE) {
      this.router.navigate(['/tabs/add-sales'], { 
        state: { transactionToEdit: transaction }
      });
    } else {
      this.router.navigate(['/tabs/add-expenses'], { 
        state: { transactionToEdit: transaction }
      });
    }
  }

  // Export/Share
  async exportDailySummary() {
    try {
      const today = new Date().toISOString().split('T')[0];
      const todaySummary = this.dailySummaries.find(summary => summary.dateKey === today);
      
      if (todaySummary) {
        const summaryText = `Daily Summary - ${this.formatDate(todaySummary.date)}
Sales: ${this.formatCurrency(todaySummary.totalSales)}
Expenses: ${this.formatCurrency(todaySummary.totalExpenses)}
Net Profit: ${this.formatCurrency(todaySummary.netProfit)}
Transactions: ${todaySummary.transactionCount}`;
        
        // Copy to clipboard
        if (navigator.clipboard && window.isSecureContext) {
          await navigator.clipboard.writeText(summaryText);
          this.notificationService.success('Daily summary copied to clipboard!', 'Copied');
        } else {
          // Fallback for older browsers
          const textArea = document.createElement('textarea');
          textArea.value = summaryText;
          document.body.appendChild(textArea);
          textArea.focus();
          textArea.select();
          try {
            document.execCommand('copy');
            this.notificationService.success('Daily summary copied to clipboard!', 'Copied');
          } catch (err) {
            this.notificationService.error('Failed to copy to clipboard', 'Error');
          }
          document.body.removeChild(textArea);
        }
      } else {
        this.notificationService.warning('No summary data available for today', 'No Data');
      }
    } catch (error) {
      console.error('Error exporting summary:', error);
      this.notificationService.error('Failed to export summary', 'Error');
    }
  }

  // AOS Animations
  private initAnimations() {
    // Simulate AOS initialization
    setTimeout(() => {
      const elements = document.querySelectorAll('.aos-item');
      elements.forEach((el, index) => {
        (el as HTMLElement).style.opacity = '1';
        (el as HTMLElement).style.transform = 'translateY(0)';
      });
    }, 100);
  }

  // Utility Methods
  formatCurrency(amount: number): string {
    return 'GHS ' + amount.toFixed(2);
  }

  formatDate(date: Date): string {
    return new Date(date).toLocaleDateString('en-GH', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  }

  formatTime(date: Date): string {
    return new Date(date).toLocaleTimeString('en-GH', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  }

  getTransactionDisplayName(transaction: Transaction): string {
    const tx = transaction as any; // Cast to access dynamic properties
    if (transaction.type === TransactionType.SALE) {
      return tx.customer || 'Sale';
    } else {
      return tx.vendor || 'Expense';
    }
  }

  getTransactionDescription(transaction: Transaction): string {
    const tx = transaction as any;
    return tx.description || tx.category || (transaction.type === TransactionType.SALE ? 'Sale' : 'Expense');
  }

  getTransactionCategory(transaction: Transaction): string {
    const tx = transaction as any;
    return tx.category || 'Uncategorized';
  }

  getTransactionsByDate(date: Date) {
    const dateKey = new Date(date).toDateString();
    return this.filteredTransactions.filter(t => 
      new Date(t.datetime).toDateString() === dateKey
    );
  }

  // Swipe gesture handler for transactions
  onSwipeTransaction(event: any, transaction: Transaction) {
    // Handle swipe left to show delete option
    if (event.direction === 2) { // Swipe left
      this.deleteTransaction(transaction);
    }
  }

  async refreshPage(event: any) {
    this.isRefreshing = true;
    try {
      await this.loadTransactions();
      this.calculateDailySummaries();
      this.notificationService.success('Transactions refreshed', 'Updated');
    } catch (error) {
      console.error('Error refreshing transactions:', error);
    } finally {
      event.target.complete();
      this.isRefreshing = false;
    }
  }

  // Get transaction type icon
  getTransactionIcon(transaction: Transaction): string {
    return transaction.type === TransactionType.SALE ? 'arrow-up' : 'arrow-down';
  }

  // Get transaction type color
  getTransactionColor(transaction: Transaction): string {
    return transaction.type === TransactionType.SALE ? 'success' : 'danger';
  }

  // Check if no transactions found
  get noTransactionsFound(): boolean {
    return !this.isLoading && this.filteredTransactions.length === 0;
  }

  // Get empty state message based on filter
  get emptyStateMessage(): string {
    if (this.searchQuery) {
      return 'No transactions found matching your search.';
    }
    if (this.selectedFilter !== 'all') {
      return `No transactions found for ${this.selectedFilter}.`;
    }
    return 'No transactions recorded yet.';
  }
}