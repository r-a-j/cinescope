---
name: grill-me
description: >-
  Stress-tests a plan, architectural decision, or feature idea before writing code by relentlessly
  interviewing the user across structured rounds of questions with recommended defaults.
  Use when the user wants to refine an idea, stress-test a plan, resolve design decisions,
  or invokes /grill-me.
---

# Grill-Me: Plan & Design Stress-Testing

Interview the user relentlessly until you reach a shared, unambiguous understanding. Map this as a **design tree**: every decision branches into the secondary decisions that hang off it.

---

## The Core Process

### 1. Work the Tree in Rounds
The **frontier** is every decision whose prerequisites are already settled: the questions you can ask *now* without guessing at answers you haven't heard yet. 

Ask the entire frontier in one round:
- Number each question.
- Provide your concrete **recommended answer**.
- Word each question so replying "yes" accepts your recommended answer.
- Wait for the user's answers before moving to the next round.

### 2. Format for Each Round
Present questions in clean markdown:

```markdown
### Round <N>

**[Q1] <Question Title>**: <Question explanation, trade-offs, and choices>
-> Recommendation: <Your concrete recommended decision and rationale>

---

**[Q2] <Question Title>**: <Question explanation, trade-offs, and choices>
-> Recommendation: <Your concrete recommended decision and rationale>
```

### 3. Frontier Propagation
Each round the user answers reshapes the tree:
- Settled decisions push the frontier outward and unblock questions that depended on them.
- Recompute the frontier and ask the next round.
- A question whose answer depends on an open question in the current round belongs to a *later* round, never this one.

### 4. Fact-Finding Rule (Agent's Job, Never the User's)
- When a frontier question requires facts from the codebase, configuration, schema, or project files, search and inspect the environment yourself using your tools.
- **Never ask the user for anything you can look up yourself.**
- Put only genuine architectural, product, and scope **decisions** to the user.

### 5. Completion Criteria
The grilling session is complete when the frontier is empty:
- Every branch of the design tree has been visited.
- Nothing is left silently assumed.
- **Do not write or modify code until the user explicitly confirms alignment on the final plan.**
