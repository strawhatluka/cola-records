import { useDiscordStore } from '../../stores/useDiscordStore';

export function DiscordConnect() {
  const { connect, loading, error } = useDiscordStore();

  return (
    <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
      <svg viewBox="0 0 24 24" className="h-12 w-12 fill-[#5865F2] mb-4">
        <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
      </svg>
      <h3 className="text-sm font-medium mb-1">Connect to Discord</h3>
      <p className="text-xs text-muted-foreground mb-4 max-w-[240px]">
        Add your Discord token in Settings &gt; API to get started.
      </p>
      <button
        type="button"
        onClick={connect}
        disabled={loading}
        className="px-4 py-2 rounded-md bg-[#5865F2] text-white text-sm font-medium hover:bg-[#4752C4] transition-colors disabled:opacity-50"
      >
        {loading ? 'Connecting...' : 'Connect'}
      </button>
      {error && (
        <p className="text-xs text-destructive mt-2 max-w-[240px]">{error}</p>
      )}
    </div>
  );
}
