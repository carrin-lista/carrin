self.addEventListener('push', function(event) {
  if (event.data) {
    const data = event.data.json();
    
    const options = {
      body: data.body,
      icon: '/pwa-192x192.png', 
      badge: '/pwa-192x192.png', 
      vibrate: [100, 50, 100],
      data: {
        url: data.url || '/'
      }
    };

    event.waitUntil(
      self.registration.showNotification(data.title, options)
    );
  }
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then(windowClients => {
      // Se o app já estiver aberto, foca nele
      if (windowClients.length > 0) {
        windowClients[0].focus();
        if (event.notification.data.url) {
          windowClients[0].navigate(event.notification.data.url);
        }
      } else {
        // Se estiver fechado, abre uma nova janela
        clients.openWindow(event.notification.data.url || '/');
      }
    })
  );
});