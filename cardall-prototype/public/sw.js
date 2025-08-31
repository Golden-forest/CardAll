// CardAll Service Worker - Advanced PWA Implementation
const CACHE_NAME = 'cardall-v1.0.0'
const STATIC_CACHE = 'cardall-static-v1.0.0'
const DYNAMIC_CACHE = 'cardall-dynamic-v1.0.0'
const IMAGE_CACHE = 'cardall-images-v1.0.0'

// Static assets to cache immediately
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/cardall-icon.svg',
  '/cardall-logo.svg'
]

// Dynamic routes to cache
const DYNAMIC_ROUTES = [
  '/api/',
  'https://elwnpejlwkgdacaugvvd.supabase.co/'
]

// Install event - cache static assets
self.addEventListener('install', (event) => {
  console.log('[SW] Installing Service Worker...')
  
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => {
        console.log('[SW] Caching static assets')
        return cache.addAll(STATIC_ASSETS)
      })
      .then(() => {
        console.log('[SW] Static assets cached successfully')
        return self.skipWaiting()
      })
      .catch((error) => {
        console.error('[SW] Failed to cache static assets:', error)
      })
  )
})

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating Service Worker...')
  
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== STATIC_CACHE && 
                cacheName !== DYNAMIC_CACHE && 
                cacheName !== IMAGE_CACHE) {
              console.log('[SW] Deleting old cache:', cacheName)
              return caches.delete(cacheName)
            }
          })
        )
      })
      .then(() => {
        console.log('[SW] Service Worker activated')
        return self.clients.claim()
      })
  )
})

// Fetch event - implement caching strategies
self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  // Handle different types of requests with appropriate strategies
  if (request.method === 'GET') {
    // Static assets - Cache First
    if (STATIC_ASSETS.some(asset => url.pathname.endsWith(asset))) {
      event.respondWith(cacheFirst(request, STATIC_CACHE))
    }
    // Images - Cache First with fallback
    else if (request.destination === 'image') {
      event.respondWith(cacheFirstWithFallback(request, IMAGE_CACHE))
    }
    // API requests - Network First with cache fallback
    else if (url.pathname.startsWith('/api/') || url.hostname.includes('supabase.co')) {
      event.respondWith(networkFirstWithCache(request, DYNAMIC_CACHE))
    }
    // HTML pages - Stale While Revalidate
    else if (request.headers.get('accept')?.includes('text/html')) {
      event.respondWith(staleWhileRevalidate(request, DYNAMIC_CACHE))
    }
    // Other resources - Network First
    else {
      event.respondWith(networkFirst(request))
    }
  }
})

// Background Sync for offline operations
self.addEventListener('sync', (event) => {
  console.log('[SW] Background sync triggered:', event.tag)
  
  if (event.tag === 'cardall-sync') {
    event.waitUntil(syncOfflineOperations())
  }
})

// Push notifications
self.addEventListener('push', (event) => {
  console.log('[SW] Push notification received')
  
  const options = {
    body: event.data ? event.data.text() : 'New update available',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/badge-72x72.png',
    vibrate: [100, 50, 100],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: 1
    },
    actions: [
      {
        action: 'explore',
        title: 'Open CardAll',
        icon: '/icons/action-explore.png'
      },
      {
        action: 'close',
        title: 'Close',
        icon: '/icons/action-close.png'
      }
    ]
  }
  
  event.waitUntil(
    self.registration.showNotification('CardAll', options)
  )
})

// Notification click handling
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification clicked:', event.action)
  
  event.notification.close()
  
  if (event.action === 'explore') {
    event.waitUntil(
      clients.openWindow('/')
    )
  }
})

// Caching Strategies Implementation

// Cache First - for static assets
async function cacheFirst(request, cacheName) {
  try {
    const cache = await caches.open(cacheName)
    const cachedResponse = await cache.match(request)
    
    if (cachedResponse) {
      return cachedResponse
    }
    
    const networkResponse = await fetch(request)
    if (networkResponse.ok) {
      cache.put(request, networkResponse.clone())
    }
    return networkResponse
  } catch (error) {
    console.error('[SW] Cache First failed:', error)
    return new Response('Offline', { status: 503 })
  }
}

