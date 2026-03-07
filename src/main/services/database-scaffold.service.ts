/**
 * Database Scaffold Service
 *
 * Generates ORM configs, Docker Compose, and env vars for new projects
 */
import * as fs from 'fs';
import * as path from 'path';
import { createLogger } from '../utils/logger';
import type { Ecosystem, ORMOption, ScaffoldResult } from '../ipc/channels/types';

const log = createLogger('database-scaffold');

interface DatabaseScaffoldConfig {
  projectPath: string;
  projectName: string;
  ecosystem: Ecosystem;
  engine: 'postgresql' | 'mysql' | 'mongodb' | 'sqlite' | 'redis' | 'none';
  orm?: string;
  includeDocker: boolean;
  includeEnvVars: boolean;
  additionalEngines: string[];
}

const ORM_MAP: Record<string, Record<string, ORMOption[]>> = {
  node: {
    postgresql: [
      { id: 'prisma', name: 'Prisma', recommended: true },
      { id: 'drizzle', name: 'Drizzle', recommended: false },
      { id: 'typeorm', name: 'TypeORM', recommended: false },
      { id: 'knex', name: 'Knex', recommended: false },
    ],
    mysql: [
      { id: 'prisma', name: 'Prisma', recommended: true },
      { id: 'drizzle', name: 'Drizzle', recommended: false },
      { id: 'typeorm', name: 'TypeORM', recommended: false },
      { id: 'knex', name: 'Knex', recommended: false },
    ],
    mongodb: [
      { id: 'mongoose', name: 'Mongoose', recommended: true },
      { id: 'prisma', name: 'Prisma', recommended: false },
    ],
    sqlite: [
      { id: 'prisma', name: 'Prisma', recommended: true },
      { id: 'drizzle', name: 'Drizzle', recommended: false },
      { id: 'better-sqlite3', name: 'better-sqlite3', recommended: false },
      { id: 'knex', name: 'Knex', recommended: false },
    ],
  },
  python: {
    postgresql: [
      { id: 'sqlalchemy', name: 'SQLAlchemy', recommended: true },
      { id: 'django-orm', name: 'Django ORM', recommended: false },
      { id: 'tortoise', name: 'Tortoise ORM', recommended: false },
    ],
    mysql: [
      { id: 'sqlalchemy', name: 'SQLAlchemy', recommended: true },
      { id: 'django-orm', name: 'Django ORM', recommended: false },
    ],
    mongodb: [
      { id: 'motor', name: 'Motor', recommended: true },
      { id: 'mongoengine', name: 'MongoEngine', recommended: false },
    ],
    sqlite: [
      { id: 'sqlalchemy', name: 'SQLAlchemy', recommended: true },
      { id: 'django-orm', name: 'Django ORM', recommended: false },
    ],
  },
  rust: {
    postgresql: [
      { id: 'diesel', name: 'Diesel', recommended: true },
      { id: 'sqlx', name: 'SQLx', recommended: false },
      { id: 'sea-orm', name: 'SeaORM', recommended: false },
    ],
    mysql: [
      { id: 'diesel', name: 'Diesel', recommended: true },
      { id: 'sqlx', name: 'SQLx', recommended: false },
    ],
    mongodb: [{ id: 'mongodb', name: 'mongodb crate', recommended: true }],
    sqlite: [
      { id: 'diesel', name: 'Diesel', recommended: true },
      { id: 'sqlx', name: 'SQLx', recommended: false },
      { id: 'rusqlite', name: 'rusqlite', recommended: false },
    ],
  },
  go: {
    postgresql: [
      { id: 'gorm', name: 'GORM', recommended: true },
      { id: 'ent', name: 'Ent', recommended: false },
    ],
    mysql: [
      { id: 'gorm', name: 'GORM', recommended: true },
      { id: 'ent', name: 'Ent', recommended: false },
    ],
    mongodb: [{ id: 'mongo-driver', name: 'mongo-driver', recommended: true }],
    sqlite: [
      { id: 'gorm', name: 'GORM', recommended: true },
      { id: 'go-sqlite3', name: 'go-sqlite3', recommended: false },
    ],
  },
  ruby: {
    postgresql: [
      { id: 'activerecord', name: 'ActiveRecord', recommended: true },
      { id: 'sequel', name: 'Sequel', recommended: false },
    ],
    mysql: [
      { id: 'activerecord', name: 'ActiveRecord', recommended: true },
      { id: 'sequel', name: 'Sequel', recommended: false },
    ],
    mongodb: [{ id: 'mongoid', name: 'Mongoid', recommended: true }],
    sqlite: [{ id: 'activerecord', name: 'ActiveRecord', recommended: true }],
  },
  php: {
    postgresql: [
      { id: 'eloquent', name: 'Eloquent', recommended: true },
      { id: 'doctrine', name: 'Doctrine', recommended: false },
    ],
    mysql: [
      { id: 'eloquent', name: 'Eloquent', recommended: true },
      { id: 'doctrine', name: 'Doctrine', recommended: false },
    ],
    mongodb: [{ id: 'laravel-mongodb', name: 'Laravel MongoDB', recommended: true }],
    sqlite: [{ id: 'eloquent', name: 'Eloquent', recommended: true }],
  },
  java: {
    postgresql: [
      { id: 'spring-data-jpa', name: 'Spring Data JPA', recommended: true },
      { id: 'hibernate', name: 'Hibernate', recommended: false },
    ],
    mysql: [
      { id: 'spring-data-jpa', name: 'Spring Data JPA', recommended: true },
      { id: 'hibernate', name: 'Hibernate', recommended: false },
    ],
    mongodb: [{ id: 'spring-data-mongodb', name: 'Spring Data MongoDB', recommended: true }],
    sqlite: [{ id: 'spring-data-jpa', name: 'Spring Data JPA', recommended: true }],
  },
};

