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
        E->>T: Call tools (Python/Data)
        T-->>E: Return results
        E->>U: Stream progress
    end

    E->>A: All steps complete
    A->>A: Synthesize results
    A->>U: Final answer with insights
```

### Python Code Execution

The agent can execute Python code using Pyodide (Python in the browser):

- Support for data analysis libraries
- Matplotlib visualizations are automatically captured
- Results are streamed back in real-time
- Secure execution in Wasm sandbox

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
