import { AfterViewInit, Component, ElementRef, inject, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { Router } from '@angular/router';
import Chart from 'chart.js/auto';
import { InsightComponent } from '../pages/insight/insight.component';
import { ModalController } from '@ionic/angular';
import { StorageService } from 'src/app/services/storage';
import { NotificationService } from 'src/app/services/notification';
import { Transaction, TransactionType } from 'src/models';
import { RouterModule } from '@angular/router'; // Add this import

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
  standalone: true,
  imports: [CommonModule, IonicModule]
})
export class HomePage implements OnInit, AfterViewInit {

    TransactionType = TransactionType;

  private router = inject(Router)

  @ViewChild('salesChart') salesChart!: ElementRef;
  chart: any;
  isDarkMode = true;
  isLoading = true;
  isRefreshing = false;
  
  // Real data from storage
  todaySales = 0;
  todaySalesCount = 0;
  todayExpenses = 0;
  netProfit = 0;
  recentTransactions: Transaction[] = [];
  
  // Chart data
  last7Days: { day: string, sales: number, expenses: number }[] = [];
  selectedFilter: string = '7days';

  constructor(
    private modalCtrl: ModalController,
    private storageService: StorageService,
    private notificationService: NotificationService
  ) {}

  async ngOnInit() {
    // Load theme preference from localStorage
    const savedTheme = localStorage.getItem('theme');
    this.isDarkMode = savedTheme ? savedTheme === 'dark' : true;
    
    await this.loadHomeData();
  }

  async loadHomeData() {
    this.isLoading = true;
    try {
      await Promise.all([
        this.loadTodaySummary(),
        this.loadRecentTransactions(),
        this.loadChartData()
      ]);
      this.formatNumbers();
    } catch (error) {
      console.error('Error loading home data:', error);
      this.notificationService.error('Failed to load dashboard data', 'Data Error');
    } finally {
      this.isLoading = false;
    }
  }

  // Load today's summary data
  async loadTodaySummary() {
    try {
      const today = new Date().toISOString().split('T')[0];
      const transactions = await this.storageService.getTransactions(today);
      
      this.todaySales = transactions
        .filter(tx => tx.type === TransactionType.SALE)
        .reduce((sum, tx) => sum + tx.amount, 0);
      

      // Total number of sales
      this.todaySalesCount = transactions
        .filter(tx => tx.type === TransactionType.SALE)
        .length;
      
      this.todayExpenses = transactions
        .filter(tx => tx.type === TransactionType.EXPENSE)
        .reduce((sum, tx) => sum + tx.amount, 0);
      
      this.netProfit = this.todaySales - this.todayExpenses;
    } catch (error) {
      console.error('Error loading today summary:', error);
    }
  }

  // Load recent transactions (last 4)
  async loadRecentTransactions() {
    try {
      const transactions = await this.storageService.getTransactions();
      this.recentTransactions = transactions
        .sort((a, b) => new Date(b.datetime).getTime() - new Date(a.datetime).getTime())
        .slice(0, 20);
    } catch (error) {
      console.error('Error loading recent transactions:', error);
      this.recentTransactions = [];
    }
  }


   getTransactionCategory(transaction: Transaction): string {
    const tx = transaction as any;
    return tx.category || '';
  }

  // Load chart data for last 7 days
  async loadChartData() {
    try {
      const transactions = await this.storageService.getTransactions();
      const last7Days = Array.from({ length: 7 }, (_, i) => {
        const date = new Date();
        date.setDate(date.getDate() - i);
        return date.toISOString().split('T')[0];
      }).reverse();

      const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      
      this.last7Days = last7Days.map(date => {
        const dayTransactions = transactions.filter(tx => {
          const txDate = new Date(tx.datetime).toISOString().split('T')[0];
          return txDate === date;
        });

        const sales = dayTransactions
          .filter(tx => tx.type === TransactionType.SALE)
          .reduce((sum, tx) => sum + tx.amount, 0);
        
        const expenses = dayTransactions
          .filter(tx => tx.type === TransactionType.EXPENSE)
          .reduce((sum, tx) => sum + tx.amount, 0);

        const day = new Date(date);
        return {
          day: dayNames[day.getDay()],
          sales: sales,
          expenses: expenses
        };
      });
    } catch (error) {
      console.error('Error loading chart data:', error);
      this.last7Days = [];
    }
  }

  async showInsight() {
    const modal = await this.modalCtrl.create({
      component: InsightComponent,
      cssClass: 'insight-modal',
      presentingElement: await this.modalCtrl.getTop(),
    });
    
    await modal.present();
  }

  
  gotoOnbording(){
    this.router.navigate(['/onboarding'])
  }



  ngAfterViewInit() {
    // Wait a bit for data to load before creating chart
    setTimeout(() => {
      this.createChart();
    }, 500);
  }

