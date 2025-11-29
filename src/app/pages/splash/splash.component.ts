import { Component, inject, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { IonContent, IonIcon } from "@ionic/angular/standalone";

@Component({
  selector: 'app-splash',
  templateUrl: './splash.component.html',
  styleUrls: ['./splash.component.scss'],
  imports: [IonContent],
})
export class SplashComponent  implements OnInit {
private router = inject(Router);

  ngOnInit() {
    setTimeout(() => {
      this.router.navigate(['/passcode']);
    }, 5000);
  }

}
