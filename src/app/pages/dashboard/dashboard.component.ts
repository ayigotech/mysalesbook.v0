// dashboard.component.ts
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { Router } from '@angular/router';
import { StorageService } from 'src/app/services/storage';
import { NotificationService } from 'src/app/services/notification';
import { Transaction, TransactionType, DailySummary } from 'src/models';

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss'],
  imports: [CommonModule, IonicModule]
})
export class DashboardComponent implements OnInit {
  
  // Current period data - will be populated from storage
  currentData = {
    today: {
      sales: 0,
      expenses: 0,
      profit: 0,
      transactions: 0
    },
    week: {
      sales: 0,
      expenses: 0,
      profit: 0,
      transactions: 0
    },
    month: {
      sales: 0,
      expenses: 0,
      profit: 0,
      transactions: 0
    }
  };

  // Performance metrics
  performanceMetrics = {
    bestDay: {
      day: 'Loading...',
      amount: 0,
      trend: 'up'
    },
    peakHour: {
      hour: 'Loading...',
      percentage: 0
    },
    topCategory: {
      name: 'Loading...',
      percentage: 0
    },
    expenseRatio: {
      percentage: 0,
      trend: 'down'
    }
  };

  // Quick stats
  quickStats = [
    { label: 'Avg Daily Sales', value: 'GHS 0', trend: 'up' },
    { label: 'Customer Growth', value: '+0%', trend: 'up' },
    { label: 'Expense Ratio', value: '0%', trend: 'down' },
    { label: 'Profit Margin', value: '0%', trend: 'up' }
  ];

  // Recent activity
  recentActivity: any[] = [];
  
  selectedPeriod: string = 'today';
  isLoading = true;

  constructor(
    private router: Router,
    private storageService: StorageService,
    private notificationService: NotificationService
  ) {}

  async ngOnInit() {
    await this.loadDashboardData();
  }

  // Load all dashboard data
  async loadDashboardData() {
    this.isLoading = true;
    try {
      await Promise.all([
        this.loadCurrentPeriodData(),
        this.loadPerformanceMetrics(),
        this.loadRecentActivity(),
        this.calculateQuickStats()
      ]);
    } catch (error) {
      console.error('Error loading dashboard data:', error);
      this.notificationService.error('Failed to load dashboard data', 'Data Error');
    } finally {
      this.isLoading = false;
    }
  }

  // Load current period data (today, week, month)
  async loadCurrentPeriodData() {
    try {
      const transactions = await this.storageService.getTransactions();
      const now = new Date();
      
      // Today's data
      const todayKey = now.toISOString().split('T')[0];
      const todayTransactions = transactions.filter(tx => {
        const txDate = new Date(tx.datetime).toISOString().split('T')[0];
        return txDate === todayKey;
      });

      this.currentData.today = this.calculatePeriodData(todayTransactions);

      // Weekly data (last 7 days)
      const weekStart = new Date(now);
      weekStart.setDate(now.getDate() - 7);
      const weekTransactions = transactions.filter(tx => 
        new Date(tx.datetime) >= weekStart
      );
      this.currentData.week = this.calculatePeriodData(weekTransactions);

      // Monthly data (last 30 days)
      const monthStart = new Date(now);
      monthStart.setDate(now.getDate() - 30);
      const monthTransactions = transactions.filter(tx => 
        new Date(tx.datetime) >= monthStart
      );
      this.currentData.month = this.calculatePeriodData(monthTransactions);

    } catch (error) {
      console.error('Error loading period data:', error);
    }
  }

  // Calculate sales, expenses, profit for a set of transactions
  private calculatePeriodData(transactions: Transaction[]): any {
    const sales = transactions
      .filter(tx => tx.type === TransactionType.SALE)
      .reduce((sum, tx) => sum + tx.amount, 0);
    
    const expenses = transactions
      .filter(tx => tx.type === TransactionType.EXPENSE)
      .reduce((sum, tx) => sum + tx.amount, 0);

    return {
      sales,
      expenses,
      profit: sales - expenses,
      transactions: transactions.length
    };
  }

  // Load performance metrics
  async loadPerformanceMetrics() {
    try {
      const transactions = await this.storageService.getTransactions();
      
      // Calculate best day
      const dailyTotals = this.calculateDailyTotals(transactions);
      const bestDay = Object.entries(dailyTotals)
        .reduce((best, [day, data]) => data.sales > best.amount ? { day, amount: data.sales } : best, 
        { day: 'No data', amount: 0 });

      this.performanceMetrics.bestDay = {
        day: this.formatDayName(bestDay.day),
        amount: bestDay.amount,
        trend: 'up'
      };

      // Calculate top category (simplified)
      const categories = this.calculateCategoryTotals(transactions);
      const topCategory = Object.entries(categories)
        .reduce((best, [category, amount]) => amount > best.amount ? { category, amount } : best, 
        { category: 'No data', amount: 0 });

      this.performanceMetrics.topCategory = {
        name: topCategory.category,
        percentage: topCategory.amount > 0 ? Math.round((topCategory.amount / this.currentData.month.sales) * 100) : 0
      };

      // Calculate expense ratio
      const currentData = this.getCurrentData();
      this.performanceMetrics.expenseRatio.percentage = currentData.sales > 0 ? 
        Math.round((currentData.expenses / currentData.sales) * 100) : 0;

    } catch (error) {
      console.error('Error loading performance metrics:', error);
    }
  }

