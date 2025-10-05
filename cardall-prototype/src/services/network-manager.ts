/**
 * 统一网络管理器
 * 提供网络状态检测、监控和自适应同步策略
 */

// 网络质量等级
export type NetworkQuality = 'excellent' | 'good' | 'fair' | 'poor' | 'offline';

// 网络事件类型
export type NetworkEventType =
  | 'online'
  | 'offline'
  | 'connection-change'
  | 'quality-change'
  | 'error'
  | 'sync-ready'
  | 'sync-advisory';

// 网络配置
export interface NetworkConfig {
  qualityThresholds: {
    excellent: { rtt: number; downlink: number };
    good: { rtt: number; downlink: number };
    fair: { rtt: number; downlink: number };
    poor: { rtt: number; downlink: number };
  };
  healthCheck: {
    enabled: boolean;
    endpoints: string[];
    timeout: number;
    successThreshold: number;
  };
}

// 网络状态
export interface NetworkState {
  isOnline: boolean;
  quality: NetworkQuality;
  connectionType: string;
  effectiveType: string;
  downlink: number;
  rtt: number;
  saveData: boolean;
  lastUpdated: Date;
}

// 网络事件
export interface NetworkEvent {
  type: NetworkEventType;
  timestamp: Date;
  previousState?: NetworkState;
  currentState?: NetworkState;
  data?: any;
}

// 网络监控器接口
export interface NetworkMonitor {
  startMonitoring(): void;
  stopMonitoring(): void;
  getCurrentState(): NetworkState;
  subscribe(listener: (event: NetworkEvent) => void): () => void;
}

// 简化的网络管理器实现
export class NetworkManager implements NetworkMonitor {
  private static instance: NetworkManager;
  private isMonitoring = false;
  private listeners: ((event: NetworkEvent) => void)[] = [];
  private currentState: NetworkState;

  constructor() {
    this.currentState = {
      isOnline: navigator.onLine,
      quality: 'offline',
      connectionType: 'unknown',
      effectiveType: 'unknown',
      downlink: 0,
      rtt: 0,
      saveData: false,
      lastUpdated: new Date()
    };
  }

  static getInstance(): NetworkManager {
    if (!NetworkManager.instance) {
      NetworkManager.instance = new NetworkManager();
    }
    return NetworkManager.instance;
  }

  startMonitoring(): void {
    if (this.isMonitoring) return;

    this.isMonitoring = true;
    this.setupEventListeners();
    this.updateConnectionInfo();
  }

  stopMonitoring(): void {
    this.isMonitoring = false;
    this.removeEventListeners();
  }

  getCurrentState(): NetworkState {
    return { ...this.currentState };
  }

  subscribe(listener: (event: NetworkEvent) => void): () => void {
    this.listeners.push(listener);
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  private setupEventListeners(): void {
    window.addEventListener('online', this.handleOnline.bind(this));
    window.addEventListener('offline', this.handleOffline.bind(this));
  }

  private removeEventListeners(): void {
    window.removeEventListener('online', this.handleOnline.bind(this));
    window.removeEventListener('offline', this.handleOffline.bind(this));
  }

  private handleOnline(): void {
    const previousState = { ...this.currentState };
    this.currentState.isOnline = true;
    this.currentState.lastUpdated = new Date();

    this.emitEvent({
      type: 'online',
      timestamp: new Date(),
      previousState,
      currentState: { ...this.currentState }
    });
  }

  private handleOffline(): void {
    const previousState = { ...this.currentState };
    this.currentState.isOnline = false;
    this.currentState.quality = 'offline';
    this.currentState.lastUpdated = new Date();

    this.emitEvent({
      type: 'offline',
      timestamp: new Date(),
      previousState,
      currentState: { ...this.currentState }
    });
  }

  private updateConnectionInfo(): void {
    if ('connection' in navigator) {
      const connection = (navigator as any).connection;
      this.currentState.connectionType = connection.type || 'unknown';
      this.currentState.effectiveType = connection.effectiveType || 'unknown';
      this.currentState.downlink = connection.downlink || 0;
      this.currentState.rtt = connection.rtt || 0;
      this.currentState.saveData = connection.saveData || false;
      this.currentState.quality = this.calculateQuality();
      this.currentState.lastUpdated = new Date();
    }
  }

  private calculateQuality(): NetworkQuality {
    if (!this.currentState.isOnline) return 'offline';

    const { rtt, downlink } = this.currentState;

    if (rtt < 100 && downlink > 2) return 'excellent';
    if (rtt < 300 && downlink > 1) return 'good';
    if (rtt < 1000 && downlink > 0.5) return 'fair';
    return 'poor';
  }

  private emitEvent(event: NetworkEvent): void {
    this.listeners.forEach(listener => {
      try {
        listener(event);
      } catch (error) {
        console.warn('Network event listener error:', error);
      }
    });
  }
}

// 导出单例实例
export const networkManager = NetworkManager.getInstance();

// 导出便捷函数
export const startNetworkMonitoring = () => {
  networkManager.startMonitoring();
  return networkManager;
};

export const stopNetworkMonitoring = () => {
  networkManager.stopMonitoring();
};

export const getNetworkState = () => {
  return networkManager.getCurrentState();
};