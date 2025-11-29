import { Component } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { IonApp, IonRouterOutlet } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { Platform } from '@ionic/angular';
import { registerAllIcons } from './icons';
// import { MatDatepickerModule } from '@angular/material/datepicker';
// import { MatNativeDateModule } from '@angular/material/core';
// import { MatInputModule } from '@angular/material/input';
// import { BrowserAnimationsModule } from '@angular/platform-browser/animations';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  imports: [IonApp, 
    IonRouterOutlet,
    // MatDatepickerModule,
    // MatNativeDateModule,
    // MatInputModule,
    // BrowserAnimationsModule
  ],
})



export class AppComponent {
  isLoading: boolean = true;
  currentUrl = '';

  constructor(
    // private authService: AuthService,
    private router: Router,
    private platform: Platform
  ) {

      registerAllIcons();

       this.router.events.subscribe(event => {
      if (event instanceof NavigationEnd) {
        this.currentUrl = event.url;
        console.log('📍 Current route:', this.currentUrl);
      }
    }
  );

  }
}
