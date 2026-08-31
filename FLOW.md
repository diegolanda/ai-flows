# Development Flow

This diagram summarizes the current `@diego/development` workflow. The executable rules remain authoritative in [WORKFLOW.md](packages/workflows/development/WORKFLOW.md).

## Primary flow

```mermaid
flowchart TD
    A[Developer requests a change] --> B[Resolve branch-state and dev-hook tools]
    B --> C{Tools resolved?}
    C -- No --> C1[Report each failed source<br/>Request the ai-flows checkout path]
    C -- Yes --> D[Read branch state]

    D --> E{State exists?}
    E -- No --> F[Record the raw request]
    F --> G[Normalize intent, goals,<br/>non-goals, assumptions, and size]
    G --> H[Show the proposed intent]
    H --> I{Developer approves?}
    I -- No --> G
    I -- Yes --> J[Store and lock the intent]
    J --> K[Report the intent hash]

    E -- Yes --> L[Show the existing task]
    L --> M{Continue the existing task?}
    M -- No --> Z[Stop]
    M -- Yes --> N[Implement the change]
    K --> N

    N --> O[Run focused verification]
    O --> P{Requested action}
    P -- Keep local --> P1[Leave changes local]
    P -- Check only --> Q[Check freshness and run gates]
    Q --> Q1[Report readiness without pushing]

    P -- Push or PR --> R[Fetch origin]
    R --> S{Behind the base branch?}
    S -- Yes --> T[Rebase onto the base branch]
    T --> U{Conflict?}
    U -- Yes --> U1[Stop and report conflicting files]
    U -- No --> V[Check intent and artifact freshness]
    S -- No --> V

    V --> W{Description out of date?}
    W -- Yes --> X[Generate the description from<br/>the intent, commits, and full diff]
    X --> Y[Record the description]
    W -- No --> AA{Review out of date?}
    Y --> AA

    AA -- Yes --> AB[Review the full diff against the locked intent]
    AB --> AC[Recompute status from the findings]
    AC --> AD{Blocking finding?}
    AD -- Yes --> AD1[Stop and report the findings]
    AD -- No --> AE[Record the review for the current HEAD]
    AA -- No --> AF[Run deterministic gates]
    AE --> AF

    AF --> AG{Required gates pass?}
    AG -- No --> AG1[Stop and report the exact failure]
    AG -- Yes --> AH[Push the branch]

    AH --> AI{Delivery action}
    AI -- Push only --> AJ[Report the pushed branch]
    AI -- Pull request --> AK[Create or update the managed PR]
    AK --> AL[Apply the size label]
    AL --> AM[Watch CI checks]
    AM --> AN[Report the commit, PR, CI,<br/>and non-blocking findings]

    AO[Commit after review] -. invalidates review .-> AA
    AP[(Branch workflow state)] --- D
    AP --- J
    AP --- Y
    AP --- AE
    AP --- AK
```

## Supporting actions

```mermaid
flowchart LR
    A[check] --> A1[Check freshness]
    A1 --> A2[Run gates]
    A2 --> A3[Report readiness]

    B[intent edit] --> B1[Show the locked intent]
    B1 --> B2[Propose the intent diff and new size]
    B2 --> B3[Require approval and a reason]
    B3 --> B4[Update the intent]
    B4 --> B5[Mark the description and review out of date]

    C[setup] --> C1[Generate a dry-run plan]
    C1 --> C2[Require approval]
    C2 --> C3[Install configuration and hooks]
```

## Safety boundaries

- The developer approves the intent before implementation starts.
- Only the branch-state tool writes workflow state.
- A locked intent changes only after explicit approval and a stated reason.
- Deterministic commands decide whether gates pass.
- A blocking review finding stops delivery.
- A required gate failure stops delivery.
- A commit after review makes the review out of date.
- Hooks never rebase a branch.
