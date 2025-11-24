import { resolve } from 'path';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {

  const env = loadEnv(mode, process.cwd());

  return {
    root: 'src',
    publicDir: '../public',

    build: {
      outDir: '../dist',
      emptyOutDir: true,
      rollupOptions: {
        input: {
          'index': resolve(__dirname, 'src/index.html'),
          'login': resolve(__dirname, 'src/page/auth/login.html'),
          'signup': resolve(__dirname, 'src/page/auth/signup.html'),
          'create-room': resolve(__dirname, 'src/page/room/create.html'),
          'join-room': resolve(__dirname, 'src/page/room/join.html'),
          'room': resolve(__dirname, 'src/page/chat/room.html'),
          '404': resolve(__dirname, 'src/page/error/404.html'),
        }
      }
    },
    server: {
      host: '0.0.0.0',
      port: 5173,
      proxy: {
        '/api': {
          target: env.VITE_API_URL,
          changeOrigin: true,
          secure: false,
        },
        '/ws': {
          target: env.VITE_WS_URL,
          ws: true,
          changeOrigin: true,
        }
      }
    }
  };
});
