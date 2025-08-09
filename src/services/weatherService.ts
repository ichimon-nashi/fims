// src/services/weatherService.ts - Weather service with session-based caching
interface WeatherData {
  location: string;
  temperature: number;
  description: string;
  icon: string;
  humidity: number;
  windSpeed?: number;
  pressure?: number;
  error?: string;
  isMockData?: boolean;
}

interface WeatherCache {
  data: WeatherData;
  timestamp: number;
  sessionId: string;
}

class WeatherService {
  private static instance: WeatherService;
  private cache: Map<string, WeatherCache> = new Map();
  private readonly CACHE_DURATION = 10 * 60 * 1000; // 10 minutes (matching OpenWeather update frequency)
  private readonly SESSION_CACHE_KEY = 'weather_session_cache';

  private constructor() {
    // Load cache from sessionStorage on initialization
    this.loadCacheFromSession();
  }

  public static getInstance(): WeatherService {
    if (!WeatherService.instance) {
      WeatherService.instance = new WeatherService();
    }
    return WeatherService.instance;
  }

  /**
   * Get current session ID (based on login time or user ID)
   */
  private getSessionId(): string {
    // Try to get session ID from sessionStorage first
    let sessionId = sessionStorage.getItem('weather_session_id');
    
    if (!sessionId) {
      // Create new session ID based on current time
      sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      sessionStorage.setItem('weather_session_id', sessionId);
    }
    
    return sessionId;
  }

  /**
   * Load cache from sessionStorage
   */
  private loadCacheFromSession(): void {
    try {
      const cached = sessionStorage.getItem(this.SESSION_CACHE_KEY);
      if (cached) {
        const parsedCache = JSON.parse(cached);
        const currentSessionId = this.getSessionId();
        
        // Only load cache if it's from the current session
        Object.entries(parsedCache).forEach(([key, value]: [string, any]) => {
          if (value.sessionId === currentSessionId && this.isCacheValid(value)) {
            this.cache.set(key, value);
          }
        });
        
        console.log('🔄 Loaded weather cache from session storage');
      }
    } catch (error) {
      console.warn('Failed to load weather cache from session storage:', error);
    }
  }

  /**
   * Save cache to sessionStorage
   */
  private saveCacheToSession(): void {
    try {
      const cacheObj = Object.fromEntries(this.cache);
      sessionStorage.setItem(this.SESSION_CACHE_KEY, JSON.stringify(cacheObj));
    } catch (error) {
      console.warn('Failed to save weather cache to session storage:', error);
    }
  }

  /**
   * Get weather data with session-based caching
   */
  public async getWeather(base: string, forceRefresh: boolean = false): Promise<WeatherData> {
    const cacheKey = `weather_${base.toUpperCase()}`;
    const cached = this.cache.get(cacheKey);
    const currentSessionId = this.getSessionId();

    // Check if we have valid cached data for this session
    if (!forceRefresh && cached && cached.sessionId === currentSessionId && this.isCacheValid(cached)) {
      console.log('🌤️ Using cached weather data for base:', base);
      return cached.data;
    }

    try {
      console.log('🌐 Fetching fresh weather data for base:', base);
      const weatherData = await this.fetchWeatherFromAPI(base);
      
      // Cache the successful result with current session ID
      const cacheEntry: WeatherCache = {
        data: weatherData,
        timestamp: Date.now(),
        sessionId: currentSessionId,
      };
      
      this.cache.set(cacheKey, cacheEntry);
      this.saveCacheToSession();

      return weatherData;
    } catch (error) {
      console.error('❌ Weather API error:', error);
      
      // If we have old cached data from this session, return it with error indication
      if (cached && cached.sessionId === currentSessionId) {
        console.warn('⚠️ Returning cached weather data due to API error');
        return {
          ...cached.data,
          error: 'Unable to fetch live weather data (using cached)',
        };
      }

      // Return fallback data if no cache available
      const fallbackData = this.getFallbackWeatherData(base);
      fallbackData.error = error instanceof Error ? error.message : 'Weather service unavailable';
      
      return fallbackData;
    }
  }

  /**
   * Fetch weather data from API
   */
  private async fetchWeatherFromAPI(base: string): Promise<WeatherData> {
    const response = await fetch(`/api/weather?base=${encodeURIComponent(base)}`);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: Failed to fetch weather data`);
    }
    
    const data = await response.json();
    console.log('Weather data received from API:', data);
    
    return data;
  }

  /**
   * Get fallback weather data for a base
   */
  private getFallbackWeatherData(base: string): WeatherData {
    const locationMap: { [key: string]: string } = {
      'KHH': '高雄',
      'TSA': '桃園',
      'RMQ': '台中',
    };

    return {
      location: locationMap[base.toUpperCase()] || '未知地點',
      temperature: 28,
      description: '晴朗',
      icon: '☀️',
      humidity: 65,
      isMockData: true,
    };
  }

  /**
   * Check if cached data is still valid
   */
  private isCacheValid(cached: WeatherCache): boolean {
    return Date.now() - cached.timestamp < this.CACHE_DURATION;
  }

  /**
   * Clear cache for new session (call this on login)
   */
  public clearCacheForNewSession(): void {
    console.log('🗑️ Clearing weather cache for new session');
    this.cache.clear();
    sessionStorage.removeItem(this.SESSION_CACHE_KEY);
    sessionStorage.removeItem('weather_session_id');
    
    // Generate new session ID
    this.getSessionId();
  }

  /**
   * Get cache status for debugging
   */
  public getCacheStatus(): { [key: string]: { age: number; hasData: boolean; sessionId: string } } {
    const status: { [key: string]: { age: number; hasData: boolean; sessionId: string } } = {};
    
    this.cache.forEach((value, key) => {
      status[key] = {
        age: Date.now() - value.timestamp,
        hasData: !!value.data,
        sessionId: value.sessionId,
      };
    });
    
    return status;
  }

  /**
   * Preload weather data for user's base (call once after login)
   */
  public async preloadWeatherForBase(base: string): Promise<void> {
    try {
      console.log('🚀 Preloading weather data for base:', base);
      await this.getWeather(base);
    } catch (error) {
      console.warn('Failed to preload weather data:', error);
    }
  }
}

export default WeatherService;