// add-expenses.component.ts
import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule, ModalController } from '@ionic/angular';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { NotificationService } from 'src/app/services/notification';
import { StorageService } from 'src/app/services/storage';
import { TransactionType } from 'src/models';

@Component({
  selector: 'app-add-expenses',
  templateUrl: './add-expenses.component.html',
  styleUrls: ['./add-expenses.component.scss'],
  imports: [CommonModule, IonicModule, FormsModule]
})
export class AddExpensesComponent {
  expenseData = {
    amount: null as number | null,
    datetime: new Date(),
    category: '',
    vendor: '',
    description: '',
    paymentMethod: 'cash'
  };

  quickAmounts = [5, 10, 20, 50, 100, 200, 500];
  showAmountError = false;
  showCategoryModal = false;
  isSaving = false;

  categories = [
    'Supplies',
    'Transportation',
    'Utilities',
    'Rent',
    'Staff',
    'Marketing',
    'Maintenance',
    'Food & Drinks',
    'Other'
  ];

  paymentMethods = [
    'cash',
    'mobile money',
    'bank transfer',
    'credit card',
    'other'
  ];

  recentExpenses: any[] = [];

  constructor(
    private router: Router,
    private modalCtrl: ModalController,
    private notificationService: NotificationService,
    private storageService: StorageService
  ) {
    this.loadRecentExpenses();
  }

  // Load recent expenses from storage
  private async loadRecentExpenses() {
    try {
      const transactions = await this.storageService.getTransactions();
      // Filter expenses only and take last 4
      this.recentExpenses = transactions
        .filter(tx => tx.type === TransactionType.EXPENSE)
        .slice(0, 4)
        .map(tx => ({
          amount: tx.amount,
          vendor: (tx as any).vendor || '',
          category: (tx as any).category || '',
          datetime: new Date(tx.datetime),
          paymentMethod: (tx as any).paymentMethod || 'cash',
          id: tx.id
        }));
    } catch (error) {
      console.error('Error loading recent expenses:', error);
      // Fallback to empty array if there's an error
      this.recentExpenses = [];
    }
  }

  // Navigation
  goBack() {
    this.router.navigate(['/tabs/home']);
  }

  // Validation
  validateAmount() {
    this.showAmountError = !this.expenseData.amount || this.expenseData.amount <= 0;
  }

  canSave(): boolean {
    return !!(this.expenseData.amount && this.expenseData.amount > 0) && !this.isSaving;
  }

  // Quick Actions
  setQuickAmount(amount: number) {
    this.expenseData.amount = amount;
    this.validateAmount();
  }

  showDateTimePicker() {
    // In a real app, you'd use Ionic's datetime picker
    this.expenseData.datetime = new Date();
  }

  showCategoryPicker() {
    this.showCategoryModal = true;
  }

  selectCategory(category: string) {
    this.expenseData.category = category;
    this.showCategoryModal = false;
  }

  // Save Operations
  async saveExpense() {
    if (!this.canSave()) {
      this.validateAmount();
      return;
    }

    this.isSaving = true;

    try {
      // Prepare expense data for storage
      const expenseTransaction = {
        amount: this.expenseData.amount!,
        datetime: this.expenseData.datetime,
        category: this.expenseData.category,
        vendor: this.expenseData.vendor,
        description: this.expenseData.description,
        paymentMethod: this.expenseData.paymentMethod,
        type: TransactionType.EXPENSE
      };

      // Save to storage
      const transactionId = await this.storageService.addTransaction(expenseTransaction);
      
      // Show success notification
      this.notificationService.success(
        `Expense of GHS ${this.expenseData.amount} recorded successfully!`,
        'Expense Saved'
      );

      // Reset form for next entry
      this.resetForm();
      
      // Reload recent expenses to include the new one
      await this.loadRecentExpenses();

      // Optional: Add haptic feedback for mobile feel
      if (typeof window !== 'undefined' && 'navigator' in window && 'vibrate' in navigator) {
        (navigator as any).vibrate(50);
      }

    } catch (error) {
      console.error('Error saving expense:', error);
      this.notificationService.error(
        'Failed to save expense. Please try again.',
        'Save Error'
      );
    } finally {
      this.isSaving = false;
    }
  }

  quickSave() {
    if (this.canSave()) {
      this.saveExpense();
    }
  }

  resetForm() {
    this.expenseData = {
      amount: null,
      datetime: new Date(),
      category: '',
      vendor: '',
      description: '',
      paymentMethod: 'cash'
    };
    this.showAmountError = false;
  }

  // Recent Expenses
  fillFromRecent(recent: any) {
    this.expenseData.amount = recent.amount;
    this.expenseData.vendor = recent.vendor;
    this.expenseData.category = recent.category;
    this.expenseData.datetime = new Date();
    this.validateAmount();
  }

  async onSwipeRecent(event: any, recent: any) {
    // Handle swipe to delete recent expense
    console.log('Swiped recent expense:', recent);
    
    // Optional: Implement delete functionality for recent expenses
    this.notificationService.info(
      'Swipe to delete functionality can be implemented here',
      'Feature Note'
    );
  }

  getTimeAgo(date: Date): string {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  }

  getPaymentMethodIcon(method: string): string {
    const icons: { [key: string]: string } = {
      'cash': 'cash',
      'mobile money': 'phone-portrait',
      'bank transfer': 'card',
      'credit card': 'card',
      'other': 'ellipsis-horizontal'
    };
    return icons[method] || 'ellipsis-horizontal';
  }
}