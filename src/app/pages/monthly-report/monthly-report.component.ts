// monthly-report.component.ts
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { StorageService } from 'src/app/services/storage';
import { NotificationService } from 'src/app/services/notification';
import { Transaction, TransactionType } from 'src/models';

@Component({
  selector: 'app-monthly-report',
  templateUrl: './monthly-report.component.html',
  styleUrls: ['./monthly-report.component.scss'],
  imports: [CommonModule, IonicModule, FormsModule]
})
export class MonthlyReportComponent implements OnInit {
  selectedMonth: number = new Date().getMonth(); // Current month (0-11)
  currentYear: number = new Date().getFullYear();
  isLoading = true;
  
  monthlyData: { [key: string]: any } = {};
  currentData: any = {};

  // Dynamic months for current year
  months: any[] = [];

  constructor(
    private router: Router,
    private storageService: StorageService,
    private notificationService: NotificationService
  ) {}

  async ngOnInit() {
    this.generateMonthsList();
    await this.loadMonthlyData();
  }

  // Generate months list for current year
  private generateMonthsList() {
    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    
    const currentMonth = new Date().getMonth();
    
    this.months = monthNames.map((name, index) => ({
      value: index,
      label: `${name} ${this.currentYear}`,
      disabled: index > currentMonth // Disable future months
    }));
  }

  // Navigation
  goBack() {
    this.router.navigate(['/tabs/home']);
  }

  // Load real data from storage
  async loadMonthlyData() {
    this.isLoading = true;
    try {
      const transactions = await this.storageService.getTransactions();
      await this.calculateAllMonths(transactions);
      this.updateCurrentData();
    } catch (error) {
      console.error('Error loading monthly data:', error);
      this.notificationService.error('Failed to load monthly report data', 'Data Error');
      this.currentData = this.getDefaultData();
    } finally {
      this.isLoading = false;
    }
  }

  // Calculate data for all months
  private async calculateAllMonths(transactions: Transaction[]) {
    for (let month = 0; month < 12; month++) {
      const monthData = this.calculateMonthData(transactions, month, this.currentYear);
      this.monthlyData[month] = monthData;
    }
  }

  private calculateMonthData(transactions: Transaction[], month: number, year: number): any {
    const monthStart = new Date(year, month, 1);
    const monthEnd = new Date(year, month + 1, 0);
    
    const monthTransactions = transactions.filter(tx => {
      const txDate = new Date(tx.datetime);
      return txDate >= monthStart && txDate <= monthEnd;
    });

    const sales = monthTransactions
      .filter(tx => tx.type === TransactionType.SALE)
      .reduce((sum, tx) => sum + tx.amount, 0);
    
    const expenses = monthTransactions
      .filter(tx => tx.type === TransactionType.EXPENSE)
      .reduce((sum, tx) => sum + tx.amount, 0);

    const profit = sales - expenses;

    // Calculate previous month for comparison
    let previousMonthProfit = 0;
    if (month > 0) {
      previousMonthProfit = this.monthlyData[month - 1]?.profit || 0;
    } else {
      // For January, compare with December of previous year
      const prevYearTransactions = transactions.filter(tx => {
        const txDate = new Date(tx.datetime);
        return txDate >= new Date(year - 1, 11, 1) && txDate <= new Date(year - 1, 11, 31);
      });
      
      const prevYearSales = prevYearTransactions
        .filter(tx => tx.type === TransactionType.SALE)
        .reduce((sum, tx) => sum + tx.amount, 0);
      
      const prevYearExpenses = prevYearTransactions
        .filter(tx => tx.type === TransactionType.EXPENSE)
        .reduce((sum, tx) => sum + tx.amount, 0);
      
      previousMonthProfit = prevYearSales - prevYearExpenses;
    }

    // Calculate additional metrics
    const dailyData = this.calculateDailyMetrics(monthTransactions);
    const categoryData = this.calculateCategoryMetrics(monthTransactions);

    return {
      sales,
      expenses,
      profit,
      previousMonthProfit,
      transactionCount: monthTransactions.length,
      bestDay: dailyData.bestDay,
      worstDay: dailyData.worstDay,
      topCategory: categoryData.topCategory,
      monthName: `${this.getMonthName(month)} ${year}`
    };
  }

  private calculateDailyMetrics(transactions: Transaction[]): any {
    const dailyTotals: { [key: string]: number } = {};
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    transactions.forEach(tx => {
      const dayName = days[new Date(tx.datetime).getDay()];
      if (!dailyTotals[dayName]) {
        dailyTotals[dayName] = 0;
      }
      if (tx.type === TransactionType.SALE) {
        dailyTotals[dayName] += tx.amount;
      }
    });

    let bestDay = 'N/A';
    let worstDay = 'N/A';
    let maxSales = 0;
    let minSales = Infinity;

    Object.entries(dailyTotals).forEach(([day, sales]) => {
      if (sales > maxSales) {
        maxSales = sales;
        bestDay = day;
      }
      if (sales < minSales && sales > 0) {
        minSales = sales;
        worstDay = day;
      }
    });

    return { bestDay, worstDay: worstDay === 'N/A' ? 'N/A' : worstDay };
  }

