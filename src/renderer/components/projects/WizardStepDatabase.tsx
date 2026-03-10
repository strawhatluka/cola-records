/**
 * WizardStepDatabase
 *
 * Step 4 of the New Project wizard.
 * Configures database engine, ORM/driver, Docker Compose, .env vars, and additional engines.
 */

import * as React from 'react';
import { Label } from '../ui/Label';
import { Checkbox } from '../ui/Checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/Select';
import { cn } from '../../lib/utils';
import type { WizardConfig, ORMOption } from '../../../main/ipc/channels';

interface WizardStepProps {
  config: WizardConfig;
  onChange: (updates: Partial<WizardConfig>) => void;
}

interface WizardStepDatabaseProps extends WizardStepProps {
  ormOptions: ORMOption[];
}

interface EngineCard {
  id: WizardConfig['database']['engine'];
  label: string;
  icon: string;
}

const DATABASE_ENGINES: EngineCard[] = [
  { id: 'none', label: 'None', icon: '--' },
  { id: 'postgresql', label: 'PostgreSQL', icon: 'PG' },
  { id: 'mysql', label: 'MySQL', icon: 'MY' },
  { id: 'mongodb', label: 'MongoDB', icon: 'MG' },
  { id: 'sqlite', label: 'SQLite', icon: 'SL' },
  { id: 'redis', label: 'Redis', icon: 'RD' },
];

/** Additional engines that can be added alongside the primary DB */
const ADDITIONAL_ENGINES = [
  { id: 'redis', label: 'Redis' },
  { id: 'postgresql', label: 'PostgreSQL' },
  { id: 'mysql', label: 'MySQL' },
  { id: 'mongodb', label: 'MongoDB' },
];

export function WizardStepDatabase({ config, onChange, ormOptions }: WizardStepDatabaseProps) {
  const hasEngine = config.database.engine !== 'none';

  const handleDatabaseChange = React.useCallback(
    (key: keyof WizardConfig['database'], value: unknown) => {
      onChange({
        database: { ...config.database, [key]: value },
      });
    },
    [config.database, onChange]
  );

  const handleEngineSelect = React.useCallback(
    (engine: WizardConfig['database']['engine']) => {
      const isNone = engine === 'none';
      onChange({
        database: {
          ...config.database,
          engine,
          orm: undefined,
          includeDocker: !isNone,
          includeEnvVars: !isNone,
          additionalEngines: isNone
            ? []
            : config.database.additionalEngines.filter((e) => e !== engine),
        },
      });
    },
    [config.database, onChange]
  );

  const handleAdditionalEngineToggle = React.useCallback(
    (engineId: string) => {
      const current = config.database.additionalEngines;
      const updated = current.includes(engineId)
        ? current.filter((e) => e !== engineId)
        : [...current, engineId];
      handleDatabaseChange('additionalEngines', updated);
    },
    [config.database.additionalEngines, handleDatabaseChange]
  );

  // Filter out the primary engine from additional engine options
  const availableAdditionalEngines = ADDITIONAL_ENGINES.filter(
    (e) => e.id !== config.database.engine
  );

  return (
    <div className="space-y-4">
      {/* Database Engine Grid */}
      <div className="space-y-1.5">
        <Label className="text-[11px] text-muted-foreground">Database Engine</Label>
        <div className="grid grid-cols-3 gap-2">
          {DATABASE_ENGINES.map((db) => (
            <button
              key={db.id}
              type="button"
              onClick={() => handleEngineSelect(db.id)}
              className={cn(
                'flex flex-col items-center gap-1 rounded-md border p-2.5 transition-colors',
                config.database.engine === db.id
                  ? 'border-primary bg-primary/10 text-foreground'
                  : 'border-input bg-background text-muted-foreground hover:border-primary/50'
              )}
            >
              <span className="text-[11px] font-bold tracking-wider">{db.icon}</span>
              <span className="text-[10px]">{db.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ORM/Driver (only when engine is selected) */}
      {hasEngine && ormOptions.length > 0 && (
        <div className="space-y-1.5">
          <Label className="text-[11px] text-muted-foreground">ORM / Driver</Label>
          <Select
            value={config.database.orm ?? ''}
            onValueChange={(value) => handleDatabaseChange('orm', value || undefined)}
          >
            <SelectTrigger className="h-8 text-[11px]">
              <SelectValue placeholder="Select ORM or driver..." />
            </SelectTrigger>
            <SelectContent>
              {ormOptions.map((orm) => (
                <SelectItem key={orm.id} value={orm.id} className="text-[11px]">
                  <span className="flex items-center gap-1.5">
                    {orm.name}
                    {orm.recommended && (
                      <span className="text-[9px] text-primary font-medium px-1 py-0.5 bg-primary/10 rounded">
                        recommended
                      </span>
                    )}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Docker & Env Options (only when engine is selected) */}
      {hasEngine && (
        <div className="space-y-2">
          <label className="flex items-center gap-2 cursor-pointer">
            <Checkbox
              checked={config.database.includeDocker}
              onCheckedChange={(checked) => handleDatabaseChange('includeDocker', checked === true)}
              className="h-3.5 w-3.5"
            />
            <span className="text-[11px] text-foreground">Include Docker Compose</span>
            <span className="text-[10px] text-muted-foreground">
              docker-compose.yml with database service
            </span>
          </label>

          <label className="flex items-center gap-2 cursor-pointer">
            <Checkbox
              checked={config.database.includeEnvVars}
              onCheckedChange={(checked) =>
                handleDatabaseChange('includeEnvVars', checked === true)
              }
              className="h-3.5 w-3.5"
            />
            <span className="text-[11px] text-foreground">Include .env variables</span>
            <span className="text-[10px] text-muted-foreground">
              Database connection string and credentials
            </span>
          </label>
        </div>
      )}

      {/* Additional Engines */}
      {hasEngine && availableAdditionalEngines.length > 0 && (
        <div className="space-y-1.5">
          <Label className="text-[11px] text-muted-foreground">Additional Engines</Label>
          <p className="text-[10px] text-muted-foreground">
            Add supplementary services alongside {config.database.engine}
          </p>
          <div className="flex flex-wrap gap-2 mt-1">
            {availableAdditionalEngines.map((engine) => {
              const isSelected = config.database.additionalEngines.includes(engine.id);
              return (
                <button
                  key={engine.id}
                  type="button"
                  onClick={() => handleAdditionalEngineToggle(engine.id)}
                  className={cn(
                    'rounded-full border px-2.5 py-1 text-[10px] transition-colors',
                    isSelected
                      ? 'border-primary bg-primary/10 text-foreground'
                      : 'border-input bg-background text-muted-foreground hover:border-primary/50'
                  )}
                >
                  {engine.label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* No database selected info */}
      {!hasEngine && (
        <p className="text-[10px] text-muted-foreground text-center py-4">
          No database selected. You can always add one later.
        </p>
      )}
    </div>
  );
}
