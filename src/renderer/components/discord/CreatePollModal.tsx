import { useState } from 'react';
import { X, Plus, Trash2 } from 'lucide-react';

interface CreatePollModalProps {
  onSubmit: (
    question: string,
    answers: string[],
    duration: number,
    allowMultiselect: boolean
  ) => void;
  onClose: () => void;
}

const DURATION_OPTIONS = [
  { label: '1 Hour', value: 1 },
  { label: '4 Hours', value: 4 },
  { label: '8 Hours', value: 8 },
  { label: '24 Hours', value: 24 },
  { label: '3 Days', value: 72 },
  { label: '1 Week', value: 168 },
];

export function CreatePollModal({ onSubmit, onClose }: CreatePollModalProps) {
  const [question, setQuestion] = useState('');
  const [answers, setAnswers] = useState(['', '']);
  const [duration, setDuration] = useState(24);
  const [allowMultiselect, setAllowMultiselect] = useState(false);

  const canSubmit = question.trim() && answers.filter((a) => a.trim()).length >= 2;

  const handleSubmit = () => {
    if (!canSubmit) return;
    const validAnswers = answers.filter((a) => a.trim());
    onSubmit(question.trim(), validAnswers, duration, allowMultiselect);
  };

  const addAnswer = () => {
    if (answers.length < 10) {
      setAnswers([...answers, '']);
    }
  };

  const removeAnswer = (index: number) => {
    if (answers.length > 2) {
      setAnswers(answers.filter((_, i) => i !== index));
    }
  };

  const updateAnswer = (index: number, value: string) => {
    setAnswers(answers.map((a, i) => (i === index ? value : a)));
  };

  return (
    <div className="absolute bottom-14 left-2 right-2 bg-background border rounded-lg shadow-lg z-20 flex flex-col max-h-[400px]">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b">
        <span className="text-xs font-semibold">Create Poll</span>
        <button
          type="button"
          onClick={onClose}
          className="p-0.5 text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-3 styled-scroll">
        {/* Question */}
        <div>
          <label className="text-[10px] font-semibold text-muted-foreground uppercase block mb-1">
            Question
          </label>
          <input
            type="text"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Ask a question..."
            className="w-full bg-muted rounded px-2 py-1.5 text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            maxLength={300}
            autoFocus
          />
        </div>

        {/* Answers */}
        <div>
          <label className="text-[10px] font-semibold text-muted-foreground uppercase block mb-1">
            Answers
          </label>
          <div className="space-y-1.5">
            {answers.map((answer, i) => (
              <div key={i} className="flex items-center gap-1.5">
                <input
                  type="text"
                  value={answer}
                  onChange={(e) => updateAnswer(i, e.target.value)}
                  placeholder={`Answer ${i + 1}`}
                  className="flex-1 bg-muted rounded px-2 py-1.5 text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                  maxLength={55}
                />
                {answers.length > 2 && (
                  <button
                    type="button"
                    onClick={() => removeAnswer(i)}
                    className="p-1 text-muted-foreground hover:text-destructive transition-colors"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                )}
              </div>
            ))}
          </div>
          {answers.length < 10 && (
            <button
              type="button"
              onClick={addAnswer}
              className="mt-1.5 flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
            >
              <Plus className="h-3 w-3" />
              Add Answer
            </button>
          )}
        </div>

        {/* Duration */}
        <div>
          <label className="text-[10px] font-semibold text-muted-foreground uppercase block mb-1">
            Duration
          </label>
          <select
            value={duration}
            onChange={(e) => setDuration(Number(e.target.value))}
            className="w-full bg-muted rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
          >
            {DURATION_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* Allow multiselect */}
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={allowMultiselect}
            onChange={(e) => setAllowMultiselect(e.target.checked)}
            className="rounded"
          />
          <span className="text-xs text-muted-foreground">Allow selecting multiple answers</span>
        </label>
      </div>

      {/* Footer */}
      <div className="flex justify-end gap-2 px-3 py-2 border-t">
        <button
          type="button"
          onClick={onClose}
          className="px-3 py-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!canSubmit}
          className="px-3 py-1 text-xs bg-[#5865F2] text-white rounded hover:bg-[#4752C4] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          Create Poll
        </button>
      </div>
    </div>
  );
}
