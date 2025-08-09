// src/app/api/weather/route.ts - Enhanced with comprehensive caching and rate limiting
import { NextRequest, NextResponse } from 'next/server';

// Base location mapping
const BASE_LOCATIONS = {
  'TSA': {
    name: '松山',
    lat: 25.0676,
    lon: 121.5527
  },
  'KHH': {
    name: '高雄',
    lat: 22.6273,
    lon: 120.3014
  },
  'RMQ': {
    name: '台中',
    lat: 24.2621,
    lon: 120.6244
  }
};

// Server-side cache to prevent rapid API calls
const apiCache = new Map<string, { data: any; timestamp: number; sessionId?: string }>();
const CACHE_DURATION = 10 * 60 * 1000; // 10 minutes server-side cache
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const MAX_REQUESTS_PER_MINUTE = 8; // Conservative limit for free tier

// Rate limiting per IP
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

// Track API calls for monitoring
let totalApiCalls = 0;
let cacheHits = 0;

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const rateLimit = rateLimitMap.get(ip);
  
  if (!rateLimit || now > rateLimit.resetTime) {
    // Reset or create new rate limit window
    rateLimitMap.set(ip, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
    return false;
  }
  
  if (rateLimit.count >= MAX_REQUESTS_PER_MINUTE) {
    console.warn(`⚠️ Rate limit exceeded for IP: ${ip} (${rateLimit.count}/${MAX_REQUESTS_PER_MINUTE})`);
    return true;
  }
  
  rateLimit.count++;
  return false;
}

function getClientIP(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  const realIP = request.headers.get('x-real-ip');
  
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  
  if (realIP) {
    return realIP.trim();
  }
  
  return 'unknown';
}

function getWeatherIcon(condition: string): string {
  const iconMap: { [key: string]: string } = {
    'clear': '☀️',
    'clouds': '☁️',
    'rain': '🌧️',
    'drizzle': '🌦️',
    'thunderstorm': '⛈️',
    'snow': '❄️',
    'mist': '🌫️',
    'fog': '🌫️',
    'haze': '🌫️',
    'dust': '🌪️',
    'sand': '🌪️',
    'ash': '🌋',
    'squall': '💨',
    'tornado': '🌪️'
  };
  return iconMap[condition.toLowerCase()] || '☀️';
}

function generateMockWeatherData(location: any) {
  const conditions = [
    { desc: '晴朗', icon: '☀️' },
    { desc: '多雲', icon: '⛅' },
    { desc: '陰天', icon: '☁️' },
    { desc: '小雨', icon: '🌦️' },
    { desc: '微風', icon: '🌤️' }
  ];
  
  const randomCondition = conditions[Math.floor(Math.random() * conditions.length)];
  
  return {
    location: location.name,
    temperature: Math.floor(Math.random() * 12) + 22, // 22-34°C realistic range
    description: randomCondition.desc,
    icon: randomCondition.icon,
    humidity: Math.floor(Math.random() * 40) + 45, // 45-85% realistic range
    windSpeed: Math.round((Math.random() * 15 + 2) * 10) / 10, // 2-17 m/s
    pressure: Math.floor(Math.random() * 50) + 1000, // 1000-1050 hPa
    isMockData: true,
    timestamp: Date.now()
  };
}

