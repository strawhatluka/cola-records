import * as React from 'react';
import { Search } from 'lucide-react';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/Select';
import { Checkbox } from '../ui/Checkbox';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/Card';

const languages = [
  'All',
  'JavaScript',
  'TypeScript',
  'Python',
  'Java',
  'Go',
  'Rust',
  'C++',
  'C#',
  'Ruby',
  'PHP',
  'Swift',
  'Kotlin',
  'Dart',
];

const availableLabels = [
  'good first issue',
  'beginner-friendly',
  'help wanted',
  'documentation',
];

interface SearchPanelProps {
  onSearch: (query: string, labels: string[]) => void;
  loading: boolean;
}

export function SearchPanel({ onSearch, loading }: SearchPanelProps) {
  const [searchText, setSearchText] = React.useState('');
  const [language, setLanguage] = React.useState('All');
  const [minStars, setMinStars] = React.useState('');
  const [selectedLabels, setSelectedLabels] = React.useState<string[]>(['good first issue']);

  const handleSearch = () => {
    let query = searchText;
    if (language !== 'All') {
      query += ` language:${language}`;
    }
    if (minStars) {
      query += ` stars:>=${minStars}`;
    }
    onSearch(query, selectedLabels);
  };

  const handleLabelToggle = (label: string) => {
    setSelectedLabels((prev) =>
      prev.includes(label) ? prev.filter((l) => l !== label) : [...prev, label]
    );
  };

  const handleClear = () => {
    setSearchText('');
    setLanguage('All');
    setMinStars('');
    setSelectedLabels(['good first issue']);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Search Issues</CardTitle>
        <CardDescription>Find open source issues to contribute to</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Input
            data-search-input
            placeholder="Search issues..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            className="flex-1"
          />
          <Button onClick={handleSearch} disabled={loading}>
            <Search className="h-4 w-4 mr-2" />
            Search
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium">Language</label>
            <Select value={language} onValueChange={setLanguage}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {languages.map((lang) => (
                  <SelectItem key={lang} value={lang}>
                    {lang}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-sm font-medium">Minimum Stars</label>
            <Input
              type="number"
              placeholder="e.g., 100"
              value={minStars}
              onChange={(e) => setMinStars(e.target.value)}
            />
          </div>
        </div>

        <div>
          <label className="text-sm font-medium mb-2 block">Labels</label>
          <div className="space-y-2">
            {availableLabels.map((label) => (
              <div key={label} className="flex items-center space-x-2">
                <Checkbox
                  id={label}
                  checked={selectedLabels.includes(label)}
                  onCheckedChange={() => handleLabelToggle(label)}
                />
                <label htmlFor={label} className="text-sm cursor-pointer">
                  {label}
                </label>
              </div>
            ))}
          </div>
        </div>

        <Button variant="outline" onClick={handleClear} className="w-full">
          Clear Filters
        </Button>
      </CardContent>
    </Card>
  );
}
