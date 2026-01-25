import React, { useState, useEffect } from 'react';
import { ipc } from './ipc/client';

const App: React.FC = () => {
  const [echoResult, setEchoResult] = useState<string>('Testing...');
  const [ipcStatus, setIpcStatus] = useState<'pending' | 'success' | 'error'>('pending');

  useEffect(() => {
    const testIpc = async () => {
      try {
        const result = await ipc.invoke('echo', 'Hello from Renderer!');
        setEchoResult(result);
        setIpcStatus('success');
      } catch (error) {
        setEchoResult(`Error: ${error}`);
        setIpcStatus('error');
      }
    };

    testIpc();
  }, []);

  return (
    <div style={{ padding: '20px', fontFamily: 'system-ui' }}>
      <h1>Cola Records - Electron Migration</h1>
      <p>✅ Electron + React + TypeScript foundation initialized</p>
      <p>✅ Phase 1.1: Electron Forge with Vite + TypeScript - Complete</p>
      <p>🚧 Phase 1.2: IPC Architecture - Testing...</p>

      <div style={{
        marginTop: '20px',
        padding: '15px',
        backgroundColor: ipcStatus === 'success' ? '#d4edda' : ipcStatus === 'error' ? '#f8d7da' : '#fff3cd',
        border: `1px solid ${ipcStatus === 'success' ? '#c3e6cb' : ipcStatus === 'error' ? '#f5c6cb' : '#ffeaa7'}`,
        borderRadius: '5px'
      }}>
        <strong>IPC Echo Test:</strong>
        <br />
        {ipcStatus === 'success' && '✅ '}
        {ipcStatus === 'error' && '❌ '}
        {ipcStatus === 'pending' && '⏳ '}
        {echoResult}
      </div>

      <p style={{ marginTop: '20px', color: '#666', fontSize: '14px' }}>
        Next: Environment & Security, Database Layer, Zustand Stores, Core Services...
      </p>
    </div>
  );
};

export default App;
