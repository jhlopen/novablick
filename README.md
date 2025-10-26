# Novablick

An AI-powered data analytics chat application that lets you analyze CSV datasets through natural language conversations.

## Features

- **Natural Language Data Analysis** - Ask questions about your datasets in plain English and get intelligent responses
- **CSV Upload & Management** - Upload multiple CSV files and manage your datasets with ease
- **Multi-Dataset Support** - Query across multiple datasets in a single conversation
- **Interactive Filtering** - Apply categorical and date-range filters to refine your data queries
- **SQL Query Generation** - Automatically generates and executes SQL queries based on your questions
- **Python Code Execution** - Run Python data analysis code with support for numpy, pandas, and matplotlib
- **Dataset Viewer** - Display column types, null ratios, unique values, and statistical metadata
- **Real-time Streaming** - Get responses as they're generated with AI streaming support
- **Modern UI** - Beautiful, responsive interface built with Radix UI and Tailwind CSS

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
