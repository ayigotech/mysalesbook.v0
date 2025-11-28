// update-pin.component.ts - Updated with NotificationService
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule, AlertController } from '@ionic/angular';
import { Router } from '@angular/router';
import { StorageService } from '../../services/storage';
import { NotificationService } from '../../services/notification';
import { PinSettings, PinUtils } from 'src/models';

@Component({
  selector: 'app-update-pin',
  templateUrl: './update-pin.component.html',
  styleUrls: ['./update-pin.component.scss'],
  imports: [CommonModule, IonicModule]
})
export class UpdatePinComponent implements OnInit {
  currentPin: string = '';
  newPin: string = '';
  confirmPin: string = '';
  
  currentStep: 'current' | 'new' | 'confirm' = 'current';
  showError: boolean = false;
  errorMessage: string = '';
  isLoading: boolean = false;
  hasExistingPin: boolean = false;
  defaultPin: string = '4321';

  constructor(
    private router: Router,
    private storageService: StorageService,
    private alertCtrl: AlertController,
    private notification: NotificationService // Use NotificationService
  ) {}

  async ngOnInit() {
    await this.checkExistingPin();
  }

  // Check if user has an existing PIN
  async checkExistingPin() {
    try {
      const pinSettings = await this.storageService.getPinSettings();
      this.hasExistingPin = !!pinSettings;
      
      // If no PIN exists, skip current PIN verification
      if (!this.hasExistingPin) {
        this.currentStep = 'new';
      }
    } catch (error) {
      console.error('Error checking existing PIN:', error);
      this.hasExistingPin = false;
      this.currentStep = 'new';
    }
  }

  // Navigation
  goBack() {
    this.router.navigate(['/tabs/settings']);
  }

  // PIN input handling
  addDigit(digit: number) {
    if (this.currentStep === 'current' && this.currentPin.length < 4) {
      this.currentPin += digit.toString();
    } else if (this.currentStep === 'new' && this.newPin.length < 4) {
      this.newPin += digit.toString();
    } else if (this.currentStep === 'confirm' && this.confirmPin.length < 4) {
      this.confirmPin += digit.toString();
    }

    this.showError = false;

    // Auto-advance when PIN is complete
    if (this.currentPin.length === 4 && this.currentStep === 'current') {
      setTimeout(() => this.verifyCurrentPin(), 300);
    } else if (this.newPin.length === 4 && this.currentStep === 'new') {
      setTimeout(() => this.validateNewPin(), 300);
    } else if (this.confirmPin.length === 4 && this.currentStep === 'confirm') {
      setTimeout(() => this.confirmNewPin(), 300);
    }
  }

  removeDigit() {
    if (this.currentStep === 'current' && this.currentPin.length > 0) {
      this.currentPin = this.currentPin.slice(0, -1);
    } else if (this.currentStep === 'new' && this.newPin.length > 0) {
      this.newPin = this.newPin.slice(0, -1);
    } else if (this.currentStep === 'confirm' && this.confirmPin.length > 0) {
      this.confirmPin = this.confirmPin.slice(0, -1);
    }
    this.showError = false;
  }

  // PIN verification and update logic
  async verifyCurrentPin() {
    this.isLoading = true;
    
    try {
      const pinSettings = await this.storageService.getPinSettings();
      const savedPin = pinSettings?.pin || this.defaultPin;
      
      if (this.currentPin === savedPin) {
        this.currentStep = 'new';
        this.showError = false;
      } else {
        this.showError = true;
        this.errorMessage = 'Incorrect current PIN';
        this.currentPin = '';
      }
    } catch (error) {
      this.showError = true;
      this.errorMessage = 'Error verifying PIN';
      this.currentPin = '';
    } finally {
      this.isLoading = false;
    }
  }

  validateNewPin() {
    if (!PinUtils.validatePin(this.newPin)) {
      this.showError = true;
      this.errorMessage = 'PIN must be 4 digits';
      this.newPin = '';
      return;
    }

    const strength = PinUtils.assessPinStrength(this.newPin);
    if (strength === 'weak') {
      this.showWeakPinAlert();
      return;
    }

    // Check if new PIN is same as current/default PIN
    const currentPinToCheck = this.hasExistingPin ? this.currentPin : this.defaultPin;
    if (this.newPin === currentPinToCheck) {
      this.showError = true;
      this.errorMessage = 'New PIN cannot be same as current PIN';
      this.newPin = '';
      return;
    }

    this.currentStep = 'confirm';
    this.showError = false;
  }

  async confirmNewPin() {
    if (this.newPin !== this.confirmPin) {
      this.showError = true;
      this.errorMessage = 'PINs do not match';
      this.confirmPin = '';
      return;
    }

    await this.updatePin();
  }


  // update-pin.component.ts - Fixed version
async updatePin() {
  this.isLoading = true;

  try {
    const existingSettings = await this.storageService.getPinSettings();
    
    // Create updated settings without the 'id' property
    const updatedSettings: PinSettings = {
      pin: this.newPin,
      isEnabled: true,
      createdAt: existingSettings?.createdAt || new Date(),
      lastModified: new Date(),
      failedAttempts: 0, // Reset failed attempts on PIN change
      isLocked: false    // Unlock if previously locked
    };

    await this.storageService.savePinSettings(updatedSettings);
    
    // Use NotificationService instead of toast
    this.notification.success('PIN updated successfully', 'Security Updated');
    
    this.router.navigate(['/tabs/settings']);
    
  } catch (error) {
    this.showError = true;
    this.errorMessage = 'Failed to update PIN';
    this.notification.error('Failed to update PIN. Please try again.');
  } finally {
    this.isLoading = false;
  }
}

  // UI helpers
  getCurrentDisplayPin(): string {
    switch (this.currentStep) {
      case 'current': return this.currentPin;
      case 'new': return this.newPin;
      case 'confirm': return this.confirmPin;
      default: return '';
    }
  }

  getPinDots(): boolean[] {
    const pin = this.getCurrentDisplayPin();
    return Array(4).fill(false).map((_, i) => i < pin.length);
  }

  getStepTitle(): string {
    switch (this.currentStep) {
      case 'current': return 'Enter Current PIN';
      case 'new': return 'Enter New PIN';
      case 'confirm': return 'Confirm New PIN';
      default: return 'Update PIN';
    }
  }

  getStepDescription(): string {
    switch (this.currentStep) {
      case 'current': return 'Verify your identity first';
      case 'new': return 'Choose a secure 4-digit PIN';
      case 'confirm': return 'Re-enter your new PIN';
      default: return '';
    }
  }

  // Alerts
  async showWeakPinAlert() {
    const alert = await this.alertCtrl.create({
      header: 'Weak PIN',
      message: 'This PIN is too easy to guess. Please choose a more secure PIN with random numbers.',
      buttons: [
        {
          text: 'Try Again',
          role: 'cancel',
          handler: () => {
            this.newPin = '';
          }
        },
        {
          text: 'Use Anyway',
          handler: () => {
            this.currentStep = 'confirm';
            this.showError = false;
          }
        }
      ]
    });
    
    await alert.present();
  }
}