  private calculateCategoryMetrics(transactions: Transaction[]): any {
    const categoryTotals: { [key: string]: number } = {};

    transactions.forEach(tx => {
      const txAny = tx as any;
      const category = txAny.category || 'Uncategorized';
      if (!categoryTotals[category]) {
        categoryTotals[category] = 0;
      }
      if (tx.type === TransactionType.SALE) {
        categoryTotals[category] += tx.amount;
      }
    });

    let topCategory = 'N/A';
    let maxAmount = 0;

    Object.entries(categoryTotals).forEach(([category, amount]) => {
      if (amount > maxAmount) {
        maxAmount = amount;
        topCategory = category;
      }
    });

    return { topCategory };
  }

  private getMonthName(month: number): string {
    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    return monthNames[month];
  }

  // Data handling
  updateCurrentData() {
    this.currentData = this.monthlyData[this.selectedMonth] || this.getDefaultData();
  }

  onMonthChange() {
    this.updateCurrentData();
  }

  private getDefaultData() {
    return {
      sales: 0,
      expenses: 0,
      profit: 0,
      previousMonthProfit: 0,
      transactionCount: 0,
      bestDay: 'N/A',
      worstDay: 'N/A',
      topCategory: 'N/A',
      monthName: this.getMonthName(this.selectedMonth) + ' ' + this.currentYear
    };
  }

  // Calculations with safe checks
  getProfitGrowth(): number {
    if (!this.currentData?.previousMonthProfit || this.currentData.previousMonthProfit === 0) {
      return this.currentData?.profit > 0 ? 100 : 0;
    }
    const growth = ((this.currentData.profit - this.currentData.previousMonthProfit) / this.currentData.previousMonthProfit) * 100;
    return Math.round(growth * 10) / 10;
  }

  getProfitGrowthClass(): string {
    const growth = this.getProfitGrowth();
    if (growth > 0) return 'positive';
    if (growth < 0) return 'negative';
    return 'neutral';
  }

  getProfitGrowthIcon(): string {
    const growth = this.getProfitGrowth();
    if (growth > 0) return 'trending-up';
    if (growth < 0) return 'trending-down';
    return 'remove';
  }

  getAverageDailyProfit(): number {
    return this.currentData?.profit ? Math.round(this.currentData.profit / 30) : 0;
  }

  getSalesToExpenseRatio(): number {
    if (!this.currentData?.sales || this.currentData.sales === 0) return 0;
    return Math.round((this.currentData.expenses / this.currentData.sales) * 100);
  }

  // Fixed comparison calculations
  getSalesIncrease(): number {
    const currentSales = this.currentData?.sales || 0;
    const previousSales = this.monthlyData[this.selectedMonth - 1]?.sales || 0;
    return currentSales - previousSales;
  }

  getTransactionGrowth(): number {
    const currentTransactions = this.currentData?.transactionCount || 0;
    const previousTransactions = this.monthlyData[this.selectedMonth - 1]?.transactionCount || 0;
    return currentTransactions - previousTransactions;
  }

  // Utility methods
  formatCurrency(amount: number): string {
    if (!amount) return 'GHS 0';
    return 'GHS ' + amount.toLocaleString('en-GH');
  }

  formatNumber(num: number): string {
    if (!num) return '0';
    return num.toLocaleString('en-GH');
  }

  async shareReport() {
    try {
      const monthName = this.currentData.monthName || this.getMonthName(this.selectedMonth) + ' ' + this.currentYear;
      const report = `
Monthly Report - ${monthName}
Profit: ${this.formatCurrency(this.currentData.profit)}
Sales: ${this.formatCurrency(this.currentData.sales)}
Expenses: ${this.formatCurrency(this.currentData.expenses)}
Growth: ${this.getProfitGrowth()}%
Transactions: ${this.currentData.transactionCount}
Best Day: ${this.currentData.bestDay}
Top Category: ${this.currentData.topCategory}
      `.trim();
      
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(report);
        this.notificationService.success('Report copied to clipboard!', 'Ready to Share');
      } else {
        const textArea = document.createElement('textarea');
        textArea.value = report;
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        this.notificationService.success('Report copied to clipboard!', 'Ready to Share');
      }
    } catch (error) {
      console.error('Error sharing report:', error);
      this.notificationService.error('Failed to share report', 'Error');
    }
  }

  // Refresh data
  async refreshData(event?: any) {
    try {
      await this.loadMonthlyData();
      this.notificationService.success('Monthly report updated', 'Refresh Complete');
    } catch (error) {
      console.error('Error refreshing data:', error);
      this.notificationService.error('Failed to refresh report', 'Error');
    } finally {
      if (event) {
        event.target.complete();
      }
    }
  }

  // Helper method to check if month has data
  hasDataForMonth(month: number): boolean {
    return this.monthlyData[month]?.transactionCount > 0;
  }

  // Get month status for display
  getMonthStatus(month: number): string {
    if (month > new Date().getMonth()) return 'Upcoming';
    return this.hasDataForMonth(month) ? 'Has Data' : 'No Data';
  }
}