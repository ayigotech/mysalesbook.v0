import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ModalController } from '@ionic/angular';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { NotificationService } from 'src/app/services/notification';
import { StorageService } from 'src/app/services/storage';
import { TransactionType } from 'src/models';
import { IonButton, IonContent, IonTitle, IonButtons,IonModal, IonHeader, IonToolbar, IonIcon, 
  // IonRefresher, IonRefresherContent
 } from "@ionic/angular/standalone";
import { MatNativeDateModule } from '@angular/material/core';
import { MatDatepickerInputEvent, MatDatepickerModule } from '@angular/material/datepicker';
import { MatInputModule } from '@angular/material/input';


@Component({
  selector: 'app-add-sales',
  templateUrl: './add-sales.component.html',
  styleUrls: ['./add-sales.component.scss'],
  imports: [CommonModule, FormsModule, IonButton, IonContent,
    IonTitle, IonButtons, IonModal, IonHeader, IonToolbar, IonIcon,
    MatDatepickerModule,
    MatNativeDateModule,
    MatInputModule,
    ],
     providers: [ModalController] // Add this line
})

export class AddSalesComponent {

isRefreshing = true;
showDateModal = false; 
// temporary date holder
tempDate = new Date(); // ISO string


 saleData = {
  amount: null as number | null,
  datetime: new Date(), // <-- ISO string
  customer: '',
  category: '',
  notes: ''
};

  quickAmounts = [5, 10, 20, 50, 100, 200, 500];
  showAmountError = false;
  showCategoryModal = false;
  isSaving = false;

  categories = [
    'Retail Sales',
    'Wholesale',
    'Services',
    'Online Sales',
    'Cash Sales',
    'Credit Sales',
    'Other'
  ];

  recentSales: any[] = []; // Will be populated from actual data

  constructor(
    private router: Router,
    private modalCtrl: ModalController,
    private notificationService: NotificationService,
    private storageService: StorageService
  ) {
    this.loadRecentSales();
  }

  // Load recent sales from storage
  private async loadRecentSales() {
    try {
      const transactions = await this.storageService.getTransactions();
      // Filter sales only and take last 4
      this.recentSales = transactions
        .filter(tx => tx.type === TransactionType.SALE)
        .slice(0, 4)
        .map(tx => ({
          amount: tx.amount,
          customer: (tx as any).customer || '',
          datetime: new Date(tx.datetime),
          id: tx.id
        }));
    } catch (error) {
      console.error('Error loading recent sales:', error);
      // Fallback to empty array if there's an error
      this.recentSales = [];
    }
  }

  // Navigation
  goBack() {
    this.router.navigate(['/tabs/home']);
  }

  // Validation
  validateAmount() {
    this.showAmountError = !this.saleData.amount || this.saleData.amount <= 0;
  }

  canSave(): boolean {
    return !!(this.saleData.amount && this.saleData.amount > 0) && !this.isSaving;
  }

  // Quick Actions
  setQuickAmount(amount: number) {
    this.saleData.amount = amount;
    this.validateAmount();
  }






onDateChange(event: MatDatepickerInputEvent<Date>) {
  // event.value is always a Date
  this.saleData.datetime = event.value!;
}



openCategoryModal() {
  this.showCategoryModal = true;
}

  showCategoryPicker() {
    this.showCategoryModal = true;
  }

  selectCategory(category: string) {
    this.saleData.category = category;
    this.showCategoryModal = false;
  }

 

  // Save Operations
async saveSale() {
  if (!this.canSave()) {
    this.validateAmount();
    return;
  }

  this.isSaving = true;

  try {
    // Prepare sale data for storage - use Date object directly
    const saleTransaction = {
      amount: this.saleData.amount!,
      datetime: new Date(this.saleData.datetime), // Already a Date object
      customer: this.saleData.customer,
      category: this.saleData.category,
      notes: this.saleData.notes,
      type: TransactionType.SALE
    };

    // Save to storage
    const transactionId = await this.storageService.addTransaction(saleTransaction);
    
    // Show success notification
    this.notificationService.success(
      `Sale of GHS ${this.saleData.amount} recorded successfully!`,
      'Sale Saved'
    );

    // Reset form for next entry
    this.resetForm();
    
    // Reload recent sales to include the new one
    await this.loadRecentSales();

    // Optional: Add haptic feedback for mobile feel
    if (typeof window !== 'undefined' && 'navigator' in window && 'vibrate' in navigator) {
      (navigator as any).vibrate(50);
    }

  } catch (error) {
    console.error('Error saving sale:', error);
    this.notificationService.error(
      'Failed to save sale. Please try again.',
      'Save Error'
    );
  } finally {
    this.isSaving = false;
  }
}

  quickSave() {
    if (this.canSave()) {
      this.saveSale();
    }
  }

  resetForm() {
  this.saleData = {
    amount: null,
    datetime: new Date(),
    customer: '',
    category: '',
    notes: ''
  };
  this.showAmountError = false;
}

fillFromRecent(recent: any) {
  this.saleData.amount = recent.amount;
  this.saleData.customer = recent.customer;
  this.saleData.datetime = new Date(); // ISO string
  this.validateAmount();
}


  async onSwipeRecent(event: any, recent: any) {
    // Handle swipe to delete recent sale
    console.log('Swiped recent:', recent);
    
    // Optional: Implement delete functionality for recent sales
    // You could add a confirmation dialog here
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


   async refreshPage(event: any) {
    this.isRefreshing = true;
  }
}