importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: 'AIzaSyAmzmzjwa9CvHtKEApPbQ46d4tkE8JEkPc',
  authDomain: 'glowza-326ca.firebaseapp.com',
  projectId: 'glowza-326ca',
  storageBucket: 'glowza-326ca.firebasestorage.app',
  messagingSenderId: '457230198022',
  appId: '1:457230198022:web:995141a9191bfc841f2a87',
  measurementId: 'G-V9PP45VKZJ',
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const notification = payload.notification || {};
  self.registration.showNotification(notification.title || 'Glowza', {
    body: notification.body || '',
    icon: '/icons/Icon-192.png',
    image: notification.image,
  });
});