export async function GET(request: NextRequest) {
  const clientIP = getClientIP(request);
  const startTime = Date.now();
  
  // Check rate limiting
  if (isRateLimited(clientIP)) {
    return NextResponse.json(
      { 
        error: 'Too many requests. Please try again later.',
        retryAfter: 60
      },
      { 
        status: 429,
        headers: {
          'Retry-After': '60',
          'X-RateLimit-Limit': MAX_REQUESTS_PER_MINUTE.toString(),
          'X-RateLimit-Remaining': '0'
        }
      }
    );
  }

  try {
    const { searchParams } = new URL(request.url);
    const base = searchParams.get('base')?.toUpperCase() || 'TSA';
    const forceRefresh = searchParams.get('refresh') === 'true';
    const sessionId = searchParams.get('sessionId') || 'unknown';
    
    console.log(`🌤️ Weather API request: base=${base}, IP=${clientIP}, session=${sessionId.slice(-8)}, force=${forceRefresh}`);
    
    // Get location info
    const location = BASE_LOCATIONS[base as keyof typeof BASE_LOCATIONS] || BASE_LOCATIONS.TSA;
    const cacheKey = `weather_${base}`;
    
    // Check server-side cache first (unless force refresh)
    if (!forceRefresh) {
      const cached = apiCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
        cacheHits++;
        console.log(`📦 Cache HIT for ${base} (age: ${Math.round((Date.now() - cached.timestamp) / 1000)}s)`);
        
        return NextResponse.json({
          ...cached.data,
          fromCache: true,
          cacheAge: Date.now() - cached.timestamp,
          stats: {
            totalApiCalls,
            cacheHits,
            cacheHitRatio: totalApiCalls > 0 ? Math.round((cacheHits / totalApiCalls) * 100) : 0
          }
        });
      }
    }
    
    // Use OpenWeatherMap API
    const API_KEY = process.env.OPENWEATHER_API_KEY;
    
    if (!API_KEY) {
      console.log('⚠️ No OpenWeatherMap API key found, generating realistic mock data');
      const mockData = generateMockWeatherData(location);
      
      // Cache mock data too
      apiCache.set(cacheKey, { 
        data: mockData, 
        timestamp: Date.now(),
        sessionId 
      });
      
      return NextResponse.json(mockData);
    }

    const weatherUrl = `https://api.openweathermap.org/data/2.5/weather?lat=${location.lat}&lon=${location.lon}&appid=${API_KEY}&units=metric&lang=zh_tw`;
    
    console.log('🌐 Fetching from OpenWeatherMap API...');
    totalApiCalls++;
    
    // Add timeout to prevent hanging requests
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000); // 8 second timeout
    
    const response = await fetch(weatherUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'FlightInstructorWeatherApp/1.0'
      }
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      if (response.status === 429) {
        console.error('🚫 OpenWeather API rate limit exceeded');
        throw new Error('OpenWeather API rate limit exceeded');
      } else if (response.status === 401) {
        console.error('🔑 OpenWeather API authentication failed');
        throw new Error('Weather service authentication failed');
      } else {
        console.error(`💥 OpenWeather API error: ${response.status}`);
        throw new Error(`Weather API request failed: ${response.status}`);
      }
    }
    
    const weatherData = await response.json();
    const processingTime = Date.now() - startTime;
    
    const result = {
      location: location.name,
      temperature: Math.round(weatherData.main.temp),
      description: weatherData.weather[0].description,
      icon: getWeatherIcon(weatherData.weather[0].main),
      humidity: weatherData.main.humidity,
      windSpeed: Math.round((weatherData.wind?.speed || 0) * 10) / 10,
      pressure: weatherData.main.pressure,
      timestamp: Date.now(),
      source: 'openweather',
      processingTime,
      stats: {
        totalApiCalls,
        cacheHits,
        cacheHitRatio: totalApiCalls > 0 ? Math.round((cacheHits / totalApiCalls) * 100) : 0
      }
    };
    
    // Cache the result
    apiCache.set(cacheKey, { 
      data: result, 
      timestamp: Date.now(),
      sessionId 
    });
    
    console.log(`✅ Fresh weather data cached for ${base} (${processingTime}ms)`);
    return NextResponse.json(result);
    
  } catch (error) {
    const processingTime = Date.now() - startTime;
    console.error('💥 Weather API error:', error);
    
    const base = new URL(request.url).searchParams.get('base')?.toUpperCase() || 'TSA';
    const location = BASE_LOCATIONS[base as keyof typeof BASE_LOCATIONS] || BASE_LOCATIONS.TSA;
    
    // Try to return cached data even if expired
    const cacheKey = `weather_${base}`;
    const cached = apiCache.get(cacheKey);
    
    if (cached) {
      const cacheAge = Date.now() - cached.timestamp;
      console.log(`📦 Returning stale cached data (age: ${Math.round(cacheAge / 1000)}s) due to API error`);
      
      return NextResponse.json({
        ...cached.data,
        error: 'Unable to fetch live weather data (using cached)',
        fromCache: true,
        cacheAge,
        isStale: true,
        processingTime
      });
    }
    
    // Final fallback with realistic data
    const fallbackData = generateMockWeatherData(location);
    fallbackData.error = error instanceof Error ? error.message : 'Unable to fetch live weather data';
    
    // Cache fallback data for short time to prevent rapid retries
    apiCache.set(cacheKey, { 
      data: fallbackData, 
      timestamp: Date.now(),
      sessionId: 'fallback'
    });
    
    console.log(`🛡️ Returning fallback data for ${base}`);
    return NextResponse.json(fallbackData);
  }
}

// Clean up old cache entries and rate limits periodically
setInterval(() => {
  const now = Date.now();
  let cacheEntriesRemoved = 0;
  let rateLimitsRemoved = 0;
  
  // Clean cache (keep for 2x cache duration)
  for (const [key, value] of apiCache.entries()) {
    if (now - value.timestamp > CACHE_DURATION * 2) {
      apiCache.delete(key);
      cacheEntriesRemoved++;
    }
  }
  
  // Clean rate limits
  for (const [ip, rateLimit] of rateLimitMap.entries()) {
    if (now > rateLimit.resetTime) {
      rateLimitMap.delete(ip);
      rateLimitsRemoved++;
    }
  }
  
  if (cacheEntriesRemoved > 0 || rateLimitsRemoved > 0) {
    console.log(`🧹 Cleanup: Removed ${cacheEntriesRemoved} cache entries, ${rateLimitsRemoved} rate limits`);
  }
}, 5 * 60 * 1000); // Clean every 5 minutes

// Log cache statistics every 30 minutes
setInterval(() => {
  console.log(`📊 Weather API Stats - Total calls: ${totalApiCalls}, Cache hits: ${cacheHits}, Hit ratio: ${totalApiCalls > 0 ? Math.round((cacheHits / totalApiCalls) * 100) : 0}%`);
}, 30 * 60 * 1000);