const DOCKER_COMPOSE_TEMPLATES: Record<string, string> = {
  postgresql: `  db:
    image: postgres:16-alpine
    ports:
      - "5432:5432"
    environment:
      POSTGRES_USER: dev
      POSTGRES_PASSWORD: dev
      POSTGRES_DB: \${PROJECT_NAME}
    volumes:
      - db_data:/var/lib/postgresql/data`,
  mysql: `  db:
    image: mysql:8
    ports:
      - "3306:3306"
    environment:
      MYSQL_ROOT_PASSWORD: dev
      MYSQL_DATABASE: \${PROJECT_NAME}
      MYSQL_USER: dev
      MYSQL_PASSWORD: dev
    volumes:
      - db_data:/var/lib/mysql`,
  mongodb: `  db:
    image: mongo:7
    ports:
      - "27017:27017"
    volumes:
      - db_data:/data/db`,
  redis: `  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data`,
};

const ENV_TEMPLATES: Record<string, string> = {
  postgresql: 'DATABASE_URL=postgres://dev:dev@localhost:5432/{projectName}',
  mysql: 'DATABASE_URL=mysql://dev:dev@localhost:3306/{projectName}',
  mongodb: 'MONGODB_URI=mongodb://localhost:27017/{projectName}',
  sqlite: 'DATABASE_URL=file:./dev.db',
  redis: 'REDIS_URL=redis://localhost:6379',
};

export function getORMOptions(ecosystem: Ecosystem, engine: string): ORMOption[] {
  return ORM_MAP[ecosystem]?.[engine] || [];
}

export function getDependencies(ecosystem: Ecosystem, engine: string, orm: string): string[] {
  const deps: Record<string, Record<string, Record<string, string[]>>> = {
    node: {
      postgresql: {
        prisma: ['prisma', '@prisma/client'],
        drizzle: ['drizzle-orm', 'drizzle-kit', 'pg'],
        typeorm: ['typeorm', 'pg', 'reflect-metadata'],
        knex: ['knex', 'pg'],
      },
      mysql: {
        prisma: ['prisma', '@prisma/client'],
        drizzle: ['drizzle-orm', 'drizzle-kit', 'mysql2'],
        typeorm: ['typeorm', 'mysql2', 'reflect-metadata'],
        knex: ['knex', 'mysql2'],
      },
      mongodb: {
        mongoose: ['mongoose'],
        prisma: ['prisma', '@prisma/client'],
      },
      sqlite: {
        prisma: ['prisma', '@prisma/client'],
        drizzle: ['drizzle-orm', 'drizzle-kit', 'better-sqlite3'],
        'better-sqlite3': ['better-sqlite3', '@types/better-sqlite3'],
        knex: ['knex', 'better-sqlite3'],
      },
    },
  };

  return deps[ecosystem]?.[engine]?.[orm] || [];
}

