// passcode.component.ts - Updated with StorageService
import { Component, OnInit, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { Router } from '@angular/router';
import { StorageService } from '../../services/storage';
import { NotificationService } from '../../services/notification';
import { 
  PinSettings, 
  SecuritySettings, 
  PinUtils, 
  DEFAULT_SECURITY_SETTINGS,
  PinValidationResult,
  PinAuthState
} from 'src/models';

@Component({
  selector: 'app-passcode',
  templateUrl: './passcode.component.html',
  styleUrls: ['./passcode.component.scss'],
  imports: [CommonModule, IonicModule]
})
export class PasscodeComponent implements OnInit {
  enteredPin: string = '';
  maxLength: number = 4;
  showError: boolean = false;
  errorMessage: string = '';
  isSettingUp: boolean = false;
  isLandscape: boolean = false;
  securitySettings: SecuritySettings = DEFAULT_SECURITY_SETTINGS;
  defaultPin: string = '4321';

  constructor(
    private router: Router,
    private storageService: StorageService,
    private notification: NotificationService
  ) {}

  async ngOnInit() {
    this.checkOrientation();
    await this.loadSecuritySettings();
    await this.initializePinSetup();
  }

  private async loadSecuritySettings() {
    try {
      // You might want to store security settings in StorageService too
      const savedSettings = localStorage.getItem('security_settings');
      if (savedSettings) {
        this.securitySettings = { ...DEFAULT_SECURITY_SETTINGS, ...JSON.parse(savedSettings) };
      }
    } catch (error) {
      console.error('Error loading security settings:', error);
    }
  }

  private async initializePinSetup() {
    try {
      const pinSettings = await this.storageService.getPinSettings();
      this.isSettingUp = !pinSettings;
      
      if (!pinSettings) {
        // Initialize with default PIN
        await this.initializeDefaultPin();
      } else {
        // Check if account is locked
        await this.checkAccountLock(pinSettings);
      }
    } catch (error) {
      console.error('Error initializing PIN setup:', error);
      this.isSettingUp = true;
      await this.initializeDefaultPin();
    }
  }

  private async initializeDefaultPin() {
    try {
      const pinSettings: PinSettings = {
        pin: this.defaultPin,
        isEnabled: true,
        createdAt: new Date(),
        lastModified: new Date(),
        failedAttempts: 0,
        isLocked: false
      };
      
      await this.storageService.savePinSettings(pinSettings);
    } catch (error) {
      console.error('Error initializing default PIN:', error);
      this.notification.error('Failed to initialize security settings');
    }
  }

  private async checkAccountLock(pinSettings: PinSettings) {
    if (pinSettings.isLocked && pinSettings.lockUntil) {
      const lockUntil = new Date(pinSettings.lockUntil);
      if (new Date() < lockUntil) {
        const minutesLeft = Math.ceil((lockUntil.getTime() - new Date().getTime()) / (1000 * 60));
        this.showError = true;
        this.errorMessage = `Account locked. Try again in ${minutesLeft} minutes.`;
      } else {
        // Clear lockout if time has passed
        await this.clearLockout(pinSettings);
      }
    }
  }

  private async clearLockout(pinSettings: PinSettings) {
    try {
      const updatedSettings: PinSettings = {
        ...pinSettings,
        failedAttempts: 0,
        isLocked: false,
        lockUntil: undefined
      };
      await this.storageService.savePinSettings(updatedSettings);
    } catch (error) {
      console.error('Error clearing lockout:', error);
    }
  }

  @HostListener('window:resize')
  onResize() {
    this.checkOrientation();
  }

  @HostListener('window:orientationchange')
  onOrientationChange() {
    this.checkOrientation();
  }

  private checkOrientation() {
    this.isLandscape = window.innerWidth > window.innerHeight;
  }

  addDigit(digit: number) {
    if (this.enteredPin.length < this.maxLength) {
      this.enteredPin += digit.toString();
      this.showError = false;
      
      if (this.enteredPin.length === this.maxLength) {
        setTimeout(() => this.isSettingUp ? this.setupNewPin() : this.verifyPin(), 300);
      }
    }
  }

  removeDigit() {
    if (this.enteredPin.length > 0) {
      this.enteredPin = this.enteredPin.slice(0, -1);
      this.showError = false;
    }
  }

  async verifyPin() {
    try {
      const validation = await this.validatePinAttempt();
      
      if (validation.isLocked) {
        this.handleLockedAccount(validation);
        return;
      }

      const pinSettings = await this.storageService.getPinSettings();
      const savedPin = pinSettings?.pin || this.defaultPin;
      
      if (this.enteredPin === savedPin) {
        await this.handleSuccessfulAuth();
      } else {
        await this.handleFailedAttempt(pinSettings);
      }
    } catch (error) {
      console.error('Error verifying PIN:', error);
      this.showError = true;
      this.errorMessage = 'Error verifying PIN. Please try again.';
      this.enteredPin = '';
    }
  }

  private async validatePinAttempt(): Promise<PinValidationResult> {
    const pinSettings = await this.storageService.getPinSettings();
    
    if (pinSettings?.isLocked && pinSettings.lockUntil) {
      const lockUntil = new Date(pinSettings.lockUntil);
      if (new Date() < lockUntil) {
        const lockTimeRemaining = Math.ceil((lockUntil.getTime() - new Date().getTime()) / (1000 * 60));
        return {
          isValid: false,
          isLocked: true,
          remainingAttempts: 0,
          lockTimeRemaining
        };
      }
    }

    const failedAttempts = pinSettings?.failedAttempts || 0;
    const remainingAttempts = this.securitySettings.maxAttempts - failedAttempts;

    return {
      isValid: false,
      isLocked: false,
      remainingAttempts
    };
  }

  private async handleSuccessfulAuth() {
    try {
      const pinSettings = await this.storageService.getPinSettings();
      if (pinSettings) {
        // Reset failed attempts and clear lockout
        const updatedSettings: PinSettings = {
          ...pinSettings,
          failedAttempts: 0,
          isLocked: false,
          lockUntil: undefined
        };
        await this.storageService.savePinSettings(updatedSettings);
      }

      // Set authentication state
      const authState: PinAuthState = {
        isAuthenticated: true,
        authenticationTime: new Date(),
        sessionExpiry: new Date(Date.now() + this.securitySettings.sessionTimeout * 60 * 1000),
        requiresReauth: false
      };
      
      // Store auth state in localStorage for quick access
      localStorage.setItem('pin_auth_state', JSON.stringify(authState));
      
      this.router.navigate(['/onboarding']);
      
    } catch (error) {
      console.error('Error handling successful auth:', error);
      this.notification.error('Authentication error');
    }
  }

  private async handleFailedAttempt(pinSettings: PinSettings | null) {
    try {
      const failedAttempts = (pinSettings?.failedAttempts || 0) + 1;
      
      const updatedSettings: PinSettings = {
        pin: pinSettings?.pin || this.defaultPin,
        isEnabled: true,
        createdAt: pinSettings?.createdAt || new Date(),
        lastModified: new Date(),
        failedAttempts: failedAttempts,
        isLocked: failedAttempts >= this.securitySettings.maxAttempts,
        lockUntil: failedAttempts >= this.securitySettings.maxAttempts 
          ? new Date(Date.now() + this.securitySettings.lockoutDuration * 60 * 1000)
          : undefined
      };

      await this.storageService.savePinSettings(updatedSettings);

      const remainingAttempts = this.securitySettings.maxAttempts - failedAttempts;

      if (failedAttempts >= this.securitySettings.maxAttempts) {
        this.showError = true;
        this.errorMessage = `Too many failed attempts. Account locked for ${this.securitySettings.lockoutDuration} minutes.`;
      } else {
        this.showError = true;
        this.errorMessage = `Incorrect PIN. ${remainingAttempts} attempt(s) remaining.`;
      }
      
      this.enteredPin = '';
      
      setTimeout(() => {
        this.showError = false;
      }, 3000);
      
    } catch (error) {
      console.error('Error handling failed attempt:', error);
      this.showError = true;
      this.errorMessage = 'Authentication error. Please try again.';
      this.enteredPin = '';
    }
  }

  private handleLockedAccount(validation: PinValidationResult) {
    this.showError = true;
    this.errorMessage = `Account locked. Try again in ${validation.lockTimeRemaining} minutes.`;
    this.enteredPin = '';
  }

  async setupNewPin() {
    try {
      if (PinUtils.validatePin(this.enteredPin)) {
        const pinStrength = PinUtils.assessPinStrength(this.enteredPin);
        
        if (pinStrength === 'weak') {
          this.showError = true;
          this.errorMessage = 'Please choose a stronger PIN. Avoid simple patterns.';
          this.enteredPin = '';
          return;
        }

        const pinSettings: PinSettings = {
          pin: this.enteredPin,
          isEnabled: true,
          createdAt: new Date(),
          lastModified: new Date(),
          failedAttempts: 0,
          isLocked: false
        };
        
        await this.storageService.savePinSettings(pinSettings);
        await this.handleSuccessfulAuth();
      }
    } catch (error) {
      console.error('Error setting up new PIN:', error);
      this.showError = true;
      this.errorMessage = 'Failed to setup PIN. Please try again.';
      this.enteredPin = '';
    }
  }

  getPinDots(): boolean[] {
    return Array(this.maxLength).fill(false).map((_, i) => i < this.enteredPin.length);
  }

  // Development helper
  async skipAuth() {
    await this.handleSuccessfulAuth();
  }

toSplash(){
  this.router.navigate(['/splash'])
}
}