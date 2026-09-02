@@
   // Vite middleware for dev
-  if (process.env.NODE_ENV !== 'production') {
-    const { createServer: createViteServer } = await import('vite');
-    const vite = await createViteServer({
-      server: { middlewareMode: true },
-      appType: 'spa',
-    });
-    app.use(vite.middlewares);
-  } else {
-    const distPath = path.join(process.cwd(), 'dist');
-    app.use(express.static(distPath));
-    app.get('*', (req, res) => {
-      res.sendFile(path.join(distPath, 'index.html'));
-    });
-  }
+  // Vite middleware for dev; in production this block will be removed by esbuild
+  if (process.env.NODE_ENV !== 'production') {
+    try {
+      const { createServer: createViteServer } = await import('vite');
+      const vite = await createViteServer({
+        server: { middlewareMode: true },
+        appType: 'spa',
+      });
+      app.use(vite.middlewares);
+    } catch (err) {
+      console.warn('Vite dev server could not be started (continuing without it):', err);
+    }
+  } else {
+    const resourceDist = process.env.MIZAN_RESOURCE_DIR ? path.join(process.env.MIZAN_RESOURCE_DIR, 'dist') : path.join(process.cwd(), 'dist');
+    const distPath = resourceDist;
+    app.use(express.static(distPath));
+    app.get('*', (req, res) => {
+      res.sendFile(path.join(distPath, 'index.html'));
+    });
+  }
@@
