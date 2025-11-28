// insight.component.ts
import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule, ModalController } from '@ionic/angular';

@Component({
  selector: 'app-insight',
  templateUrl: './insight.component.html',
  styleUrls: ['./insight.component.scss'],
  imports: [CommonModule, IonicModule]
})
export class InsightComponent {
  
  insights = [
    {
      title: 'Profit Trend',
      value: '+15%',
      description: 'Your profit increased this week',
      trend: 'up',
      icon: 'trending-up',
      color: 'success'
    },
    {
      title: 'Best Day',
      value: 'Friday',
      description: 'Highest sales day this week',
      trend: 'up',
      icon: 'calendar',
      color: 'primary'
    },
    {
      title: 'Expense Alert',
      value: '65%',
      description: 'of sales go to expenses',
      trend: 'down',
      icon: 'warning',
      color: 'warning'
    },
    {
      title: 'Customer Growth',
      value: '+8%',
      description: 'New customers this month',
      trend: 'up',
      icon: 'people',
      color: 'success'
    }
  ];

  recommendations = [
    'Try opening 1 hour earlier on Mondays',
    'Consider bulk buying to reduce supply costs',
    'Your peak hours are 2-4PM - focus marketing then',
    'Friday is your best day - plan special offers'
  ];

  constructor(private modalCtrl: ModalController) {}

  close() {
    this.modalCtrl.dismiss();
  }

  // Prevent modal close when clicking inside content
  onContentClick(event: Event) {
    event.stopPropagation();
  }
}