  // Load recent activity (last 10 transactions)
  async loadRecentActivity() {
    try {
      const transactions = await this.storageService.getTransactions();
      
      // Sort by date (newest first) and take last 10
      const recentTransactions = transactions
        .sort((a, b) => new Date(b.datetime).getTime() - new Date(a.datetime).getTime())
        .slice(0, 10);

      this.recentActivity = recentTransactions.map(tx => ({
        type: tx.type === TransactionType.SALE ? 'sale' : 'expense',
        amount: tx.amount,
        description: tx.type === TransactionType.SALE ? 
          (tx as any).customer || 'Sale' : 
          (tx as any).vendor || 'Expense',
        time: this.getTimeAgo(new Date(tx.datetime)),
        icon: tx.type === TransactionType.SALE ? 'arrow-up' : 'arrow-down'
      }));

    } catch (error) {
      console.error('Error loading recent activity:', error);
    }
  }

  // Calculate quick stats
  async calculateQuickStats() {
    const currentData = this.getCurrentData();
    
    // Average daily sales (based on monthly data)
    const avgDailySales = this.currentData.month.transactions > 0 ? 
      this.currentData.month.sales / 30 : 0;

    // Expense ratio
    const expenseRatio = currentData.sales > 0 ? 
      Math.round((currentData.expenses / currentData.sales) * 100) : 0;

    // Profit margin
    const profitMargin = currentData.sales > 0 ? 
      Math.round((currentData.profit / currentData.sales) * 100) : 0;

    this.quickStats = [
      { label: 'Avg Daily Sales', value: `GHS ${Math.round(avgDailySales)}`, trend: 'up' },
      { label: 'Transaction Count', value: currentData.transactions.toString(), trend: 'up' },
      { label: 'Expense Ratio', value: `${expenseRatio}%`, trend: expenseRatio > 70 ? 'down' : 'up' },
      { label: 'Profit Margin', value: `${profitMargin}%`, trend: profitMargin > 20 ? 'up' : 'down' }
    ];
  }

  // Helper methods
  private calculateDailyTotals(transactions: Transaction[]): { [key: string]: { sales: number, expenses: number } } {
    const totals: { [key: string]: { sales: number, expenses: number } } = {};
    
    transactions.forEach(tx => {
      const dateKey = new Date(tx.datetime).toISOString().split('T')[0];
      if (!totals[dateKey]) {
        totals[dateKey] = { sales: 0, expenses: 0 };
      }
      
      if (tx.type === TransactionType.SALE) {
        totals[dateKey].sales += tx.amount;
      } else {
        totals[dateKey].expenses += tx.amount;
      }
    });
    
    return totals;
  }

  private calculateCategoryTotals(transactions: Transaction[]): { [key: string]: number } {
    const categories: { [key: string]: number } = {};
    
    transactions.forEach(tx => {
      const category = (tx as any).category || 'Uncategorized';
      if (!categories[category]) {
        categories[category] = 0;
      }
      categories[category] += tx.amount;
    });
    
    return categories;
  }

  private formatDayName(dateString: string): string {
    if (dateString === 'No data') return 'No data';
    
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) return 'Today';
    if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
    
    return date.toLocaleDateString('en-US', { weekday: 'long' });
  }

  private getTimeAgo(date: Date): string {
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

  // Navigation
  navigateTo(route: string) {
    this.router.navigate([`/tabs/${route}`]);
  }

  // Data helpers
  getCurrentData() {
    return this.currentData[this.selectedPeriod as keyof typeof this.currentData];
  }

  formatCurrency(amount: number): string {
    return 'GHS ' + amount.toLocaleString('en-GH');
  }

  getProfitMargin(): number {
    const data = this.getCurrentData();
    return data.sales > 0 ? Math.round((data.profit / data.sales) * 100) : 0;
  }

  getExpenseRatio(): number {
    const data = this.getCurrentData();
    return data.sales > 0 ? Math.round((data.expenses / data.sales) * 100) : 0;
  }

  // Trend indicators
  getTrendIcon(trend: string): string {
    return trend === 'up' ? 'trending-up' : 'trending-down';
  }

  getTrendColor(trend: string): string {
    return trend === 'up' ? 'success' : 'danger';
  }

  // Quick actions
  quickAction(action: string) {
    switch(action) {
      case 'add_sale':
        this.navigateTo('add-sales');
        break;
      case 'add_expense':
        this.navigateTo('add-expenses');
        break;
      case 'view_history':
        this.navigateTo('transaction-history');
        break;
      case 'view_report':
        this.navigateTo('monthly-report');
        break;
    }
  }

  // Refresh data
  async refreshData(event?: any) {
    console.log('Refreshing dashboard data...');
    await this.loadDashboardData();
    
    // Complete the pull-to-refresh
    if (event) {
      event.target.complete();
    }
    
    this.notificationService.success('Dashboard updated', 'Refresh Complete');
  }
}