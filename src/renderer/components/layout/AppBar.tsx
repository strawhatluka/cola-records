import * as React from 'react';
import { ThemeToggle } from '../ThemeToggle';

interface AppBarProps {
  title: string;
}

export function AppBar({ title }: AppBarProps) {
  return (
    <header className="flex h-16 items-center justify-between border-b bg-background px-6">
      <h2 className="text-xl font-semibold">{title}</h2>
      <div className="flex items-center gap-4">
        <ThemeToggle />
      </div>
    </header>
  );
}
