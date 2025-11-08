# Novablick

An AI-powered data analytics chat application that lets you analyze CSV datasets through natural language conversations.

## Setup

### Configure environment variables

```sh
cp .env.example .env
```

### Run the database

```sh
podman pull postgres
podman run -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=postgres -p 5432:5432 postgres
```

### Synchronize the database schema

```sh
pnpm db:push
```

### Run the development server

```sh
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.