// Cache First with Fallback - for images
async function cacheFirstWithFallback(request, cacheName) {
  try {
    const cache = await caches.open(cacheName)
    const cachedResponse = await cache.match(request)
    
    if (cachedResponse) {
      return cachedResponse
    }
    
    const networkResponse = await fetch(request)
    if (networkResponse.ok) {
      cache.put(request, networkResponse.clone())
      return networkResponse
    }
    
    // Return fallback image
    return cache.match('/icons/image-placeholder.png')
  } catch (error) {
    console.error('[SW] Cache First with Fallback failed:', error)
    return cache.match('/icons/image-placeholder.png')
  }
}

// Network First with Cache - for API requests
async function networkFirstWithCache(request, cacheName) {
  try {
    const networkResponse = await fetch(request)
    
    if (networkResponse.ok) {
      const cache = await caches.open(cacheName)
      cache.put(request, networkResponse.clone())
      return networkResponse
    }
    
    throw new Error('Network response not ok')
  } catch (error) {
    console.log('[SW] Network failed, trying cache:', error.message)
    const cache = await caches.open(cacheName)
    const cachedResponse = await cache.match(request)
    
    if (cachedResponse) {
      return cachedResponse
    }
    
    return new Response(JSON.stringify({ 
      error: 'Offline', 
      message: 'No cached data available' 
    }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

// Stale While Revalidate - for HTML pages
async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName)
  const cachedResponse = await cache.match(request)
  
  const fetchPromise = fetch(request).then((networkResponse) => {
    if (networkResponse.ok) {
      cache.put(request, networkResponse.clone())
    }
    return networkResponse
  }).catch(() => cachedResponse)
  
  return cachedResponse || fetchPromise
}

// Network First - for other resources
async function networkFirst(request) {
  try {
    return await fetch(request)
  } catch (error) {
    console.error('[SW] Network First failed:', error)
    return new Response('Offline', { status: 503 })
  }
}

// Background sync for offline operations
async function syncOfflineOperations() {
  try {
    console.log('[SW] Syncing offline operations...')
    
    // Get pending operations from IndexedDB
    const db = await openDB()
    const operations = await getAllPendingOperations(db)
    
    for (const operation of operations) {
      try {
        await syncOperation(operation)
        await markOperationAsSynced(db, operation.id)
        console.log('[SW] Operation synced:', operation.id)
      } catch (error) {
        console.error('[SW] Failed to sync operation:', operation.id, error)
      }
    }
    
    console.log('[SW] Background sync completed')
  } catch (error) {
    console.error('[SW] Background sync failed:', error)
  }
}

// Helper functions for IndexedDB operations
function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('cardall-sync', 1)
    
    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve(request.result)
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result
      if (!db.objectStoreNames.contains('operations')) {
        db.createObjectStore('operations', { keyPath: 'id' })
      }
    }
  })
}

async function getAllPendingOperations(db) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['operations'], 'readonly')
    const store = transaction.objectStore('operations')
    const request = store.getAll()
    
    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve(request.result.filter(op => !op.synced))
  })
}

async function syncOperation(operation) {
  const response = await fetch('/api/sync', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(operation)
  })
  
  if (!response.ok) {
    throw new Error(`Sync failed: ${response.status}`)
  }
  
  return response.json()
}

async function markOperationAsSynced(db, operationId) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['operations'], 'readwrite')
    const store = transaction.objectStore('operations')
    const request = store.get(operationId)
    
    request.onsuccess = () => {
      const operation = request.result
      if (operation) {
        operation.synced = true
        operation.syncedAt = Date.now()
        
        const updateRequest = store.put(operation)
        updateRequest.onerror = () => reject(updateRequest.error)
        updateRequest.onsuccess = () => resolve()
      } else {
        resolve()
      }
    }
    
    request.onerror = () => reject(request.error)
  })
}