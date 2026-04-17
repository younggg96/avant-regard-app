import React from "react";

// Simple event emitter implementation for React Native
class SimpleEventEmitter {
  private listeners: { [key: string]: Function[] } = {};

  on(event: string, listener: Function) {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event].push(listener);
  }

  off(event: string, listener: Function) {
    if (!this.listeners[event]) return;
    this.listeners[event] = this.listeners[event].filter((l) => l !== listener);
  }

  emit(event: string, data: any) {
    if (!this.listeners[event]) return;
    this.listeners[event].forEach((listener) => listener(data));
  }
}

// Event emitter for toast notifications
const toastEmitter = new SimpleEventEmitter();

interface AlertButton {
  text?: string;
  onPress?: () => void;
  style?: "default" | "cancel" | "destructive";
}

interface ToastConfig {
  title: string;
  message?: string;
  buttons?: AlertButton[];
  duration?: number;
}

// Alert utility that mimics React Native Alert.alert API
class AlertUtil {
  static alert(
    title: string,
    message?: string,
    buttons?: AlertButton[],
    options?: { cancelable?: boolean }
  ): void {
    toastEmitter.emit("show", {
      title,
      message,
      buttons,
      duration: 1000,
    });
  }

  static show(title: string, message?: string, duration: number = 1000): void {
    toastEmitter.emit("show", {
      title,
      message,
      duration,
    });
  }
}

export { AlertUtil as Alert, toastEmitter };
export type { ToastConfig, AlertButton };
