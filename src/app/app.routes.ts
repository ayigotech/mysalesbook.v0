// app.routes.ts
import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'splash',
    pathMatch: 'full'
  },
  {
    path: 'splash',
    loadComponent: () => import('./pages/splash/splash.component').then(m => m.SplashComponent)
  },
  {
    path: 'onboarding',
    loadComponent: () => import('./pages/onboarding/onboarding.component').then(m => m.OnboardingComponent)
  },
    {
        path: 'passcode',
        loadComponent: () => import('./pages/passcode/passcode.component').then(m => m.PasscodeComponent)
      },
      {
        path: 'update-pin',
        loadComponent: () => import('./pages/update-pin/update-pin.component').then(m => m.UpdatePinComponent)
      },
  {
    path: 'tabs',
    loadComponent: () => import('./pages/tabs/tabs.component').then(m => m.TabsComponent),
    children: [
      {
        path: 'home',
        loadComponent: () => import('./home/home.page').then(m => m.HomePage)
      },
      {
        path: 'sales',
        loadComponent: () => import('./pages/add-sales/add-sales.component').then(m => m.AddSalesComponent)
      },
      {
        path: 'expenses',
        loadComponent: () => import('./pages/add-expenses/add-expenses.component').then(m => m.AddExpensesComponent)
      },
        {
        path: 'transaction',
        loadComponent: () => import('./pages/transaction-history/transaction-history.component').then(m => m.TransactionHistoryComponent)
      },
      {
        path: 'reports',
        loadComponent: () => import('./pages/monthly-report/monthly-report.component').then(m => m.MonthlyReportComponent)
      },
      {
        path: 'dashboard',
        loadComponent: () => import('./pages/dashboard/dashboard.component').then(m => m.DashboardComponent)
      },
      {
        path: 'monthly',
        loadComponent: () => import('./pages/monthly-report/monthly-report.component').then(m => m.MonthlyReportComponent)
      },
      {
        path: 'settings',
        loadComponent: () => import('./pages/settings/settings.component').then(m => m.SettingsComponent)
      },
      {
        path: '',
        redirectTo: '/tabs/home',
        pathMatch: 'full'
      }
    ]
  },
  {
    path: '**',
    redirectTo: 'splash'
  },
  

];