import '@testing-library/jest-dom';

// Mock Electron modules
global.window = global.window || {};
(global.window as any).electronAPI = {
  invoke: async (channel: string, ...args: any[]) => {
    console.log('Mock IPC invoke:', channel, args);
    return null;
  },
  send: (channel: string, ...args: any[]) => {
    console.log('Mock IPC send:', channel, args);
  },
  on: (channel: string, _callback: (...args: any[]) => void) => {
    console.log('Mock IPC on:', channel);
    return () => {};
  },
};

(global.window as any).process = {
  platform: 'win32',
  env: {
    NODE_ENV: 'test',
  },
};