function generateDockerCompose(config: DatabaseScaffoldConfig): string {
  const services: string[] = [];
  const volumes: string[] = [];

  const primary = DOCKER_COMPOSE_TEMPLATES[config.engine];
  if (primary) {
    services.push(primary.replace(/\$\{PROJECT_NAME\}/g, config.projectName));
    volumes.push(config.engine === 'redis' ? 'redis_data:' : 'db_data:');
  }

  for (const extra of config.additionalEngines) {
    const tmpl = DOCKER_COMPOSE_TEMPLATES[extra];
    if (tmpl) {
      services.push(tmpl.replace(/\$\{PROJECT_NAME\}/g, config.projectName));
      if (extra === 'redis' && !volumes.includes('redis_data:')) {
        volumes.push('redis_data:');
      } else if (extra !== 'redis' && !volumes.includes('db_data:')) {
        volumes.push('db_data:');
      }
    }
  }

  return `version: "3.8"\n\nservices:\n${services.join('\n\n')}\n\nvolumes:\n${volumes.map((v) => `  ${v}`).join('\n')}\n`;
}

function generateEnvVars(config: DatabaseScaffoldConfig): string {
  const lines: string[] = [];

  const primary = ENV_TEMPLATES[config.engine];
  if (primary) {
    lines.push(primary.replace(/{projectName}/g, config.projectName));
  }

  for (const extra of config.additionalEngines) {
    const tmpl = ENV_TEMPLATES[extra];
    if (tmpl) {
      lines.push(tmpl.replace(/{projectName}/g, config.projectName));
    }
  }

  return lines.join('\n');
}

function generatePrismaSchema(engine: string, _projectName: string): string {
  const providerMap: Record<string, string> = {
    postgresql: 'postgresql',
    mysql: 'mysql',
    mongodb: 'mongodb',
    sqlite: 'sqlite',
  };
  const provider = providerMap[engine] || 'postgresql';

  return `// Prisma Schema \u2014 generated by Cola Records

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "${provider}"
  url      = env("DATABASE_URL")
}

model User {
  id        Int      @id @default(autoincrement())
  email     String   @unique
  name      String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
`;
}

export async function scaffoldDatabase(config: DatabaseScaffoldConfig): Promise<ScaffoldResult> {
  const filesCreated: string[] = [];
  const warnings: string[] = [];

  if (config.engine === 'none') {
    return { success: true, message: 'No database selected', filesCreated, warnings };
  }

  try {
    if (config.includeDocker) {
      const composePath = path.join(config.projectPath, 'docker-compose.yml');
      const content = generateDockerCompose(config);
      fs.writeFileSync(composePath, content, 'utf-8');
      filesCreated.push('docker-compose.yml');
      log.info(`Generated docker-compose.yml for ${config.engine}`);
    }

    if (config.includeEnvVars) {
      const envPath = path.join(config.projectPath, '.env');
      const envContent = generateEnvVars(config);
      if (fs.existsSync(envPath)) {
        fs.appendFileSync(envPath, '\n\n# Database\n' + envContent + '\n', 'utf-8');
      } else {
        fs.writeFileSync(envPath, '# Database\n' + envContent + '\n', 'utf-8');
        filesCreated.push('.env');
      }
      log.info('Generated database environment variables');
    }

    if (config.orm && config.ecosystem === 'node' && config.orm === 'prisma') {
      const prismaDir = path.join(config.projectPath, 'prisma');
      if (!fs.existsSync(prismaDir)) {
        fs.mkdirSync(prismaDir, { recursive: true });
      }
      fs.writeFileSync(
        path.join(prismaDir, 'schema.prisma'),
        generatePrismaSchema(config.engine, config.projectName),
        'utf-8'
      );
      filesCreated.push('prisma/schema.prisma');
      log.info('Generated Prisma schema');
    }

    return {
      success: true,
      message: `Database scaffolding complete for ${config.engine}${config.orm ? ` with ${config.orm}` : ''}`,
      filesCreated,
      warnings,
    };
  } catch (error) {
    log.error('Database scaffolding failed:', error);
    return {
      success: false,
      message: `Database scaffolding failed: ${error}`,
      filesCreated,
      warnings,
    };
  }
}

export const databaseScaffoldService = {
  scaffoldDatabase,
  getORMOptions,
  getDependencies,
};
