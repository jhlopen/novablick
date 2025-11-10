# Novablick

An AI-powered data analytics chat application that lets you analyze CSV datasets through natural language conversations.

## Agentic Workflow

Novablick uses an agentic workflow that autonomously decides how to handle user queries. The workflow adapts based on query complexity:

### Workflow Overview

```mermaid
flowchart TD
    A[User Query] --> B{Planning Decision}
    B -->|Simple Query| C[Direct Response Path]
    B -->|Complex Query| D[Planning Path]

    D --> D1[Generate Multi-Step Plan]
    D1 --> D2[Visualize Plan]
    D2 --> D3[Execute Steps]
    D3 --> D4[Synthesize Results]

    C --> E[User Receives Answer]
    D4 --> E
```

### Decision Flow

The agent evaluates each query to determine the optimal approach:

```mermaid
flowchart LR
    A[User Query] --> B{Query Type?}
    B -->|Greeting| C[Simple]
    B -->|Clarification| C
    B -->|Basic Calculation| C
    B -->|Data Analysis| D[Complex]
    B -->|Multi-step Reasoning| D
    B -->|Visualization Request| D

    C --> E[Direct Response<br/>Fast & Efficient]
    D --> F[Planned Response<br/>Autonomous & Thorough]

    style C fill:#90ee90,color:#000000
    style D fill:#ffa07a,color:#000000
```

### Execution Sequence

Here's how a complex query flows through the system:

```mermaid
sequenceDiagram
    participant U as User
    participant A as Agent
    participant P as Planner
    participant E as Executor
    participant T as Tools

    U->>A: Submit complex query
    A->>A: Evaluate complexity
    A->>P: Request plan generation
    P->>P: Create multi-step plan
    P->>U: Display plan visualization

    loop For each step
        P->>E: Execute step
        E->>T: Call tools (runCode/queryDataset/displayChart)
        T-->>E: Return results
        E->>U: Stream progress
    end

    E->>A: All steps complete
    A->>A: Synthesize results
    A->>U: Final answer with insights
```

### Available Tools

The agent has access to five tools during execution:

#### 1. Python Code Execution (`runCode`)

Execute Python code using Pyodide (Python in the browser):

- Support for data analysis libraries
- Matplotlib visualizations are automatically captured
- Results are streamed back in real-time
- Secure execution in Wasm sandbox

#### 2. Dataset Querying (`queryDataset`)

Query CSV datasets using SQL with built-in security:

- Filter, aggregate, and sort data
- Perform statistical analysis (COUNT, AVG, SUM, etc.)
- Join multiple columns and create custom calculations
- Securely limited to read-only SELECT queries on authorized datasets
- Automatic row limit protection (max 1000 rows per query)

#### 3. Bar Chart Display (`displayBarChart`)

Create interactive bar charts for comparing categorical data:

- Support for multiple data series
- Responsive design with tooltips

#### 4. Line Chart Display (`displayLineChart`)

Visualize trends and time-series data with line charts:

- Multiple lines for comparison
- Ideal for tracking changes over time

#### 5. Pie Chart Display (`displayPieChart`)

Show proportional data with pie/donut charts:

- Interactive tooltips
- Perfect for composition analysis

## Setup

### Docker

1. Create .env and add your `OPENAI_API_KEY`

```sh
cp .env.example .env
```

2. Start services

```sh
pnpm install
pnpm docker:up
```

3. Synchronize the database schema

```sh
pnpm docker:db:push
```

Open [http://localhost:3000](http://localhost:3000).

Other commands:

```sh
pnpm docker:down      # Stop services
pnpm docker:logs      # View logs
pnpm docker:build     # Rebuild images
pnpm docker:db:push   # Run database migrations
```

### Local Development

The app runs on host, only the database in Docker.

1. Create .env and add your `OPENAI_API_KEY`

```sh
cp .env.example .env
```

2. Run the database

```sh
docker run -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=novablick -p 5432:5432 postgres
```

3. Synchronize the database schema

```sh
pnpm install
pnpm db:push
```

4. Run the development server

```sh
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).