  createChart() {
    if (!this.salesChart?.nativeElement || this.last7Days.length === 0) {
      console.warn('Chart element not ready or no data available');
      return;
    }

    const ctx = this.salesChart.nativeElement.getContext('2d');
    
    this.chart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: this.last7Days.map(day => day.day),
        datasets: [{
          label: 'Sales (GHS)',
          data: this.last7Days.map(day => day.sales),
          backgroundColor: 'rgba(189, 224, 121, 0.8)',
          borderColor: 'rgba(189, 224, 121, 1)',
          borderWidth: 2,
          borderRadius: 8,
          borderSkipped: false,
        }, {
          label: 'Expenses (GHS)',
          data: this.last7Days.map(day => day.expenses),
          backgroundColor: 'rgba(255, 99, 132, 0.8)',
          borderColor: 'rgba(255, 99, 132, 1)',
          borderWidth: 2,
          borderRadius: 8,
          borderSkipped: false,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: {
          duration: 1000,
          easing: 'easeInOutQuart'
        },
        plugins: {
          legend: {
            display: true,
            position: 'top',
            labels: {
              color: '#000',
              usePointStyle: true
            }
          },
          tooltip: {
              backgroundColor: 'rgba(0, 0, 0, 0.8)',
              titleColor: '#fff',
              bodyColor: '#fff',
              callbacks: {
                label: function(context) {
                  // Add null check to handle potential null values
                  const value = context.parsed.y;
                  return `GHS ${value ? value.toFixed(2) : '0.00'}`;
                }
              }
            }
        },
        scales: {
          y: {
            beginAtZero: true,
            grid: {
              color: '#000'
            },
            ticks: {
              color: '#002',
              callback: function(value) {
                return 'GHS ' + value;
              }
            }
          },
          x: {
            grid: {
              display: false
            },
            ticks: {
              color: '#000'
            }
          }
        },
        interaction: {
          intersect: false,
          mode: 'index',
        }
      }
    });
  }

  // Formatted numbers for display
  formattedTodaySales = '';
  formattedTodayExpenses = '';
  formattedNetProfit = '';
  formattedTodaySalesCount = 0;

  private formatNumbers() {
    this.formattedTodaySalesCount = Number(this.todaySalesCount);
    this.formattedTodaySales = this.formatCurrency(this.todaySales);
    this.formattedTodayExpenses = this.formatCurrency(this.todayExpenses);
    this.formattedNetProfit = this.formatCurrency(this.netProfit);
  }

  private formatCurrency2(amount: number): string {
    return amount.toFixed(2);
  }

  formatChartAmount(amount: number): string {
    return amount.toString();
  }

  toggleTheme() {
    this.isDarkMode = !this.isDarkMode;
    localStorage.setItem('theme', this.isDarkMode ? 'dark' : 'light');
  }

  get maxSales2(): number {
    return this.last7Days.length > 0 ? Math.max(...this.last7Days.map(day => day.sales)) : 0;
  }

  // Quick Actions
  addSale() {
    this.router.navigate(['/tabs/sales']);
  }

  addExpense() {
    this.router.navigate(['/tabs/expenses']);
  }

  viewHistory() {
    this.router.navigate(['/tabs/transaction-history']);
  }

  monthlyReport() {
    this.notificationService.info('Monthly reports coming soon!', 'Feature');
  }

  quickAdd() {
    this.notificationService.info('Quick add feature coming soon!', 'Feature');
  }

  onSwipe(event: any, transaction: any) {
    console.log('Swiped transaction:', transaction);
  }

  // Statistics methods
  getTotalSales(): number {
    return this.last7Days.reduce((sum, day) => sum + day.sales, 0);
  }

  getAverageSales(): number {
    return this.last7Days.length > 0 ? Math.round(this.getTotalSales() / this.last7Days.length) : 0;
  }

  getHighestSale(): number {
    return this.last7Days.length > 0 ? Math.max(...this.last7Days.map(day => day.sales)) : 0;
  }

  getLowestSale(): number {
    return this.last7Days.length > 0 ? Math.min(...this.last7Days.map(day => day.sales)) : 0;
  }

  formatCurrency(amount: number): string {
    return 'GHS ' + amount.toLocaleString('en-GH', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }

  get maxSales(): number {
    return this.last7Days.length > 0 ? Math.max(...this.last7Days.map(day => day.sales)) : 0;
  }

  updateChartData(newData: any[]) {
    if (this.chart) {
      this.chart.data.labels = newData.map(day => day.day);
      this.chart.data.datasets[0].data = newData.map(day => day.sales);
      this.chart.data.datasets[1].data = newData.map(day => day.expenses);
      this.chart.update('active');
    }
  }

  // Filter method for the chart
  updateFilter(filter: string) {
    this.selectedFilter = filter;
    // In a real app, you would fetch different time period data here
    this.notificationService.info(`Showing data for ${filter}`, 'Filter Applied');
    
    // For now, we'll just update the current data
    if (this.chart) {
      this.chart.update();
    }
  }

  // Utility methods for template
  getTransactionDisplayName(transaction: Transaction): string {
    const tx = transaction as any;
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

  getTimeAgo(date: Date): string {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${Math.floor(diffMs / 86400000)}d ago`;
  }

  getTransactionIcon(transaction: Transaction): string {
    return transaction.type === TransactionType.SALE ? 'arrow-up' : 'arrow-down';
  }

  getTransactionColor(transaction: Transaction): string {
    return transaction.type === TransactionType.SALE ? 'success' : 'danger';
  }

  async refreshPage(event: any) {
    this.isRefreshing = true;
    try {
      await this.loadHomeData();
      this.notificationService.success('Dashboard updated', 'Refresh Complete');
    } catch (error) {
      console.error('Error refreshing data:', error);
      this.notificationService.error('Failed to refresh data', 'Error');
    } finally {
      event.target.complete();
      this.isRefreshing = false;
    }
  }

 async logout(){
    this.router.navigate(['passcode'])
  }
}