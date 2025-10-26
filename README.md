# Novablick

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

### Run the Python code sandbox

```sh
uvx mcp-run-python --deps "numpy,pandas,matplotlib"  streamable-http
```

### Run the development server

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.
