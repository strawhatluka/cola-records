import type { DiscordPoll } from '../../../main/ipc/channels';
import { BarChart3 } from 'lucide-react';

interface PollRendererProps {
  poll: DiscordPoll;
}

export function PollRenderer({ poll }: PollRendererProps) {
  const totalVotes = poll.results?.answerCounts.reduce((sum, ac) => sum + ac.count, 0) || 0;
  const isFinalized = poll.results?.isFinalized || false;

  return (
    <div className="mt-1.5 border rounded-lg p-2.5 max-w-[300px] bg-muted/20">
      {/* Question */}
      <div className="flex items-center gap-1.5 mb-2">
        <BarChart3 className="h-3.5 w-3.5 text-[#5865F2] shrink-0" />
        <span className="text-xs font-semibold">{poll.question.text}</span>
      </div>

      {/* Answers */}
      <div className="space-y-1">
        {poll.answers.map((answer) => {
          const count = poll.results?.answerCounts.find((ac) => ac.id === answer.answerId);
          const votes = count?.count || 0;
          const percentage = totalVotes > 0 ? Math.round((votes / totalVotes) * 100) : 0;
          const meVoted = count?.meVoted || false;

          return (
            <div key={answer.answerId} className="relative">
              {/* Background bar */}
              <div
                className="absolute inset-0 rounded bg-[#5865F2]/15"
                style={{ width: `${percentage}%` }}
              />
              <div className={`relative flex items-center justify-between px-2 py-1 rounded ${meVoted ? 'ring-1 ring-[#5865F2]/50' : ''}`}>
                <div className="flex items-center gap-1.5 min-w-0">
                  {answer.pollMedia.emoji && (
                    <span className="text-xs">
                      {answer.pollMedia.emoji.id
                        ? <img src={`https://cdn.discordapp.com/emojis/${answer.pollMedia.emoji.id}.png`} alt="" className="h-4 w-4 inline" />
                        : answer.pollMedia.emoji.name}
                    </span>
                  )}
                  <span className="text-[11px] truncate">{answer.pollMedia.text}</span>
                </div>
                <span className="text-[10px] text-muted-foreground ml-2 shrink-0">
                  {votes} {votes === 1 ? 'vote' : 'votes'}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between mt-2 pt-1.5 border-t border-border/30">
        <span className="text-[10px] text-muted-foreground">
          {totalVotes} {totalVotes === 1 ? 'vote' : 'votes'}
        </span>
        {isFinalized && (
          <span className="text-[10px] text-muted-foreground">Final results</span>
        )}
        {!isFinalized && poll.expiry && (
          <span className="text-[10px] text-muted-foreground">
            Ends {new Date(poll.expiry).toLocaleDateString()}
          </span>
        )}
        {poll.allowMultiselect && (
          <span className="text-[10px] text-muted-foreground">Multiple choice</span>
        )}
      </div>
    </div>
  );
}
