// Service Worker إضافي (يتحمّل جوه SW الأساسي بتاع vite-plugin-pwa عبر
// importScripts) — مسؤوليته الوحيدة: استقبال Push حقيقي من المتصفح حتى
// لو التطبيق مقفول تمامًا، وعرضه كإشعار نظام، وفتح شاشة المحادثة
// المناسبة عند الضغط عليه.

self.addEventListener("push", (event) => {
  let payload = { title: "رسالة جديدة", body: "", url: "/chat", type: undefined };
  try {
    if (event.data) payload = { ...payload, ...event.data.json() };
  } catch {
    // لو مقدرناش نفك الـ JSON، نسيب القيم الافتراضية
  }

  const isCall = payload.type === "call";

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      data: { url: payload.url },
      dir: "rtl",
      // مكالمة واردة: نخليها "مُلحّة" (لا تختفي لوحدها) وبتاعة تاج
      // مخصص عشان لو وصلت أكتر من إشعار مكالمة يستبدلوا بعض بدل ما
      // يتكوموا فوق بعض، مع اهتزاز أقوى شبه نغمة الرنين الفعلية.
      tag: isCall ? "incoming-call" : undefined,
      renotify: isCall,
      requireInteraction: isCall,
      vibrate: isCall ? [400, 200, 400, 200, 400] : undefined,
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || "/chat";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientsArr) => {
      for (const client of clientsArr) {
        if (client.url.includes(targetUrl) && "focus" in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});
