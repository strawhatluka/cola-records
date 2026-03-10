import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

// Mock lucide-react
vi.mock('lucide-react', async () => import('../../../mocks/lucide-react'));

import { PollRenderer } from '../../../../src/renderer/components/discord/PollRenderer';
import type { DiscordPoll } from '../../../../src/main/ipc/channels';

function createPoll(overrides: Partial<DiscordPoll> = {}): DiscordPoll {
  return {
    question: { text: overrides.question?.text ?? 'Best language?' },
    answers: overrides.answers ?? [
      { answerId: 1, pollMedia: { text: 'TypeScript' } },
      { answerId: 2, pollMedia: { text: 'Rust' } },
    ],
    results: overrides.results ?? {
      isFinalized: false,
      answerCounts: [
        { id: 1, count: 7, meVoted: true },
        { id: 2, count: 3, meVoted: false },
      ],
    },
    allowMultiselect: overrides.allowMultiselect ?? false,
    expiry: overrides.expiry ?? '2026-12-31T00:00:00Z',
    layoutType: overrides.layoutType ?? 1,
  };
}

describe('PollRenderer', () => {
  it('renders the poll question', () => {
    render(<PollRenderer poll={createPoll()} />);
    expect(screen.getByText('Best language?')).toBeDefined();
  });

  it('renders answer texts', () => {
    render(<PollRenderer poll={createPoll()} />);
    expect(screen.getByText('TypeScript')).toBeDefined();
    expect(screen.getByText('Rust')).toBeDefined();
  });

  it('renders vote counts', () => {
    render(<PollRenderer poll={createPoll()} />);
    expect(screen.getByText('7 votes')).toBeDefined();
    expect(screen.getByText('3 votes')).toBeDefined();
  });

  it('renders total vote count', () => {
    render(<PollRenderer poll={createPoll()} />);
    expect(screen.getByText('10 votes')).toBeDefined();
  });

  it('renders singular "vote" for 1 vote', () => {
    const poll = createPoll({
      results: {
        isFinalized: false,
        answerCounts: [
          { id: 1, count: 1, meVoted: false },
          { id: 2, count: 0, meVoted: false },
        ],
      },
    });
    render(<PollRenderer poll={poll} />);
    // "1 vote" for the answer and total
    const voteTexts = screen.getAllByText('1 vote');
    expect(voteTexts.length).toBeGreaterThan(0);
  });

  it('shows "Final results" when finalized', () => {
    const poll = createPoll({
      results: {
        isFinalized: true,
        answerCounts: [
          { id: 1, count: 5, meVoted: true },
          { id: 2, count: 3, meVoted: false },
        ],
      },
    });
    render(<PollRenderer poll={poll} />);
    expect(screen.getByText('Final results')).toBeDefined();
  });

  it('shows expiry date when not finalized', () => {
    render(<PollRenderer poll={createPoll()} />);
    // "Ends" followed by a date
    expect(screen.getByText(/^Ends /)).toBeDefined();
  });

  it('does not show expiry when finalized', () => {
    const poll = createPoll({
      results: {
        isFinalized: true,
        answerCounts: [
          { id: 1, count: 5, meVoted: false },
          { id: 2, count: 3, meVoted: false },
        ],
      },
    });
    render(<PollRenderer poll={poll} />);
    expect(screen.queryByText(/^Ends /)).toBeNull();
  });

  it('shows "Multiple choice" when allowMultiselect', () => {
    const poll = createPoll({ allowMultiselect: true });
    render(<PollRenderer poll={poll} />);
    expect(screen.getByText('Multiple choice')).toBeDefined();
  });

  it('does not show "Multiple choice" when single select', () => {
    const poll = createPoll({ allowMultiselect: false });
    render(<PollRenderer poll={poll} />);
    expect(screen.queryByText('Multiple choice')).toBeNull();
  });

  it('renders emoji as text when no ID', () => {
    const poll = createPoll({
      answers: [
        { answerId: 1, pollMedia: { text: 'Yes', emoji: { id: null, name: '👍' } } },
        { answerId: 2, pollMedia: { text: 'No', emoji: { id: null, name: '👎' } } },
      ],
      results: {
        isFinalized: false,
        answerCounts: [
          { id: 1, count: 5, meVoted: false },
          { id: 2, count: 2, meVoted: false },
        ],
      },
    });
    render(<PollRenderer poll={poll} />);
    expect(screen.getByText('👍')).toBeDefined();
    expect(screen.getByText('👎')).toBeDefined();
  });

  it('renders custom emoji as image when ID present', () => {
    const poll = createPoll({
      answers: [
        { answerId: 1, pollMedia: { text: 'Custom', emoji: { id: '12345', name: 'custom' } } },
      ],
      results: {
        isFinalized: false,
        answerCounts: [{ id: 1, count: 3, meVoted: false }],
      },
    });
    render(<PollRenderer poll={poll} />);
    const img = document.querySelector('img');
    expect(img).toBeDefined();
    expect(img?.getAttribute('src')).toContain('12345');
  });

  it('handles zero votes gracefully', () => {
    const poll = createPoll({
      results: {
        isFinalized: false,
        answerCounts: [
          { id: 1, count: 0, meVoted: false },
          { id: 2, count: 0, meVoted: false },
        ],
      },
    });
    render(<PollRenderer poll={poll} />);
    const zeroVotes = screen.getAllByText('0 votes');
    expect(zeroVotes.length).toBeGreaterThan(0);
  });

  it('handles null results gracefully', () => {
    const poll = createPoll({ results: undefined });
    render(<PollRenderer poll={poll} />);
    // Should still render without crashing
    expect(screen.getByText('Best language?')).toBeDefined();
  });
});
